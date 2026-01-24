import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { queryOne, query } from './database.js';
import { generateRandomToken } from '../lib/jwt.js';

const handleProviderLogin = async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const providerId = profile.id;
    const provider = profile.provider;

    if (!email) {
      return done(new Error('No email found from provider'), null);
    }

    // 1. Chercher si l'utilisateur existe déjà via auth_id
    let user = await queryOne(
      'SELECT * FROM users WHERE auth_provider = $1 AND auth_id = $2',
      [provider, providerId]
    );

    if (user) {
      return done(null, user);
    }

    // 2. Chercher si l'email existe déjà (compte local existant)
    // On lie le compte OAuth au compte existant pour éviter les doublons
    user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);

    if (user) {
      await query(
        'UPDATE users SET auth_provider = $1, auth_id = $2, is_verified = true WHERE id = $3',
        [provider, providerId, user.id]
      );
      return done(null, user);
    }

    // 3. Créer un nouvel utilisateur
    // Générer un username unique basé sur le nom ou email
    let baseUsername = profile.username || email.split('@')[0];
    baseUsername = baseUsername.substring(0, 40); // Limite DB
    
    // Ajout d'un suffixe aléatoire pour garantir l'unicité
    const uniqueSuffix = Math.floor(Math.random() * 10000);
    const username = `${baseUsername}_${uniqueSuffix}`;

    const firstName = profile.name?.givenName || baseUsername;
    const lastName = profile.name?.familyName || 'User';

    const newUser = await queryOne(
      `INSERT INTO users (
        email, username, first_name, last_name, 
        auth_provider, auth_id, is_verified, is_profile_complete
       ) VALUES ($1, $2, $3, $4, $5, $6, true, false)
       RETURNING *`,
      [email, username, firstName, lastName, provider, providerId]
    );

    return done(null, newUser);

  } catch (error) {
    return done(error, null);
  }
};

// Configuration Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  handleProviderLogin
));

// Configuration GitHub
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback",
    scope: ['user:email']
  },
  handleProviderLogin
));

export default passport;