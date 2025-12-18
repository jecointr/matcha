const db = require('../config/db');
const crypto = require('crypto'); // <--- LIGNE AJOUTÉE OBLIGATOIRE

// Trouver par email
const findByEmail = async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
};

// Trouver par username
const findByUsername = async (username) => {
    const query = 'SELECT * FROM users WHERE username = $1';
    const { rows } = await db.query(query, [username]);
    return rows[0];
};

// Créer un utilisateur
const createUser = async (user) => {
    const { username, email, password, firstName, lastName } = user;
    
    // Génération d'un token simple pour l'email (uuid)
    const verificationToken = crypto.randomUUID(); 
    
    const query = `
        INSERT INTO users (username, email, password, first_name, last_name, verification_token)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, first_name, last_name;
    `;
    
    const { rows } = await db.query(query, [username, email, password, firstName, lastName, verificationToken]);
    return rows[0];
};

module.exports = {
    findByEmail,
    findByUsername,
    createUser
};