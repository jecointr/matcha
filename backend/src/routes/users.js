import { Router } from 'express';
import { query, queryOne, queryAll, transaction } from '../config/database.js';
import { authenticate } from '../middlewares/auth.js';
import { upload, processImage, deleteImage, handleUploadError } from '../middlewares/upload.js';
import { sanitizeString, isValidEmail, isValidName, sanitizeEmail } from '../utils/validators.js';
import xss from 'xss';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { gender, sexualPreference, biography, birthDate, firstName, lastName, email } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 0;

    // Validate and add gender
    if (gender !== undefined) {
      if (!['male', 'female', 'other'].includes(gender)) {
        return res.status(400).json({ error: 'Invalid gender' });
      }
      updates.push(`gender = $${++paramCount}`);
      values.push(gender);
    }

    // Validate and add sexual preference
    if (sexualPreference !== undefined) {
      if (!['male', 'female', 'both'].includes(sexualPreference)) {
        return res.status(400).json({ error: 'Invalid sexual preference' });
      }
      updates.push(`sexual_preference = $${++paramCount}`);
      values.push(sexualPreference);
    }

    // Sanitize and add biography
    if (biography !== undefined) {
      const cleanBio = xss(biography.trim()).slice(0, 500);
      updates.push(`biography = $${++paramCount}`);
      values.push(cleanBio);
    }

    // Validate and add birth date
    if (birthDate !== undefined) {
      const date = new Date(birthDate);
      const now = new Date();
      const age = Math.floor((now - date) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid birth date' });
      }
      if (age < 18) {
        return res.status(400).json({ error: 'You must be at least 18 years old' });
      }
      if (age > 120) {
        return res.status(400).json({ error: 'Invalid birth date' });
      }
      
      updates.push(`birth_date = $${++paramCount}`);
      values.push(birthDate);
    }

    // Validate and add first name
    if (firstName !== undefined) {
      if (!isValidName(firstName)) {
        return res.status(400).json({ error: 'Invalid first name' });
      }
      updates.push(`first_name = $${++paramCount}`);
      values.push(sanitizeString(firstName));
    }

    // Validate and add last name
    if (lastName !== undefined) {
      if (!isValidName(lastName)) {
        return res.status(400).json({ error: 'Invalid last name' });
      }
      updates.push(`last_name = $${++paramCount}`);
      values.push(sanitizeString(lastName));
    }

    // Validate and add email
    if (email !== undefined) {
      const cleanEmail = sanitizeEmail(email);
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email' });
      }
      // Check if email is taken by another user
      const existing = await queryOne(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [cleanEmail, req.userId]
      );
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${++paramCount}`);
      values.push(cleanEmail);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add user ID as last parameter
    values.push(req.userId);

    // Update user
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${++paramCount}`,
      values
    );

    // Check if profile is complete and update flag
    await updateProfileComplete(req.userId);

    // Get updated user
    const user = await queryOne(
      `SELECT id, email, username, first_name, last_name, gender, sexual_preference,
              biography, birth_date, latitude, longitude, city, country,
              is_profile_complete, fame_rating
       FROM users WHERE id = $1`,
      [req.userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PUT /api/users/location
 * Update user location
 */
router.put('/location', async (req, res) => {
  try {
    const { latitude, longitude, city, country, consent } = req.body;

    // Validate coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Invalid latitude' });
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid longitude' });
      }

      await query(
        `UPDATE users SET latitude = $1, longitude = $2, location_consent = $3 WHERE id = $4`,
        [lat, lng, consent === true, req.userId]
      );
    }

    // Update city/country if provided
    if (city !== undefined || country !== undefined) {
      const cleanCity = city ? xss(city.trim()).slice(0, 100) : null;
      const cleanCountry = country ? xss(country.trim()).slice(0, 100) : null;

      await query(
        `UPDATE users SET city = COALESCE($1, city), country = COALESCE($2, country) WHERE id = $3`,
        [cleanCity, cleanCountry, req.userId]
      );
    }

    // Check if profile is complete
    await updateProfileComplete(req.userId);

    const user = await queryOne(
      'SELECT latitude, longitude, city, country, location_consent FROM users WHERE id = $1',
      [req.userId]
    );

    res.json({
      message: 'Location updated successfully',
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        country: user.country,
        consent: user.location_consent
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * POST /api/users/photos
 * Upload a photo
 */
router.post('/photos', upload.single('photo'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo provided' });
    }

    // Check current photo count
    const photoCount = await queryOne(
      'SELECT COUNT(*) as count FROM photos WHERE user_id = $1',
      [req.userId]
    );

    if (parseInt(photoCount.count) >= 5) {
      return res.status(400).json({ error: 'Maximum 5 photos allowed' });
    }

    // Process and save image
    const { filename } = await processImage(req.file.buffer, req.userId);

    // Check if this is the first photo (make it profile picture)
    const isFirst = parseInt(photoCount.count) === 0;

    // Insert photo record
    const photo = await queryOne(
      `INSERT INTO photos (user_id, filename, is_profile_picture)
       VALUES ($1, $2, $3)
       RETURNING id, filename, is_profile_picture, created_at`,
      [req.userId, filename, isFirst]
    );

    // Update profile complete status
    await updateProfileComplete(req.userId);

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: {
        id: photo.id,
        url: `/uploads/${photo.filename}`,
        thumbnailUrl: `/uploads/thumb_${photo.filename}`,
        isProfilePicture: photo.is_profile_picture
      }
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload photo' });
  }
});

/**
 * DELETE /api/users/photos/:photoId
 * Delete a photo
 */
router.delete('/photos/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;

    // Get photo
    const photo = await queryOne(
      'SELECT id, filename, is_profile_picture FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, req.userId]
    );

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete from database
    await query('DELETE FROM photos WHERE id = $1', [photoId]);

    // Delete files
    await deleteImage(photo.filename);

    // If it was profile picture, set another one
    if (photo.is_profile_picture) {
      await query(
        `UPDATE photos SET is_profile_picture = true 
         WHERE user_id = $1 AND id = (SELECT id FROM photos WHERE user_id = $1 LIMIT 1)`,
        [req.userId]
      );
    }

    // Update profile complete status
    await updateProfileComplete(req.userId);

    res.json({ message: 'Photo deleted successfully' });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

/**
 * PUT /api/users/photos/:photoId/profile
 * Set photo as profile picture
 */
router.put('/photos/:photoId/profile', async (req, res) => {
  try {
    const { photoId } = req.params;

    // Verify photo belongs to user
    const photo = await queryOne(
      'SELECT id FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, req.userId]
    );

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Update in transaction
    await transaction(async (client) => {
      // Remove current profile picture flag
      await client.query(
        'UPDATE photos SET is_profile_picture = false WHERE user_id = $1',
        [req.userId]
      );
      // Set new profile picture
      await client.query(
        'UPDATE photos SET is_profile_picture = true WHERE id = $1',
        [photoId]
      );
    });

    res.json({ message: 'Profile picture updated' });

  } catch (error) {
    console.error('Set profile picture error:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

/**
 * GET /api/users/tags
 * Get all available tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await queryAll('SELECT id, name FROM tags ORDER BY name');
    res.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

/**
 * PUT /api/users/tags
 * Update user's tags
 */
router.put('/tags', async (req, res) => {
  try {
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }

    // Limit to 10 tags
    const limitedTags = tagIds.slice(0, 10).map(id => parseInt(id)).filter(id => !isNaN(id));

    await transaction(async (client) => {
      // Remove all current tags
      await client.query('DELETE FROM user_tags WHERE user_id = $1', [req.userId]);

      // Add new tags
      if (limitedTags.length > 0) {
        const values = limitedTags.map((tagId, i) => `($1, $${i + 2})`).join(', ');
        await client.query(
          `INSERT INTO user_tags (user_id, tag_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [req.userId, ...limitedTags]
        );
      }
    });

    // Get updated tags
    const tags = await queryAll(
      `SELECT t.id, t.name FROM tags t
       JOIN user_tags ut ON t.id = ut.tag_id
       WHERE ut.user_id = $1`,
      [req.userId]
    );

    res.json({ message: 'Tags updated', tags });

  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

/**
 * POST /api/users/tags
 * Create a new tag (if it doesn't exist) and add to user
 */
router.post('/tags', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Tag name required' });
    }

    // Clean and validate tag name
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Tag must be at least 2 characters' });
    }

    // Check user's current tag count
    const tagCount = await queryOne(
      'SELECT COUNT(*) as count FROM user_tags WHERE user_id = $1',
      [req.userId]
    );

    if (parseInt(tagCount.count) >= 10) {
      return res.status(400).json({ error: 'Maximum 10 tags allowed' });
    }

    // Insert tag if not exists, then link to user
    const tag = await queryOne(
      `INSERT INTO tags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [cleanName]
    );

    // Link to user
    await query(
      'INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, tag.id]
    );

    res.status(201).json({ tag });

  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

/**
 * Helper: Check and update profile completion status
 */
async function updateProfileComplete(userId) {
  const user = await queryOne(
    `SELECT gender, biography, birth_date,
            (SELECT COUNT(*) FROM photos WHERE user_id = $1) as photo_count,
            (city IS NOT NULL OR latitude IS NOT NULL) as has_location
     FROM users WHERE id = $1`,
    [userId]
  );

  const isComplete = user.gender !== null &&
                     user.biography !== null &&
                     user.biography.trim() !== '' &&
                     user.birth_date !== null &&
                     parseInt(user.photo_count) > 0 &&
                     user.has_location;

  await query(
    'UPDATE users SET is_profile_complete = $1 WHERE id = $2',
    [isComplete, userId]
  );

  return isComplete;
}

/**
 * Helper: Format user response
 */
function formatUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    gender: user.gender,
    sexualPreference: user.sexual_preference,
    biography: user.biography,
    birthDate: user.birth_date,
    location: {
      latitude: user.latitude,
      longitude: user.longitude,
      city: user.city,
      country: user.country
    },
    isProfileComplete: user.is_profile_complete,
    fameRating: user.fame_rating
  };
}

export default router;
