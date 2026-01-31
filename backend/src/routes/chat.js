import { Router } from 'express';
import { query, queryOne, queryAll } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';
import { sendNotification, sendChatMessage, sendMessagesRead, sendReaction } from '../config/socket.js';
import xss from 'xss';

const router = Router();

router.use(authenticate);
router.use(requireVerified);

/**
 * GET /api/chat/conversations
 * Get all conversations for current user
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.userId;

    const conversations = await queryAll(`
      SELECT 
        c.id,
        c.created_at,
        c.updated_at,
        CASE 
          WHEN c.user1_id = $1 THEN c.user2_id 
          ELSE c.user1_id 
        END as other_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.is_online,
        u.last_seen,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        (
          SELECT content FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) as last_message,
        (
          SELECT created_at FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) as last_message_at,
        (
          SELECT sender_id FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) as last_message_sender,
        (
          SELECT COUNT(*) FROM messages 
          WHERE conversation_id = c.id 
          AND sender_id != $1 
          AND is_read = false
        )::int as unread_count
      FROM conversations c
      JOIN users u ON u.id = CASE 
        WHEN c.user1_id = $1 THEN c.user2_id 
        ELSE c.user1_id 
      END
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      ORDER BY COALESCE(
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
        c.created_at
      ) DESC
    `, [userId]);

    res.json({
      conversations: conversations.map(c => ({
        id: c.id,
        otherUser: {
          id: c.other_user_id,
          username: c.username,
          firstName: c.first_name,
          lastName: c.last_name,
          isOnline: c.is_online,
          lastSeen: c.last_seen,
          profilePicture: c.profile_picture ? `/uploads/${c.profile_picture}` : null
        },
        lastMessage: c.last_message,
        lastMessageAt: c.last_message_at,
        lastMessageSender: c.last_message_sender,
        unreadCount: c.unread_count,
        createdAt: c.created_at
      }))
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

/**
 * GET /api/chat/conversations/:odeclarationuserId
 * Get or create conversation with a user
 */
