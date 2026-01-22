import { Router } from 'express';
import { query, queryOne, queryAll, transaction } from '../config/database.js';
import { authenticate, requireVerified } from '../middlewares/auth.js';
import { sendNotification } from '../config/socket.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireVerified);

/**
 * GET /api/profiles/browse
 * Get suggested profiles based on preferences and matching algorithm
 */
router.get('/browse', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      page = 1,
      limit = 20,
      sortBy = 'match', // match, distance, fame, age
      sortOrder = 'desc',
      minAge,
      maxAge,
      minFame,
      maxFame,
      maxDistance,
      tags
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user = req.user;

    // Build the matching query
    let params = [userId];
    let paramCount = 1;
    let conditions = [`u.id != $1`, `u.is_profile_complete = true`];
    
    // Exclude blocked users (both directions)
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM blocks b 
      WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
         OR (b.blocker_id = u.id AND b.blocked_id = $1)
    )`);

    // Filter by sexual preference compatibility
    if (user.gender && user.sexual_preference) {
      // Current user's preference filter
      if (user.sexual_preference === 'male') {
        conditions.push(`u.gender = 'male'`);
      } else if (user.sexual_preference === 'female') {
        conditions.push(`u.gender = 'female'`);
      }
      // Other user must be interested in current user's gender
      if (user.gender === 'male') {
        conditions.push(`(u.sexual_preference = 'male' OR u.sexual_preference = 'both')`);
      } else if (user.gender === 'female') {
        conditions.push(`(u.sexual_preference = 'female' OR u.sexual_preference = 'both')`);
      }
    }

    // Age filter
    if (minAge) {
      params.push(parseInt(minAge));
      conditions.push(`DATE_PART('year', AGE(u.birth_date)) >= $${++paramCount}`);
    }
    if (maxAge) {
      params.push(parseInt(maxAge));
      conditions.push(`DATE_PART('year', AGE(u.birth_date)) <= $${++paramCount}`);
    }

    // Fame filter
    if (minFame) {
      params.push(parseInt(minFame));
      conditions.push(`u.fame_rating >= $${++paramCount}`);
    }
    if (maxFame) {
      params.push(parseInt(maxFame));
      conditions.push(`u.fame_rating <= $${++paramCount}`);
    }

    // Distance filter
    let distanceFormula = '0';
    let distanceSelect = '0 as distance';
    
    if (user.latitude && user.longitude) {
      params.push(user.latitude, user.longitude);
      distanceFormula = `ROUND(earth_distance(
        ll_to_earth($${++paramCount}, $${++paramCount}),
        ll_to_earth(u.latitude, u.longitude)
      )::numeric / 1000, 1)`;
      
      distanceSelect = `${distanceFormula} as distance`;
      
      if (maxDistance) {
        params.push(parseFloat(maxDistance) * 1000);
        conditions.push(`earth_distance(
          ll_to_earth($${paramCount - 1}, $${paramCount}),
          ll_to_earth(u.latitude, u.longitude)
        ) <= $${++paramCount}`);
      }
    }

    // Tags filter
    let tagsCountQuery = '0';
    let tagsSelect = '0 as common_tags';
    
    if (tags) {
      const tagIds = tags.split(',').map(t => parseInt(t)).filter(t => !isNaN(t));
      if (tagIds.length > 0) {
        params.push(tagIds);
        tagsCountQuery = `(SELECT COUNT(*) FROM user_tags ut WHERE ut.user_id = u.id AND ut.tag_id = ANY($${++paramCount}))`;
        tagsSelect = `${tagsCountQuery} as common_tags`;
        conditions.push(`EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = u.id AND ut.tag_id = ANY($${paramCount}))`);
      }
    } else {
      tagsCountQuery = `(SELECT COUNT(*) FROM user_tags ut1 
                      JOIN user_tags ut2 ON ut1.tag_id = ut2.tag_id 
                      WHERE ut1.user_id = u.id AND ut2.user_id = $1)`;
      tagsSelect = `${tagsCountQuery} as common_tags`;
    }

    // Sorting
    let orderBy;
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    switch (sortBy) {
      case 'distance':
        orderBy = `distance ASC NULLS LAST`;
        break;
      case 'fame':
        orderBy = `u.fame_rating ${order}`;
        break;
      case 'age':
        orderBy = `u.birth_date ${order === 'ASC' ? 'DESC' : 'ASC'}`;
        break;
      case 'match':
      default:
        orderBy = `(${tagsCountQuery} * 10 + u.fame_rating - COALESCE(${distanceFormula}, 100)/10) DESC`;
        break;
    }

    // Main query
    const sql = `
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.biography, u.birth_date, u.city, u.country, u.fame_rating,
        u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        ${distanceSelect},
        ${tagsSelect},
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = u.id) as i_liked,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = u.id AND liked_id = $1) as liked_me
      FROM users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    params.push(parseInt(limit), offset);

    const profiles = await queryAll(sql, params);

    const countSql = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${conditions.join(' AND ')}
    `;
    let maxParamIndex = 1;
    const paramRegex = /\$(\d+)/g;
    conditions.forEach(condition => {
      let match;
      while ((match = paramRegex.exec(condition)) !== null) {
        const index = parseInt(match[1]);
        if (index > maxParamIndex) maxParamIndex = index;
      }
    });

    const countParams = params.slice(0, maxParamIndex);
    
    const countResult = await queryOne(countSql, countParams);

    // Get tags for each profile
    const profileIds = profiles.map(p => p.id);
    let tagsMap = {};
    if (profileIds.length > 0) {
      const tagsSql = `
        SELECT ut.user_id, t.id, t.name
        FROM user_tags ut
        JOIN tags t ON ut.tag_id = t.id
        WHERE ut.user_id = ANY($1)
      `;
      const tagsResult = await queryAll(tagsSql, [profileIds]);
      tagsResult.forEach(t => {
        if (!tagsMap[t.user_id]) tagsMap[t.user_id] = [];
        tagsMap[t.user_id].push({ id: t.id, name: t.name });
      });
    }

    res.json({
      profiles: profiles.map(p => formatProfileResponse(p, tagsMap[p.id] || [])),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        pages: Math.ceil(parseInt(countResult.total) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Browse error:', error);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
});

/**
 * GET /api/profiles/search
 * Advanced search with multiple criteria
 */
router.get('/search', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      page = 1,
      limit = 20,
      sortBy = 'match',
      sortOrder = 'desc',
      minAge,
      maxAge,
      minFame,
      maxFame,
      location,
      maxDistance,
      tags,
      gender
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user = req.user;

    let params = [userId];
    let paramCount = 1;
    let conditions = [`u.id != $1`, `u.is_profile_complete = true`];

    // Exclude blocked users
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM blocks b 
      WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) 
         OR (b.blocker_id = u.id AND b.blocked_id = $1)
    )`);

    // Gender filter (search can override preferences)
    if (gender) {
      params.push(gender);
      conditions.push(`u.gender = $${++paramCount}`);
    }

    // Age filter
    if (minAge) {
      params.push(parseInt(minAge));
      conditions.push(`DATE_PART('year', AGE(u.birth_date)) >= $${++paramCount}`);
    }
    if (maxAge) {
      params.push(parseInt(maxAge));
      conditions.push(`DATE_PART('year', AGE(u.birth_date)) <= $${++paramCount}`);
    }

    // Fame filter
    if (minFame) {
      params.push(parseInt(minFame));
      conditions.push(`u.fame_rating >= $${++paramCount}`);
    }
    if (maxFame) {
      params.push(parseInt(maxFame));
      conditions.push(`u.fame_rating <= $${++paramCount}`);
    }

    // Location filter (by city name)
    if (location) {
      params.push(`%${location.toLowerCase()}%`);
      conditions.push(`LOWER(u.city) LIKE $${++paramCount}`);
    }

    // Distance filter
    let distanceSelect = 'NULL as distance';
    if (user.latitude && user.longitude) {
      params.push(user.latitude, user.longitude);
      distanceSelect = `ROUND(earth_distance(
        ll_to_earth($${++paramCount}, $${++paramCount}),
        ll_to_earth(u.latitude, u.longitude)
      )::numeric / 1000, 1) as distance`;
      
      if (maxDistance) {
        params.push(parseFloat(maxDistance) * 1000);
        conditions.push(`u.latitude IS NOT NULL AND earth_distance(
          ll_to_earth($${paramCount - 1}, $${paramCount}),
          ll_to_earth(u.latitude, u.longitude)
        ) <= $${++paramCount}`);
      }
    }

    // Tags filter (must have at least one of the specified tags)
    let tagsSelect = '0 as common_tags';
    if (tags) {
      const tagIds = tags.split(',').map(t => parseInt(t)).filter(t => !isNaN(t));
      if (tagIds.length > 0) {
        params.push(tagIds);
        tagsSelect = `(SELECT COUNT(*) FROM user_tags ut WHERE ut.user_id = u.id AND ut.tag_id = ANY($${++paramCount})) as common_tags`;
        conditions.push(`EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = u.id AND ut.tag_id = ANY($${paramCount}))`);
      }
    } else {
      tagsSelect = `(SELECT COUNT(*) FROM user_tags ut1 
                     JOIN user_tags ut2 ON ut1.tag_id = ut2.tag_id 
                     WHERE ut1.user_id = u.id AND ut2.user_id = $1) as common_tags`;
    }

    // Sorting
    let orderBy;
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    switch (sortBy) {
      case 'distance':
        orderBy = `distance ASC NULLS LAST`;
        break;
      case 'fame':
        orderBy = `u.fame_rating ${order}`;
        break;
      case 'age':
        orderBy = `u.birth_date ${order === 'ASC' ? 'DESC' : 'ASC'}`;
        break;
      case 'tags':
        orderBy = `common_tags ${order}`;
        break;
      default:
        orderBy = `(common_tags * 10 + u.fame_rating) DESC`;
    }

    const sql = `
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.biography, u.birth_date, u.city, u.country, u.fame_rating,
        u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        ${distanceSelect},
        ${tagsSelect},
        (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = u.id) as i_liked,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = u.id AND liked_id = $1) as liked_me
      FROM users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    params.push(parseInt(limit), offset);

    const profiles = await queryAll(sql, params);

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM users u WHERE ${conditions.join(' AND ')}`;

    let maxParamIndex = 1;
    const paramRegex = /\$(\d+)/g;
    conditions.forEach(condition => {
      let match;
      while ((match = paramRegex.exec(condition)) !== null) {
        const index = parseInt(match[1]);
        if (index > maxParamIndex) maxParamIndex = index;
      }
    });

    const countParams = params.slice(0, maxParamIndex);
    const countResult = await queryOne(countSql, countParams);

    // Get tags
    const profileIds = profiles.map(p => p.id);
    let tagsMap = {};
    if (profileIds.length > 0) {
      const tagsResult = await queryAll(
        `SELECT ut.user_id, t.id, t.name FROM user_tags ut JOIN tags t ON ut.tag_id = t.id WHERE ut.user_id = ANY($1)`,
        [profileIds]
      );
      tagsResult.forEach(t => {
        if (!tagsMap[t.user_id]) tagsMap[t.user_id] = [];
        tagsMap[t.user_id].push({ id: t.id, name: t.name });
      });
    }

    res.json({
      profiles: profiles.map(p => formatProfileResponse(p, tagsMap[p.id] || [])),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        pages: Math.ceil(parseInt(countResult.total) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/profiles/:userId
 * Get a single user profile
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Check if blocked
    const blocked = await queryOne(
      `SELECT 1 FROM blocks WHERE 
       (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [currentUserId, userId]
    );

    if (blocked) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get profile
    const user = req.user;
    let distanceSelect = 'NULL as distance';
    let params = [userId, currentUserId];
    
    if (user.latitude && user.longitude) {
      distanceSelect = `ROUND(earth_distance(
        ll_to_earth($3, $4),
        ll_to_earth(u.latitude, u.longitude)
      )::numeric / 1000, 1) as distance`;
      params.push(user.latitude, user.longitude);
    }

    const profile = await queryOne(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.gender,
        u.sexual_preference, u.biography, u.birth_date, 
        u.city, u.country, u.fame_rating, u.is_online, u.last_seen,
        DATE_PART('year', AGE(u.birth_date)) as age,
        ${distanceSelect},
        EXISTS (SELECT 1 FROM likes WHERE liker_id = $2 AND liked_id = u.id) as i_liked,
        EXISTS (SELECT 1 FROM likes WHERE liker_id = u.id AND liked_id = $2) as liked_me
      FROM users u
      WHERE u.id = $1 AND u.is_profile_complete = true
    `, params);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get photos
    const photos = await queryAll(
      `SELECT id, filename, is_profile_picture FROM photos WHERE user_id = $1 ORDER BY is_profile_picture DESC`,
      [userId]
    );

    // Get tags
    const tags = await queryAll(
      `SELECT t.id, t.name FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = $1`,
      [userId]
    );

    // Record visit (if not own profile)
    if (parseInt(userId) !== currentUserId) {
      await query(
        `INSERT INTO profile_visits (visitor_id, visited_id) VALUES ($1, $2)`,
        [currentUserId, userId]
      );

      // Send notification
      const io = req.app.get('io');
      sendNotification(io, parseInt(userId), 'profile_view', {
        fromUserId: currentUserId,
        fromUsername: req.user.username,
        message: `${req.user.first_name} viewed your profile`
      });

      // Update fame rating (small boost for being viewed)
      await updateFameRating(parseInt(userId));
    }

    res.json({
      profile: {
        ...formatProfileResponse(profile, tags),
        photos: photos.map(p => ({
          id: p.id,
          url: `/uploads/${p.filename}`,
          isProfilePicture: p.is_profile_picture
        })),
        isConnected: profile.i_liked && profile.liked_me
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/**
 * POST /api/profiles/:userId/like
 * Like a user
 */
router.post('/:userId/like', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    if (parseInt(userId) === currentUserId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Check if current user has a profile picture
    const hasPhoto = await queryOne(
      'SELECT 1 FROM photos WHERE user_id = $1 LIMIT 1',
      [currentUserId]
    );

    if (!hasPhoto) {
      return res.status(400).json({ error: 'You need a profile picture to like someone' });
    }

    // Check if target user exists and is not blocked
    const targetUser = await queryOne(
      `SELECT id, username, first_name FROM users u 
       WHERE u.id = $1 AND u.is_profile_complete = true
       AND NOT EXISTS (
         SELECT 1 FROM blocks b 
         WHERE (b.blocker_id = $2 AND b.blocked_id = u.id) 
            OR (b.blocker_id = u.id AND b.blocked_id = $2)
       )`,
      [userId, currentUserId]
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already liked
    const existingLike = await queryOne(
      'SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [currentUserId, userId]
    );

    if (existingLike) {
      return res.status(400).json({ error: 'Already liked this user' });
    }

    // Create like
    await query(
      'INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2)',
      [currentUserId, userId]
    );

    // Check for mutual like (match)
    const mutualLike = await queryOne(
      'SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [userId, currentUserId]
    );

    const io = req.app.get('io');
    const isMatch = !!mutualLike;

    if (isMatch) {
      // Create conversation if it doesn't exist
      const minId = Math.min(currentUserId, parseInt(userId));
      const maxId = Math.max(currentUserId, parseInt(userId));
      
      await query(
        `INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [minId, maxId]
      );

      // Notify both users of the match
      sendNotification(io, parseInt(userId), 'match', {
        fromUserId: currentUserId,
        fromUsername: req.user.username,
        message: `You matched with ${req.user.first_name}!`
      });

      sendNotification(io, currentUserId, 'match', {
        fromUserId: parseInt(userId),
        fromUsername: targetUser.username,
        message: `You matched with ${targetUser.first_name}!`
      });
    } else {
      // Just notify of the like
      sendNotification(io, parseInt(userId), 'like', {
        fromUserId: currentUserId,
        fromUsername: req.user.username,
        message: `${req.user.first_name} liked your profile`
      });
    }

    // Update fame rating
    await updateFameRating(parseInt(userId));

    res.json({
      message: isMatch ? 'It\'s a match!' : 'Profile liked',
      isMatch
    });

  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

/**
 * DELETE /api/profiles/:userId/like
 * Unlike a user
 */
router.delete('/:userId/like', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Remove like
    const result = await query(
      'DELETE FROM likes WHERE liker_id = $1 AND liked_id = $2 RETURNING id',
      [currentUserId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Like not found' });
    }

    // Notify the other user
    const io = req.app.get('io');
    sendNotification(io, parseInt(userId), 'unlike', {
      fromUserId: currentUserId,
      message: 'Someone unliked your profile'
    });

    // Update fame rating
    await updateFameRating(parseInt(userId));

    res.json({ message: 'Profile unliked' });

  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike profile' });
  }
});

/**
 * POST /api/profiles/:userId/block
 * Block a user
 */
router.post('/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    if (parseInt(userId) === currentUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Create block
    await query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [currentUserId, userId]
    );

    // Remove any existing likes in both directions
    await query(
      'DELETE FROM likes WHERE (liker_id = $1 AND liked_id = $2) OR (liker_id = $2 AND liked_id = $1)',
      [currentUserId, userId]
    );

    res.json({ message: 'User blocked' });

  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * DELETE /api/profiles/:userId/block
 * Unblock a user
 */
router.delete('/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    await query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [currentUserId, userId]
    );

    res.json({ message: 'User unblocked' });

  } catch (error) {
    console.error('Unblock error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/**
 * POST /api/profiles/:userId/report
 * Report a user as fake
 */
router.post('/:userId/report', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const currentUserId = req.userId;

    if (parseInt(userId) === currentUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    await query(
      `INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)`,
      [currentUserId, userId, reason || 'Fake account']
    );

    // Decrease fame rating for reported user
    await query(
      'UPDATE users SET fame_rating = GREATEST(0, fame_rating - 5) WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Report submitted' });

  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

/**
 * Helper: Update fame rating based on profile activity
 */
async function updateFameRating(userId) {
  try {
    // Calculate fame based on: likes received, profile views, matches
    const stats = await queryOne(`
      SELECT 
        (SELECT COUNT(*) FROM likes WHERE liked_id = $1) as likes,
        (SELECT COUNT(*) FROM profile_visits WHERE visited_id = $1) as views,
        (SELECT COUNT(*) FROM likes l1 
         JOIN likes l2 ON l1.liked_id = l2.liker_id AND l1.liker_id = l2.liked_id
         WHERE l1.liker_id = $1) as matches,
        (SELECT COUNT(*) FROM reports WHERE reported_id = $1) as reports
      FROM users WHERE id = $1
    `, [userId]);

    // Fame formula: likes*3 + views*0.5 + matches*10 - reports*10 (capped at 0-100)
    const fame = Math.min(100, Math.max(0, 
      parseInt(stats.likes) * 3 + 
      parseInt(stats.views) * 0.5 + 
      parseInt(stats.matches) * 10 -
      parseInt(stats.reports) * 10
    ));

    await query(
      'UPDATE users SET fame_rating = $1 WHERE id = $2',
      [Math.round(fame), userId]
    );
  } catch (error) {
    console.error('Update fame rating error:', error);
  }
}

/**
 * Helper: Format profile response
 */
function formatProfileResponse(profile, tags) {
  return {
    id: profile.id,
    username: profile.username,
    firstName: profile.first_name,
    lastName: profile.last_name,
    gender: profile.gender,
    sexualPreference: profile.sexual_preference,
    biography: profile.biography,
    age: parseInt(profile.age),
    city: profile.city,
    country: profile.country,
    distance: profile.distance ? parseFloat(profile.distance) : null,
    fameRating: profile.fame_rating,
    commonTags: parseInt(profile.common_tags) || 0,
    isOnline: profile.is_online,
    lastSeen: profile.last_seen,
    profilePicture: profile.profile_picture ? `/uploads/${profile.profile_picture}` : null,
    iLiked: profile.i_liked,
    likedMe: profile.liked_me,
    tags
  };
}

export default router;
