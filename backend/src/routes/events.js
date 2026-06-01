import { Router } from 'express';
import xss from 'xss';
import { queryOne, queryAll, query } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';
import { validateEvent } from '../utils/validators.js';

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

    // 2b. Only one "pending" date at a time between these two people (whoever
    // created it). It must be accepted / declined / cancelled before a new one
    // can be proposed.
    const existingPending = await queryOne(`
      SELECT 1 FROM events
      WHERE status = 'pending'
        AND ((creator_id = $1 AND target_id = $2)
          OR (creator_id = $2 AND target_id = $1))
    `, [creatorId, targetId]);

    if (existingPending) {
      return res.status(409).json({
        error: 'A pending date proposal already exists with this user. Wait for it to be accepted, declined or cancelled before proposing a new one.'
      });
    }

    // 3. Create Event — sanitize free-text fields (defense in depth)
    const cleanLocation = xss(String(location).trim()).slice(0, 255);
    const cleanDescription = description ? xss(String(description).trim()).slice(0, 500) : null;

    const event = await queryOne(`
      INSERT INTO events (creator_id, target_id, event_date, location, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [creatorId, targetId, date, cleanLocation, cleanDescription]);

    // No dedicated "event_*" notification. The proposal is carried by a chat message
    // (sent from the frontend) → the recipient is notified like for any message, and
    // the date banner shows up in the chat.
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

    // A resolved date (accepted/declined/cancelled) is TERMINAL: only a "pending"
    // proposal can still change status.
    if (event.status !== 'pending') {
      return res.status(409).json({ error: 'This date has already been resolved and can no longer be changed.' });
    }

    // Logic:
    // - Creator can only Cancel.
    // - Target can Accept or Decline.
    let allowed = false;

    if (event.creator_id === userId) {
      if (status === 'cancelled') {
        allowed = true;
      }
    } else if (event.target_id === userId) {
      if (['accepted', 'declined'].includes(status)) {
        allowed = true;
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to perform this action' });
    }

    const updatedEvent = await queryOne(`
      UPDATE events SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [status, id]);

    // No "event_*" notification. accept / decline / cancel is carried by a chat
    // message (sent from the frontend).
    res.json({ event: updatedEvent });

  } catch (error) {
    console.error('Update event status error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