router.get('/conversations/:otherUserId', async (req, res) => {
  try {
    const userId = req.userId;
    const otherUserId = parseInt(req.params.otherUserId);

    // Check if users are matched (mutual likes)
    const matched = await queryOne(`
      SELECT 1 FROM likes l1
      JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
      WHERE l1.liker_id = $1 AND l1.liked_id = $2
    `, [userId, otherUserId]);

    if (!matched) {
      return res.status(403).json({ error: 'You can only chat with matched users' });
    }

    // Check if blocked
    const blocked = await queryOne(`
      SELECT 1 FROM blocks 
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
    `, [userId, otherUserId]);

    if (blocked) {
      return res.status(403).json({ error: 'Cannot chat with this user' });
    }

    // Get or create conversation
    const minId = Math.min(userId, otherUserId);
    const maxId = Math.max(userId, otherUserId);

    let conversation = await queryOne(
      'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2',
      [minId, maxId]
    );

    if (!conversation) {
      conversation = await queryOne(
        'INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING id',
        [minId, maxId]
      );
    }

    // Get other user info
    const otherUser = await queryOne(`
      SELECT id, username, first_name, last_name, is_online, last_seen,
             (SELECT filename FROM photos WHERE user_id = $1 AND is_profile_picture = true LIMIT 1) as profile_picture
      FROM users WHERE id = $1
    `, [otherUserId]);

    res.json({
      conversation: {
        id: conversation.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          firstName: otherUser.first_name,
          lastName: otherUser.last_name,
          isOnline: otherUser.is_online,
          lastSeen: otherUser.last_seen,
          profilePicture: otherUser.profile_picture ? `/uploads/${otherUser.profile_picture}` : null
        }
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

/**
 * GET /api/chat/:conversationId/messages
 * Get messages for a conversation
 */
router.get('/:conversationId/messages', async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

    // Verify user is part of conversation
    const conversation = await queryOne(
      'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Build query
    let params = [conversationId, parseInt(limit)];
    let whereClause = 'WHERE conversation_id = $1';
    
    if (before) {
      whereClause += ' AND created_at < $3';
      params.push(before);
    }

    const messages = await queryAll(`
      SELECT 
        m.id,
        m.sender_id,
        m.content,
        m.is_read,
        m.created_at,
        u.username,
        u.first_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object('userId', mr.user_id, 'emoji', mr.emoji))
            FROM message_reactions mr
            WHERE mr.message_id = m.id
          ),
          '[]'
        ) as reactions
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $2
    `, params);

    // Mark messages as read
    await query(`
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [conversationId, userId]);

    res.json({
      messages: messages.reverse().map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.first_name,
        content: m.content,
        isRead: m.is_read,
        createdAt: m.created_at,
        isOwn: m.sender_id === userId,
        reactions: m.reactions
      })),
      hasMore: messages.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

/**
 * POST /api/chat/:conversationId/messages
 * Send a message
 */
router.post('/:conversationId/messages', async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { content } = req.body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const cleanContent = xss(content.trim()).slice(0, 1000);

    // Verify user is part of conversation and get other user
    const conversation = await queryOne(`
      SELECT 
        c.id,
        CASE WHEN c.user1_id = $2 THEN c.user2_id ELSE c.user1_id END as other_user_id
      FROM conversations c
      WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)
    `, [conversationId, userId]);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check if blocked
    const blocked = await queryOne(`
      SELECT 1 FROM blocks 
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
    `, [userId, conversation.other_user_id]);

    if (blocked) {
      return res.status(403).json({ error: 'Cannot send message to this user' });
    }

    // Insert message
    const message = await queryOne(`
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, sender_id, content, is_read, created_at
    `, [conversationId, userId, cleanContent]);

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    // Send real-time message via Socket.io
    const io = req.app.get('io');
    const messageData = {
      id: message.id,
      conversationId: parseInt(conversationId),
      senderId: userId,
      senderName: req.user.first_name,
      content: cleanContent,
      isRead: false,
      createdAt: message.created_at
    };

    sendChatMessage(io, parseInt(conversationId), messageData);
    io.to(`user:${conversation.other_user_id}`).emit('chat:message', messageData);

    // Send notification to other user
    sendNotification(io, conversation.other_user_id, 'message', {
      conversationId: parseInt(conversationId),
      fromUserId: userId,
      fromUsername: req.user.username,
      fromName: req.user.first_name,
      preview: cleanContent.slice(0, 50) + (cleanContent.length > 50 ? '...' : ''),
      message: `New message from ${req.user.first_name}`
    });

    // Create notification in database
    await query(`
      INSERT INTO notifications (user_id, type, from_user_id, data)
      VALUES ($1, 'message', $2, $3)
    `, [
      conversation.other_user_id,
      userId,
      JSON.stringify({ conversationId: parseInt(conversationId), preview: cleanContent.slice(0, 50) })
    ]);

    res.status(201).json({
      message: {
        id: message.id,
        senderId: message.sender_id,
        content: message.content,
        isRead: message.is_read,
        createdAt: message.created_at,
        isOwn: true
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PUT /api/chat/:conversationId/read
 * Mark all messages in conversation as read
 */
router.put('/:conversationId/read', async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    // Verify user is part of conversation
    const conversation = await queryOne(
      'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await query(`
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [conversationId, userId]);

    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

/**
 * GET /api/chat/unread-count
 * Get total unread message count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.userId;

    const result = await queryOne(`
      SELECT COUNT(*)::int as count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND m.sender_id != $1
      AND m.is_read = false
    `, [userId]);

    res.json({ count: result.count });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.put('/:conversationId/read', async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    // 1. Verify user is part of conversation AND get the other user ID
    const conversation = await queryOne(
      `SELECT id, 
       CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END as other_user_id
       FROM conversations 
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [conversationId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 2. Update DB
    await query(`
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [conversationId, userId]);

    // 3. ACTUALISATION TEMPS RÉEL (Le Fix)
    const io = req.app.get('io');
    // On notifie l'AUTRE utilisateur (celui qui a écrit les messages) que c'est lu
    sendMessagesRead(io, parseInt(conversationId), userId, conversation.other_user_id);

    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

/**
 * POST /api/chat/messages/:messageId/react
 * Toggle reaction on a message
 */
router.post('/messages/:messageId/react', async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;
    const { emoji } = req.body; // Envoyer null pour supprimer

    // 1. Vérifier que le message existe et récupérer la conversation
    const message = await queryOne(`
      SELECT m.id, m.conversation_id, c.user1_id, c.user2_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = $1
    `, [messageId]);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    // 2. Vérifier que l'user fait partie de la conversation
    if (message.user1_id !== userId && message.user2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // 3. Logique de Toggle (Upsert/Delete)
    let action = 'added';
    
    // On regarde si une réaction existe déjà
    const existing = await queryOne(
      'SELECT id, emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2',
      [messageId, userId]
    );

    if (existing) {
      if (!emoji || existing.emoji === emoji) {
        // Si on envoie null ou le même emoji -> Suppression
        await query('DELETE FROM message_reactions WHERE id = $1', [existing.id]);
        action = 'removed';
      } else {
        // Sinon -> Mise à jour
        await query('UPDATE message_reactions SET emoji = $1 WHERE id = $2', [emoji, existing.id]);
        action = 'updated';
      }
    } else if (emoji) {
      // Pas de réaction existante et emoji fourni -> Insertion
      await query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [messageId, userId, emoji]
      );
    }

    // 4. WebSocket
    const io = req.app.get('io');
    const reactionData = {
      messageId: parseInt(messageId),
      userId,
      emoji: action === 'removed' ? null : emoji,
      action
    };
    
    sendReaction(io, message.conversation_id, reactionData);

    res.json(reactionData);

  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to react' });
  }
});

export default router;
