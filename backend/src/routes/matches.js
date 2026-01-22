import { Router } from 'express';
import { queryAll, queryOne } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireVerified);

/**
 * GET /api/matches
 * Get all matches (mutual likes)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    const matches = await queryAll(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.biography, u.city, u.country, u.fame_rating,
        u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        l1.created_at as matched_at
      FROM likes l1
      JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
      JOIN users u ON u.id = l1.liked_id
      WHERE l1.liker_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      ORDER BY l1.created_at DESC
    `, [userId]);

    res.json({
      matches: matches.map(m => ({
        id: m.id,
        username: m.username,
        firstName: m.first_name,
        lastName: m.last_name,
        gender: m.gender,
        age: parseInt(m.age),
        biography: m.biography,
        city: m.city,
        country: m.country,
        fameRating: m.fame_rating,
        isOnline: m.is_online,
        lastSeen: m.last_seen,
        profilePicture: m.profile_picture ? `/uploads/${m.profile_picture}` : null,
        matchedAt: m.matched_at
      }))
    });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

/**
 * GET /api/matches/likes
 * Get users who liked current user
 */
router.get('/likes', async (req, res) => {
  try {
    const userId = req.userId;

    const likes = await queryAll(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.biography, u.city, u.country, u.fame_rating,
        u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        l.created_at as liked_at,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = u.id) as i_liked_back
      FROM likes l
      JOIN users u ON u.id = l.liker_id
      WHERE l.liked_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      ORDER BY l.created_at DESC
    `, [userId]);

    res.json({
      likes: likes.map(l => ({
        id: l.id,
        username: l.username,
        firstName: l.first_name,
        lastName: l.last_name,
        gender: l.gender,
        age: parseInt(l.age),
        biography: l.biography,
        city: l.city,
        country: l.country,
        fameRating: l.fame_rating,
        isOnline: l.is_online,
        lastSeen: l.last_seen,
        profilePicture: l.profile_picture ? `/uploads/${l.profile_picture}` : null,
        likedAt: l.liked_at,
        iLikedBack: l.i_liked_back
      }))
    });

  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ error: 'Failed to load likes' });
  }
});

/**
 * GET /api/matches/visits
 * Get users who visited current user's profile
 */
router.get('/visits', async (req, res) => {
  try {
    const userId = req.userId;

    const visits = await queryAll(`
      SELECT DISTINCT ON (u.id)
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.city, u.country, u.fame_rating, u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        pv.visited_at
      FROM profile_visits pv
      JOIN users u ON u.id = pv.visitor_id
      WHERE pv.visited_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      ORDER BY u.id, pv.visited_at DESC
    `, [userId]);

    // Sort by most recent visit
    visits.sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at));

    res.json({
      visits: visits.map(v => ({
        id: v.id,
        username: v.username,
        firstName: v.first_name,
        lastName: v.last_name,
        gender: v.gender,
        age: parseInt(v.age),
        city: v.city,
        country: v.country,
        fameRating: v.fame_rating,
        isOnline: v.is_online,
        lastSeen: v.last_seen,
        profilePicture: v.profile_picture ? `/uploads/${v.profile_picture}` : null,
        visitedAt: v.visited_at
      }))
    });

  } catch (error) {
    console.error('Get visits error:', error);
    res.status(500).json({ error: 'Failed to load visits' });
  }
});

/**
 * GET /api/matches/my-likes
 * Get users the current user has liked
 */
router.get('/my-likes', async (req, res) => {
  try {
    const userId = req.userId;

    const likes = await queryAll(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.biography, u.city, u.country, u.fame_rating,
        u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        l.created_at as liked_at,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = u.id AND liked_id = $1) as liked_me_back
      FROM likes l
      JOIN users u ON u.id = l.liked_id
      WHERE l.liker_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      ORDER BY l.created_at DESC
    `, [userId]);

    res.json({
      likes: likes.map(l => ({
        id: l.id,
        username: l.username,
        firstName: l.first_name,
        lastName: l.last_name,
        gender: l.gender,
        age: parseInt(l.age),
        biography: l.biography,
        city: l.city,
        country: l.country,
        fameRating: l.fame_rating,
        isOnline: l.is_online,
        lastSeen: l.last_seen,
        profilePicture: l.profile_picture ? `/uploads/${l.profile_picture}` : null,
        likedAt: l.liked_at,
        likedMeBack: l.liked_me_back
      }))
    });

  } catch (error) {
    console.error('Get my likes error:', error);
    res.status(500).json({ error: 'Failed to load likes' });
  }
});

export default router;
