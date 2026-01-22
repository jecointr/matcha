import { Router } from 'express';
import { query, queryOne, queryAll } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireVerified);

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE n.user_id = $1';
    if (unreadOnly === 'true') {
      whereClause += ' AND n.is_read = false';
    }

    const notifications = await queryAll(`
      SELECT 
        n.id,
        n.type,
        n.from_user_id,
        n.data,
        n.is_read,
        n.created_at,
        u.username as from_username,
        u.first_name as from_first_name,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as from_profile_picture
      FROM notifications n
      LEFT JOIN users u ON u.id = n.from_user_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), offset]);

    // Get total count
    const countResult = await queryOne(`
      SELECT COUNT(*)::int as total FROM notifications n ${whereClause}
    `, [userId]);

    // Get unread count
    const unreadResult = await queryOne(`
      SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        fromUser: n.from_user_id ? {
          id: n.from_user_id,
          username: n.from_username,
          firstName: n.from_first_name,
          profilePicture: n.from_profile_picture ? `/uploads/${n.from_profile_picture}` : null
        } : null,
        data: n.data,
        isRead: n.is_read,
        createdAt: n.created_at,
        message: getNotificationMessage(n)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / parseInt(limit))
      },
      unreadCount: unreadResult.count
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.userId;

    const result = await queryOne(`
      SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({ count: result.count });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

/**
 * PUT /api/notifications/:notificationId/read
 * Mark a notification as read
 */
router.put('/:notificationId/read', async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const result = await query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.userId;

    await query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

/**
 * DELETE /api/notifications/:notificationId
 * Delete a notification
 */
router.delete('/:notificationId', async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const result = await query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * Helper: Generate notification message
 */
function getNotificationMessage(notification) {
  const name = notification.from_first_name || 'Someone';
  
  switch (notification.type) {
    case 'like':
      return `${name} liked your profile`;
    case 'unlike':
      return `${name} unliked your profile`;
    case 'match':
      return `You matched with ${name}! Start chatting now`;
    case 'profile_view':
      return `${name} viewed your profile`;
    case 'message':
      return `${name} sent you a message`;
    default:
      return 'You have a new notification';
  }
}

export default router;
