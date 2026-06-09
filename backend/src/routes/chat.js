import { Router } from 'express';
import { query, queryOne, queryAll } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';
import { sendReaction } from '../config/socket.js';
import xss from 'xss';

const router = Router();

router.use(authenticate);
router.use(requireVerified);

/**
 * Two users are "matched" if they liked each other.
 * Used to cut the chat after an unmatch (per subject: no chat if one of them
 * removes their like).
 */
const areMatched = async (a, b) => {
  const m = await queryOne(`
    SELECT 1 FROM likes l1
    JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
    WHERE l1.liker_id = $1 AND l1.liked_id = $2
  `, [a, b]);
  return !!m;
};

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
        )::int as unread_count,
        -- Still mutually liked? If not (unmatch), the conversation is shown
        -- read-only ("Connection ended") instead of being hidden.
        EXISTS (
          SELECT 1 FROM likes l1
          JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
          WHERE l1.liker_id = $1 AND l1.liked_id = u.id
        ) as is_matched
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
      -- Show the conversation if still matched, OR if it has history worth
      -- keeping read-only after an unmatch (empty unmatched convs stay hidden).
      AND (
        EXISTS (
          SELECT 1 FROM likes l1
          JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
          WHERE l1.liker_id = $1 AND l1.liked_id = u.id
        )
        OR EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id)
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
        // No unread badge on an ended (unmatched) conversation.
        unreadCount: c.is_matched ? c.unread_count : 0,
        available: c.is_matched,
        createdAt: c.created_at
      }))
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

/**
 * GET /api/chat/conversations/:otherUserId
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
      `SELECT id, CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END as other_user_id
       FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [conversationId, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // After an unmatch the conversation becomes read-only: the history stays
    // readable, but sending is blocked (POST returns 403). We surface the match
    // state as `available` so the client can lock the composer accordingly.
    const matched = await areMatched(userId, conversation.other_user_id);

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
        m.reply_to_id,
        (SELECT content FROM messages WHERE id = m.reply_to_id) as reply_content, 
        (SELECT sender_id FROM messages WHERE id = m.reply_to_id) as reply_sender_id,
        (SELECT first_name FROM users WHERE id = (SELECT sender_id FROM messages WHERE id = m.reply_to_id)) as reply_sender_name, 
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
        reactions: m.reactions,
        replyToId: m.reply_to_id,
        replyContent: m.reply_content,     
        replySenderId: m.reply_sender_id,
        replySenderName: m.reply_sender_name 
      })),
      hasMore: messages.length === parseInt(limit),
      available: matched
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
    const { content, replyToId } = req.body;

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

    // Not matched anymore (unmatch) → cannot send (per subject)
    if (!(await areMatched(userId, conversation.other_user_id))) {
      return res.status(403).json({ error: 'You can only message matched users' });
    }

    // Insert message
    const message = await queryOne(`
      INSERT INTO messages (conversation_id, sender_id, content, reply_to_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, sender_id, content, is_read, created_at, reply_to_id
    `, [conversationId, userId, cleanContent, replyToId || null]);

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    // Fetch the parent (replied-to) message info
    let replyContent = null;
    let replySenderName = null;
    let replySenderId = null;

    if (message.reply_to_id) {
        const parentMsg = await queryOne(`
            SELECT m.content, m.sender_id, u.first_name 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.id = $1
        `, [message.reply_to_id]);
        
        if (parentMsg) {
            replyContent = parentMsg.content;
            replySenderId = parentMsg.sender_id;
            replySenderName = parentMsg.first_name;
        }
    }

    // Send real-time message via Socket.io
    const io = req.app.get('io');
    const messageData = {
      id: message.id,
      conversationId: parseInt(conversationId),
      senderId: userId,
      senderName: req.user.first_name,
      content: cleanContent,
      isRead: false,
      createdAt: message.created_at,
      // Include reply info so the recipient can render it over WebSockets
      replyToId: message.reply_to_id,
      replyContent: replyContent,         
      replySenderId: replySenderId,       
      replySenderName: replySenderName    
    };

    // Single chat:message emit, to the recipient's personal room: they receive it
    // whether they're in this conversation, in another one, or elsewhere in the app —
    // with no double delivery. This event drives the message display, the conversation
    // list update AND the unread badge (recomputed from the messages table when needed).
    // No dedicated 'message' notification anymore: it was filtered out of the list,
    // useless for the badge, and caused a double count (chat:message + notification).
    io.to(`user:${conversation.other_user_id}`).emit('chat:message', messageData);

    res.status(201).json({
      message: {
        id: message.id,
        senderId: message.sender_id,
        content: message.content,
        isRead: message.is_read,
        createdAt: message.created_at,
        isOwn: true,
        replyToId: message.reply_to_id,
        replyContent: replyContent, 
        replySenderId: replySenderId,
        replySenderName: replySenderName
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
      -- Don't count unread from ended (unmatched) conversations, to match the
      -- sidebar which shows no unread badge on them. A block deletes the likes,
      -- so this also excludes blocked pairs.
      AND EXISTS (
        SELECT 1 FROM likes l1
        JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
        WHERE l1.liker_id = $1
          AND l1.liked_id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
      )
    `, [userId]);

    res.json({ count: result.count });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
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

    // 1. Check the message exists and get its conversation
    const message = await queryOne(`
      SELECT m.id, m.conversation_id, c.user1_id, c.user2_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = $1
    `, [messageId]);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    // 2. Check the user is part of the conversation
    if (message.user1_id !== userId && message.user2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // 3. Logique de Toggle (Upsert/Delete)
    let action = 'added';
    
    // Check if a reaction already exists
    const existing = await queryOne(
      'SELECT id, emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2',
      [messageId, userId]
    );

    if (existing) {
      if (!emoji || existing.emoji === emoji) {
        // Same emoji or null → remove the reaction
        await query('DELETE FROM message_reactions WHERE id = $1', [existing.id]);
        action = 'removed';
      } else {
        // Otherwise → update
        await query('UPDATE message_reactions SET emoji = $1 WHERE id = $2', [emoji, existing.id]);
        action = 'updated';
      }
    } else if (emoji) {
      // No existing reaction and an emoji given → insert
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