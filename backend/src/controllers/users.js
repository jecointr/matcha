import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, queryOne, queryAll } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const deleteAccount = async (req, res) => {
  const userId = req.userId;

  try {
    const photos = await queryAll(
      'SELECT filename FROM photos WHERE user_id = $1', 
      [userId]
    );

    if (photos.length > 0) {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      
      for (const photo of photos) {
        if (photo.filename) {
          const filePath = path.join(uploadsDir, photo.filename);
          try {
            await fs.unlink(filePath);
          } catch (err) {
            if (err.code !== 'ENOENT') {
              console.error(`Erreur suppression fichier ${photo.filename}:`, err);
            }
          }
        }
      }
    }

    await query('DELETE FROM users WHERE id = $1', [userId]);

    return res.status(200).json({ message: 'Compte supprimé avec succès' });

  } catch (error) {
    console.error('Erreur deleteAccount:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
  }
};

export const blockUser = async (req, res) => {
  const blockerId = req.userId;
  const { id: blockedId } = req.params;

  if (parseInt(blockerId) === parseInt(blockedId)) {
    return res.status(400).json({ error: "Vous ne pouvez pas vous bloquer vous-même" });
  }

  try {
    const userExists = await queryOne('SELECT id FROM users WHERE id = $1', [blockedId]);
    if (!userExists) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    await query(
      `INSERT INTO blocks (blocker_id, blocked_id) 
       VALUES ($1, $2) 
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );

    await query(
      `DELETE FROM likes 
       WHERE (liker_id = $1 AND liked_id = $2) 
          OR (liker_id = $2 AND liked_id = $1)`,
      [blockerId, blockedId]
    );
    
    res.json({ message: "Utilisateur bloqué avec succès" });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: "Erreur lors du blocage" });
  }
};

export const getBlockedUsers = async (req, res) => {
  const blockerId = req.userId;

  try {
    const blocked = await queryAll(
      `SELECT
         u.id, u.username, u.first_name, u.last_name,
         DATE_PART('year', AGE(u.birth_date)) as age,
         u.city, u.country, u.fame_rating, u.is_online,
         (SELECT filename FROM photos WHERE user_id = u.id AND is_profile_picture = true LIMIT 1) as profile_picture,
         b.created_at as blocked_at
       FROM blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [blockerId]
    );

    res.json({
      blocked: blocked.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        lastName: u.last_name,
        age: u.age ? parseInt(u.age) : null,
        city: u.city,
        country: u.country,
        fameRating: u.fame_rating,
        isOnline: u.is_online,
        profilePicture: u.profile_picture ? `/uploads/${u.profile_picture}` : null,
        blockedAt: u.blocked_at
      }))
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs bloqués" });
  }
};

export const unblockUser = async (req, res) => {
  const blockerId = req.userId;
  const { id: blockedId } = req.params;

  try {
    await query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );

    res.json({ message: "Utilisateur débloqué" });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: "Erreur lors du déblocage" });
  }
};