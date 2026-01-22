/**
 * Seed script to generate 500+ realistic profiles
 * Run with: docker exec -it matcha_backend npm run seed
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'matcha_user',
  password: process.env.DB_PASSWORD || 'your_secure_password_here',
  database: process.env.DB_NAME || 'matcha_db',
});

// Data for generating realistic profiles
const FIRST_NAMES_MALE = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Joseph', 'Thomas',
  'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven',
  'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy',
  'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas',
  'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
  'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis',
  'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Zachary', 'Henry', 'Douglas',
  'Peter', 'Kyle', 'Noah', 'Ethan', 'Jeremy', 'Walter', 'Christian', 'Keith', 'Roger',
  'Albert', 'Arthur', 'Lawrence', 'Dylan', 'Jesse', 'Jordan', 'Bryan', 'Billy', 'Bruce'
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly',
  'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah',
  'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela',
  'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha',
  'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria',
  'Heather', 'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia', 'Victoria', 'Kelly',
  'Lauren', 'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan', 'Andrea', 'Cheryl', 'Hannah',
  'Jacqueline', 'Martha', 'Gloria', 'Teresa', 'Ann', 'Sara', 'Madison', 'Frances', 'Kathryn'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter',
  'Roberts', 'Turner', 'Phillips', 'Evans', 'Parker', 'Edwards', 'Collins', 'Stewart',
  'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey'
];

// Cities with approximate coordinates
const CITIES = [
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698 },
  { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442 },
  { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620 },
  { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792 },
  { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573 },
  { city: 'Strasbourg', country: 'France', lat: 48.5734, lng: 7.7521 },
  { city: 'Montpellier', country: 'France', lat: 43.6108, lng: 3.8767 },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
  { city: 'Manchester', country: 'UK', lat: 53.4808, lng: -2.2426 },
  { city: 'Birmingham', country: 'UK', lat: 52.4862, lng: -1.8904 },
  { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
  { city: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820 },
  { city: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { city: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517 },
  { city: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
];

const BIOGRAPHIES = [
  "Love exploring new places and trying different cuisines. Always up for an adventure! 🌍",
  "Coffee addict ☕ | Dog lover 🐕 | Looking for someone to share lazy Sunday mornings with.",
  "Tech enthusiast by day, amateur chef by night. Let's cook something up together!",
  "Fitness junkie who also appreciates a good Netflix binge. Balance is key, right?",
  "Music is my therapy. From jazz to electronic, I love it all. Let's share playlists!",
  "Bookworm seeking someone to discuss the latest page-turner with. Currently reading sci-fi.",
  "Passionate about photography and capturing life's beautiful moments. 📸",
  "Yoga practitioner, mindfulness advocate. Looking for genuine connections.",
  "Sports enthusiast - football, tennis, you name it! Looking for my teammate in life.",
  "Art lover and occasional painter. Museums and galleries are my happy place.",
  "Traveler at heart. 30 countries and counting! Where should we go next?",
  "Foodie who believes the way to the heart is through the stomach. 🍝",
  "Outdoor enthusiast - hiking, camping, kayaking. Nature is my happy place.",
  "Movie buff with a soft spot for classic cinema. Popcorn is always a good idea.",
  "Entrepreneur with big dreams. Looking for someone equally ambitious.",
  "Simple person with simple pleasures. Good conversation and genuine laughs.",
  "Animal lover, especially cats 🐱. They're basically my roommates.",
  "Dance like nobody's watching! Salsa, bachata, or just kitchen dancing.",
  "Gamer and proud! Looking for my player 2. 🎮",
  "Wine enthusiast exploring the world one glass at a time. 🍷",
  "Meditation and mindfulness help me stay grounded. Seeking similar vibes.",
  "History nerd who loves visiting old castles and learning about the past.",
  "Volunteer at local shelter. Compassion is my superpower.",
  "Stand-up comedy fan. If you can make me laugh, you're halfway there!",
  "Podcast addict. Always looking for new recommendations.",
  "DIY enthusiast. My apartment is full of projects in progress.",
  "Language learner - currently working on my 4th language!",
  "Beach person who dreams of living by the ocean someday. 🏖️",
  "Mountain lover. Nothing beats the view from the top after a good hike.",
  "Sustainability advocate trying to live more eco-friendly every day. 🌱",
];

const TAGS = [
  'photography', 'travel', 'music', 'movies', 'gaming', 'fitness', 'yoga', 'cooking',
  'reading', 'art', 'hiking', 'dancing', 'technology', 'fashion', 'sports', 'nature',
  'animals', 'coffee', 'wine', 'vegan', 'foodie', 'netflix', 'beach', 'mountains',
  'science', 'meditation', 'running', 'cycling', 'swimming', 'camping'
];

// Helper functions
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

const generateBirthDate = () => {
  const minAge = 18;
  const maxAge = 55;
  const age = randomInt(minAge, maxAge);
  const year = new Date().getFullYear() - age;
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const generateUsername = (firstName, lastName, index) => {
  const variants = [
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${randomInt(1, 999)}`,
    `${firstName.toLowerCase()}_${randomInt(1, 99)}`,
    `${lastName.toLowerCase()}${firstName[0].toLowerCase()}${randomInt(1, 99)}`,
  ];
  return `${randomElement(variants)}_${index}`;
};

const addLocationVariance = (lat, lng) => {
  // Add small random variance (roughly within same city area)
  const latVariance = randomFloat(-0.1, 0.1);
  const lngVariance = randomFloat(-0.1, 0.1);
  return {
    lat: parseFloat((lat + latVariance).toFixed(6)),
    lng: parseFloat((lng + lngVariance).toFixed(6))
  };
};

async function seed() {
  console.log('🌱 Starting seed process...\n');

  try {
    // Get existing tags
    const tagsResult = await pool.query('SELECT id, name FROM tags');
    const existingTags = tagsResult.rows;
    console.log(`📌 Found ${existingTags.length} existing tags`);

    // Hash a common password for all seed users (for testing)
    const passwordHash = await bcrypt.hash('Password123!', 12);
    console.log('🔐 Generated password hash');

    const TOTAL_USERS = 500;
    let created = 0;
    let errors = 0;

    console.log(`\n👥 Creating ${TOTAL_USERS} profiles...\n`);

    for (let i = 0; i < TOTAL_USERS; i++) {
      try {
        // Determine gender (roughly 50/50)
        const isMale = Math.random() > 0.5;
        const gender = isMale ? 'male' : 'female';
        
        // Generate profile data
        const firstName = isMale 
          ? randomElement(FIRST_NAMES_MALE) 
          : randomElement(FIRST_NAMES_FEMALE);
        const lastName = randomElement(LAST_NAMES);
        const username = generateUsername(firstName, lastName, i);
        const email = `${username}@example.com`;
        
        // Sexual preference (weighted: 70% opposite, 20% both, 10% same)
        const prefRandom = Math.random();
        let sexualPreference;
        if (prefRandom < 0.7) {
          sexualPreference = isMale ? 'female' : 'male';
        } else if (prefRandom < 0.9) {
          sexualPreference = 'both';
        } else {
          sexualPreference = isMale ? 'male' : 'female';
        }

        // Location
        const location = randomElement(CITIES);
        const { lat, lng } = addLocationVariance(location.lat, location.lng);

        // Biography
        const biography = randomElement(BIOGRAPHIES);

        // Fame rating (bell curve distribution)
        const fameRating = Math.min(100, Math.max(0, 
          Math.round(50 + (Math.random() - 0.5) * 60)
        ));

        // Insert user
        const userResult = await pool.query(`
          INSERT INTO users (
            email, username, password_hash, first_name, last_name,
            is_verified, is_profile_complete, gender, sexual_preference,
            biography, birth_date, latitude, longitude, city, country,
            fame_rating, is_online, last_seen
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id
        `, [
          email, username, passwordHash, firstName, lastName,
          true, true, gender, sexualPreference,
          biography, generateBirthDate(), lat, lng, location.city, location.country,
          fameRating, Math.random() > 0.8, new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000))
        ]);

        const userId = userResult.rows[0].id;

        // Add random tags (3-7 tags per user)
        const numTags = randomInt(3, 7);
        const shuffledTags = [...existingTags].sort(() => Math.random() - 0.5);
        const selectedTags = shuffledTags.slice(0, numTags);

        for (const tag of selectedTags) {
          await pool.query(
            'INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, tag.id]
          );
        }

        created++;

        // Progress indicator
        if ((i + 1) % 50 === 0) {
          console.log(`   ✓ Created ${i + 1}/${TOTAL_USERS} profiles`);
        }

      } catch (err) {
        errors++;
        if (errors < 5) {
          console.error(`   ✗ Error creating profile ${i}:`, err.message);
        }
      }
    }

    // Generate some likes/matches between users
    console.log('\n💕 Generating likes and matches...');
    
    const usersResult = await pool.query('SELECT id FROM users ORDER BY id');
    const userIds = usersResult.rows.map(r => r.id);
    
    let likesCreated = 0;
    const targetLikes = 2000; // Generate ~2000 likes

    for (let i = 0; i < targetLikes; i++) {
      const likerId = randomElement(userIds);
      const likedId = randomElement(userIds);
      
      if (likerId !== likedId) {
        try {
          await pool.query(
            'INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [likerId, likedId]
          );
          likesCreated++;
        } catch (err) {
          // Ignore duplicate errors
        }
      }
    }

    console.log(`   ✓ Created ${likesCreated} likes`);

    // Generate some profile visits
    console.log('\n👀 Generating profile visits...');
    
    let visitsCreated = 0;
    const targetVisits = 3000;

    for (let i = 0; i < targetVisits; i++) {
      const visitorId = randomElement(userIds);
      const visitedId = randomElement(userIds);
      
      if (visitorId !== visitedId) {
        try {
          await pool.query(
            'INSERT INTO profile_visits (visitor_id, visited_id, visited_at) VALUES ($1, $2, $3)',
            [visitorId, visitedId, new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000))]
          );
          visitsCreated++;
        } catch (err) {
          // Ignore errors
        }
      }
    }

    console.log(`   ✓ Created ${visitsCreated} profile visits`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SEED SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Profiles created: ${created}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`💕 Likes created: ${likesCreated}`);
    console.log(`👀 Visits created: ${visitsCreated}`);
    console.log('='.repeat(50));
    console.log('\n🎉 Seed completed successfully!\n');
    console.log('📝 Test credentials for all seeded users:');
    console.log('   Password: Password123!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seed
seed();