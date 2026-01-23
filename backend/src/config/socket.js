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
    console.log(`User ${userId} connected (socket: ${socket.id})`);

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
      console.log(`User ${userId} disconnected (socket: ${socket.id})`);
      
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

    // Chat: join conversation room
    socket.on('join:chat', (conversationId) => {
      socket.join(`chat:${conversationId}`);
      console.log(`User ${userId} joined chat ${conversationId}`);
    });

    // Chat: leave conversation room
    socket.on('leave:chat', (conversationId) => {
      socket.leave(`chat:${conversationId}`);
    });

    // Chat: typing indicator
    socket.on('typing:start', (data) => {
      socket.to(`chat:${data.conversationId}`).emit('typing:start', {
        userId,
        conversationId: data.conversationId
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`chat:${data.conversationId}`).emit('typing:stop', {
        userId,
        conversationId: data.conversationId
      });
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
 * Check if a user is currently online
 * @param {number} userId 
 * @returns {boolean}
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
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
    // 1. Sauvegarder en BDD
    // On extrait l'ID de l'envoyeur s'il est présent dans data
    const fromUserId = data.fromUserId || null;
    
    // On insère
    const insertQuery = `
      INSERT INTO notifications (user_id, type, from_user_id, data)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;
    
    // On convertit data en JSON pour la colonne JSONB
    const result = await queryOne(insertQuery, [
      userId, 
      type, 
      fromUserId, 
      JSON.stringify(data)
    ]);

    // 2. Récupérer les infos de l'envoyeur pour l'affichage en temps réel (Avatar, Nom)
    let fromUser = null;
    if (fromUserId) {
      fromUser = await queryOne(`
        SELECT id, username, first_name, 
        (SELECT filename FROM photos WHERE user_id = users.id AND is_profile_picture = true LIMIT 1) as profile_picture
        FROM users WHERE id = $1
      `, [fromUserId]);
    }

    // 3. Construire l'objet complet pour le frontend
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

    // 4. Envoyer le socket
    io.to(`user:${userId}`).emit('notification', notificationPayload);

  } catch (error) {
    console.error('Error in sendNotification:', error);
  }
};

/**
 * Send message to a chat room
 * @param {Object} io - Socket.io instance
 * @param {number} conversationId - Conversation ID
 * @param {Object} message - Message object
 */
export const sendChatMessage = (io, conversationId, message) => {
  io.to(`chat:${conversationId}`).emit('chat:message', message);
};

/**
 * Get all connected user IDs
 * @returns {Array<number>}
 */
export const getConnectedUserIds = () => {
  return Array.from(connectedUsers.keys());
};
