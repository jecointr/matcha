import jwt from 'jsonwebtoken';
import { query, queryOne } from './database.js';

// Store connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map();

/**
 * Initialize Socket.io handlers
 * @param {Object} io - Socket.io server instance
 */
export const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    // Add user to connected users
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Update user online status in database
    await updateUserOnlineStatus(userId, true);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', async () => {
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If no more connections, mark user as offline
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
          await updateUserOnlineStatus(userId, false);
        }
      }
    });

    // Chat: join conversation room.
    // Only a participant of the conversation may join its room — reactions are
    // broadcast to `chat:<id>` (see sendReaction), so an outsider joining could
    // otherwise eavesdrop on them.
    socket.on('join:chat', async (conversationId) => {
      const cid = parseInt(conversationId, 10);
      if (Number.isNaN(cid)) return;
      const part = await queryOne(
        'SELECT 1 FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [cid, userId]
      );
      if (!part) return;
      socket.join(`chat:${cid}`);
    });

    // Chat: leave conversation room
    socket.on('leave:chat', (conversationId) => {
      socket.leave(`chat:${conversationId}`);
    });

    // Chat: typing indicator.
    // Emit to the recipient's personal room (like chat:message) so the typing
    // bubble shows even when they don't have this conversation open — driving
    // the WhatsApp-style indicator in the conversation list. Falls back to the
    // conversation room if the client didn't send the recipient id.
    socket.on('typing:start', (data) => {
      const target = data.toUserId
        ? io.to(`user:${data.toUserId}`)
        : socket.to(`chat:${data.conversationId}`);
      target.emit('typing:start', {
        userId,
        conversationId: data.conversationId
      });
    });

    socket.on('typing:stop', (data) => {
      const target = data.toUserId
        ? io.to(`user:${data.toUserId}`)
        : socket.to(`chat:${data.conversationId}`);
      target.emit('typing:stop', {
        userId,
        conversationId: data.conversationId
      });
    });

    socket.on('chat:read', ({ conversationId, senderId }) => {
      // Tell the sender that their messages were read by this user
      io.to(`user:${senderId}`).emit('chat:read', {
        conversationId,
        readerId: userId,
        readAt: new Date().toISOString()
      });
    });

    // --- WebRTC signaling (audio/video) ---

    // Initiate a call: forward the offer to the target user's personal room.
    // Two guards: (1) only MATCHED users can call each other — otherwise anyone
    // could ring/harass a stranger; (2) the caller identity (`from`) is rebuilt
    // server-side from the authenticated socket, never trusted from the client
    // payload (a client could spoof another user's name/photo). The `from` shape
    // ({ id, name, picture }) matches what the frontend expects.
    socket.on("call:user", async ({ userToCall, signalData, callType }) => {
      const targetId = parseInt(userToCall, 10);
      if (Number.isNaN(targetId)) return;

      const matched = await queryOne(`
        SELECT 1 FROM likes l1
        JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
        WHERE l1.liker_id = $1 AND l1.liked_id = $2
      `, [userId, targetId]);
      if (!matched) return;

      const caller = await queryOne(`
        SELECT first_name,
               (SELECT filename FROM photos WHERE user_id = users.id AND is_profile_picture = true LIMIT 1) as profile_picture
        FROM users WHERE id = $1
      `, [userId]);

      io.to(`user:${targetId}`).emit("call:incoming", {
        signal: signalData,
        from: {
          id: userId,
          name: caller?.first_name || 'Someone',
          picture: caller?.profile_picture ? `/uploads/${caller.profile_picture}` : null
        },
        callType
      });
    });

    // Answer a call: relay the answer back to the caller
    socket.on("call:answer", (data) => {
      const to = parseInt(data?.to, 10);
      if (Number.isNaN(to)) return;
      io.to(`user:${to}`).emit("call:accepted", data.signal);
    });

    // Hang up / decline
    socket.on("call:end", ({ to }) => {
      const target = parseInt(to, 10);
      if (Number.isNaN(target)) return;
      io.to(`user:${target}`).emit("call:ended");
    });
  });
};

/**
 * Update user's online status in database
 */
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await query(
      `UPDATE users SET is_online = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2`,
      [isOnline, userId]
    );
  } catch (error) {
    console.error('Failed to update online status:', error);
  }
};

/**
 * Send notification to a specific user
 * @param {Object} io - Socket.io instance
 * @param {number} userId - Target user ID
 * @param {string} type - Notification type
 * @param {Object} data - Notification data
 */
export const sendNotification = async (io, userId, type, data) => {
  try {
    // 1. Save to DB
    const fromUserId = data.fromUserId || null;

    // Respect notification mutes: if the recipient previously "unliked" the
    // sender, they no longer receive notifications from them (subject IV.5).
    // The mute is cleared when the recipient likes the sender again.
    if (fromUserId) {
      const muted = await queryOne(
        'SELECT 1 FROM notification_mutes WHERE muter_id = $1 AND muted_id = $2',
        [userId, fromUserId]
      );
      if (muted) return;
    }

    const insertQuery = `
      INSERT INTO notifications (user_id, type, from_user_id, data)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;
    
    const result = await queryOne(insertQuery, [
      userId, 
      type, 
      fromUserId, 
      JSON.stringify(data)
    ]);

    // 2. Get the sender's info
    let fromUser = null;
    if (fromUserId) {
      fromUser = await queryOne(`
        SELECT id, username, first_name, 
        (SELECT filename FROM photos WHERE user_id = users.id AND is_profile_picture = true LIMIT 1) as profile_picture
        FROM users WHERE id = $1
      `, [fromUserId]);
    }

    // 3. Build the payload
    const notificationPayload = {
      id: result.id,
      type,
      fromUser: fromUser ? {
        id: fromUser.id,
        username: fromUser.username,
        firstName: fromUser.first_name,
        profilePicture: fromUser.profile_picture ? `/uploads/${fromUser.profile_picture}` : null
      } : null,
      data,
      isRead: false,
      createdAt: result.created_at,
      message: data.message || 'New notification'
    };

    // 4. Emit the socket event
    io.to(`user:${userId}`).emit('notification', notificationPayload);

  } catch (error) {
    console.error('Error in sendNotification:', error);
  }
};

export const sendReaction = (io, conversationId, reactionData) => {
  io.to(`chat:${conversationId}`).emit('chat:reaction', reactionData);
};