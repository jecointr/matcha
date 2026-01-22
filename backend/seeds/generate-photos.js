/**
 * Generate placeholder photos for seeded profiles
 * Uses DiceBear API for avatar generation
 * Run with: docker exec -it matcha_backend node seeds/generate-photos.js
 */

import pg from 'pg';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'matcha_user',
  password: process.env.DB_PASSWORD || 'your_secure_password_here',
  database: process.env.DB_NAME || 'matcha_db',
});

const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Download image from URL
const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
};

// Generate avatar URL using DiceBear (free avatar API)
const getAvatarUrl = (seed, gender) => {
  // Using "avataaars" style which looks like cartoon people
  const style = 'avataaars';
  // Add some randomness based on gender
  const options = gender === 'male' 
    ? 'top=shortHair&facialHair=beardLight,beardMajestic,moustacheFancy'
    : 'top=longHair,straight,curly&facialHair=blank';
  
  return `https://api.dicebear.com/7.x/${style}/jpg?seed=${seed}&size=400&${options}`;
};

// Alternative: Use UI Avatars for simple letter-based avatars
const getSimpleAvatarUrl = (name, background) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=400&background=${background}&color=fff&bold=true`;
};

async function generatePhotos() {
  console.log('📸 Starting photo generation...\n');

  try {
    // Get users without photos
    const usersResult = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.gender
      FROM users u
      LEFT JOIN photos p ON p.user_id = u.id
      WHERE p.id IS NULL
      ORDER BY u.id
    `);

    const users = usersResult.rows;
    console.log(`Found ${users.length} users without photos\n`);

    if (users.length === 0) {
      console.log('All users already have photos!');
      return;
    }

    let created = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const filename = `${user.id}_avatar_${Date.now()}.jpg`;
        const filepath = path.join(UPLOAD_DIR, filename);
        
        // Generate avatar URL
        const avatarUrl = getAvatarUrl(user.username, user.gender);
        
        // Download the image
        await downloadImage(avatarUrl, filepath);

        // Also create thumbnail (same image for simplicity)
        const thumbFilename = `thumb_${filename}`;
        const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
        fs.copyFileSync(filepath, thumbPath);

        // Insert photo record
        await pool.query(`
          INSERT INTO photos (user_id, filename, is_profile_picture)
          VALUES ($1, $2, true)
        `, [user.id, filename]);

        created++;

        if (created % 50 === 0) {
          console.log(`   ✓ Generated ${created}/${users.length} photos`);
        }

        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        errors++;
        if (errors < 5) {
          console.error(`   ✗ Error for user ${user.id}:`, err.message);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 PHOTO GENERATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Photos created: ${created}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    console.log('\n🎉 Photo generation completed!\n');

  } catch (error) {
    console.error('❌ Photo generation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generatePhotos();