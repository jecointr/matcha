const { Client } = require('pg');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuration explicite pour le script (hors contexte Docker interne si lancé depuis l'hôte)
// Si lancé via Docker exec, les variables d'env du conteneur prendront le relais
const client = new Client({
    user: process.env.DB_USER || 'matcha_user',
    host: process.env.DB_HOST || 'localhost', // Attention: 'postgres' si dans docker, 'localhost' si hors docker
    database: process.env.DB_NAME || 'matcha_db',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    port: process.env.DB_PORT || 5432,
});

const SEED_COUNT = 500;

async function seed() {
    try {
        await client.connect();
        console.log('🌱 Connected to database...');

        // 1. Nettoyage (Ordre important à cause des Foreign Keys)
        console.log('🧹 Cleaning existing data...');
        await client.query('TRUNCATE TABLE notifications, messages, reports, blocks, visits, likes, user_tags, tags, images, users RESTART IDENTITY CASCADE');

        // 2. Création des Tags
        console.log('🏷️ Creating tags...');
        const interests = ['vegan', 'geek', 'piercing', 'gym', 'travel', 'photo', 'art', 'music', 'coding', 'foodie', 'nature', 'party', 'movies', 'pets', 'fashion'];
        const tagIds = [];
        
        for (const interest of interests) {
            const res = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [interest]);
            tagIds.push(res.rows[0].id);
        }

        // 3. Préparation du mot de passe hashé (le même pour tout le monde pour la vitesse)
        const passwordHash = await bcrypt.hash('Password123!', 10);

        // 4. Génération des Users
        console.log(`👤 Generating ${SEED_COUNT} users...`);
        
        for (let i = 0; i < SEED_COUNT; i++) {
            const sex = faker.person.sexType(); // 'male' or 'female'
            const firstName = faker.person.firstName(sex);
            const lastName = faker.person.lastName();
            const username = faker.internet.username({firstName, lastName}) + Math.floor(Math.random() * 1000);
            const email = faker.internet.email({firstName, lastName});
            
            // Localisation autour de Paris (48.8566, 2.3522) pour avoir des matchs proches
            const latitude = faker.location.latitude({ max: 49.0, min: 48.5 }); 
            const longitude = faker.location.longitude({ max: 2.7, min: 2.1 });

            // Orientation sexuelle aléatoire
            const orientations = ['heterosexual', 'gay', 'bisexual'];
            const sexualPref = orientations[Math.floor(Math.random() * orientations.length)];
            
            const userQuery = `
                INSERT INTO users (
                    username, email, password, first_name, last_name, 
                    is_verified, gender, sexual_preference, biography, 
                    fame_rating, latitude, longitude
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `;

            const userValues = [
                username,
                email,
                passwordHash,
                firstName,
                lastName,
                true, // is_verified
                sex,
                sexualPref,
                faker.lorem.paragraph(), // Bio
                faker.number.int({ min: 0, max: 500 }), // Fame rating
                latitude,
                longitude
            ];

            const res = await client.query(userQuery, userValues);
            const userId = res.rows[0].id;

            // 5. Ajout des images (URLs faker)
            const photoCount = faker.number.int({ min: 1, max: 5 });
            for (let j = 0; j < photoCount; j++) {
                await client.query(
                    'INSERT INTO images (user_id, file_path, is_profile_picture) VALUES ($1, $2, $3)',
                    [userId, faker.image.urlLoremFlickr({ category: 'people' }), j === 0] // La première est la photo de profil
                );
            }

            // 6. Ajout des Tags aléatoires (1 à 5 tags par user)
            const userTagsCount = faker.number.int({ min: 1, max: 5 });
            const shuffledTags = tagIds.sort(() => 0.5 - Math.random());
            const selectedTags = shuffledTags.slice(0, userTagsCount);
            
            for (const tagId of selectedTags) {
                await client.query(
                    'INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2)',
                    [userId, tagId]
                );
            }
            
            if (i % 50 === 0) process.stdout.write('.');
        }

        console.log('\n✅ Seeding complete!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
