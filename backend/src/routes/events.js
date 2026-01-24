import { Router } from 'express';
import { queryOne, queryAll, query } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';
import { validateEvent } from '../utils/validators.js';
import { sendNotification, isUserOnline } from '../config/socket.js';

const router = Router();

router.use(authenticate);
router.use(requireVerified);

/**
 * POST /api/events
 * Create a new date proposal
 */
router.post('/', async (req, res) => {
  try {
    const { targetId, date, location, description } = req.body;
    const creatorId = req.userId;

    // 1. Validation
    const validation = validateEvent({ date, location, description });
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    // 2. Check if users are matched
    const matchCheck = await queryOne(`
      SELECT 1 FROM likes l1
      JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
      WHERE l1.liker_id = $1 AND l1.liked_id = $2
    `, [creatorId, targetId]);

    if (!matchCheck) {
      return res.status(403).json({ error: 'You can only schedule dates with matched users' });
    }

    // 3. Create Event
    const event = await queryOne(`
      INSERT INTO events (creator_id, target_id, event_date, location, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [creatorId, targetId, date, location, description]);

    // 4. Send Notification via Socket
    const io = req.app.get('io');
    await sendNotification(io, targetId, 'event_request', {
      eventId: event.id,
      fromUserId: creatorId,
      message: 'Proposed a date!',
      eventDate: date
    });

    res.status(201).json({ event });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * GET /api/events/:userId
 * Get events between current user and another user
 */
router.get('/:targetId', async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.userId;

    const events = await queryAll(`
      SELECT * FROM events
      WHERE (creator_id = $1 AND target_id = $2)
         OR (creator_id = $2 AND target_id = $1)
      ORDER BY event_date ASC
    `, [userId, targetId]);

    res.json({ events });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * PUT /api/events/:id/status
 * Accept, Decline or Cancel an event
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted', 'declined', 'cancelled'
    const userId = req.userId;

    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check ownership and rights
    const event = await queryOne('SELECT * FROM events WHERE id = $1', [id]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Logic: 
    // - Creator can only Cancel.
    // - Target can Accept or Decline.
    let allowed = false;
    let notifType = '';
    let notifTarget = null;

    if (event.creator_id === userId) {
      if (status === 'cancelled') {
        allowed = true;
        notifType = 'event_cancelled';
        notifTarget = event.target_id;
      }
    } else if (event.target_id === userId) {
      if (['accepted', 'declined'].includes(status)) {
        allowed = true;
        notifType = status === 'accepted' ? 'event_accepted' : 'event_declined';
        notifTarget = event.creator_id;
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to perform this action' });
    }

    const updatedEvent = await queryOne(`
      UPDATE events SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [status, id]);

    // Send notification
    const io = req.app.get('io');
    await sendNotification(io, notifTarget, notifType, {
      eventId: event.id,
      fromUserId: userId,
      message: `Date ${status}`,
      eventDate: event.event_date
    });

    res.json({ event: updatedEvent });

  } catch (error) {
    console.error('Update event status error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
