import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, queryAll } from '../config/database.js';

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