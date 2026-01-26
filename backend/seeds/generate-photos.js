/**
 * Generate placeholder photos for seeded profiles
 * Uses DiceBear API (v9) with fallback to UI Avatars
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

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          downloadImage(response.headers.location, filepath)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Status ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        try {
            const stats = fs.statSync(filepath);
            if (stats.size === 0) {
                fs.unlinkSync(filepath);
                reject(new Error('Empty file'));
            } else {
                resolve();
            }
        } catch (e) {
            reject(e);
        }
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });

    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
};

const getDiceBearUrl = (seed, gender) => {
  const style = 'avataaars';
  const safeSeed = encodeURIComponent(seed);
  
  let url = `https://api.dicebear.com/9.x/${style}/jpg?seed=${safeSeed}&size=400`;

  if (gender === 'male') {
    url += '&facialHairProbability=100';
    url += '&top=shortFlat,shortRound,theCaesar,shortCurly'; 
  } else {
    url += '&facialHairProbability=0';
    url += '&top=straight01,straight02,curvy,longButNotTooLong,bob';
  }
  
  return url;
};

const getFallbackUrl = (name) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=400&background=random&color=fff&bold=true&length=1`;
};

async function generatePhotos() {
  console.log('📸 Starting photo generation (Robust Mode)...\n');

  try {
    const usersResult = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.gender
      FROM users u
      LEFT JOIN photos p ON p.user_id = u.id
      WHERE p.id IS NULL
      ORDER BY u.id
    `);

    const users = usersResult.rows;
    console.log(`Found ${users.length} users without photos\n`);

    if (users.length === 0) return;

    let created = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const filename = `${user.id}_avatar_${Date.now()}.jpg`;
        const filepath = path.join(UPLOAD_DIR, filename);
        
        try {
            const avatarUrl = getDiceBearUrl(user.username, user.gender);
            await downloadImage(avatarUrl, filepath);
        } catch (err) {
            // console.log(`   ⚠️ DiceBear failed for ${user.username} (${err.message}), using fallback...`);
            const fallbackUrl = getFallbackUrl(user.first_name || user.username);
            await downloadImage(fallbackUrl, filepath);
        }

        const thumbFilename = `thumb_${filename}`;
        const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
        if (fs.existsSync(filepath)) {
            fs.copyFileSync(filepath, thumbPath);
        }

        await pool.query(`
          INSERT INTO photos (user_id, filename, is_profile_picture)
          VALUES ($1, $2, true)
        `, [user.id, filename]);

        created++;
        if (created % 50 === 0) console.log(`   ✓ Generated ${created}/${users.length} photos`);

        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (err) {
        errors++;
        console.error(`   ✗ FATAL Error for user ${user.id}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Photos created: ${created}`);
    console.log(`❌ Failures: ${errors}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await pool.end();
  }
}

generatePhotos();