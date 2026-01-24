import { Router } from 'express';
import { query, queryOne } from '../config/database.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { generateToken, generateRandomToken, getTokenExpiry } from '../lib/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js';
import { authenticate } from '../middlewares/auth.js';
// Imports pour l'OAuth Manuel
import { 
  getGoogleAuthURL, getGoogleUser, 
  getGithubAuthURL, getGithubUser, 
  handleOAuthUser 
} from '../lib/oauth.js';
import {
  validateRegistration,
  validateLogin,
  validatePassword,
  isValidEmail,
  sanitizeEmail,
  sanitizeUsername,
  sanitizeString
} from '../utils/validators.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, username, firstName, lastName, password, confirmPassword } = req.body;
    
    // Validate input
    const validation = validateRegistration({
      email,
      username,
      firstName,
      lastName,
      password,
      confirmPassword
    });
    
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    // Sanitize input
    const cleanEmail = sanitizeEmail(email);
    const cleanUsername = sanitizeUsername(username);
    const cleanFirstName = sanitizeString(firstName);
    const cleanLastName = sanitizeString(lastName);
    
    // Check if email already exists
    const existingEmail = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    );
    
    if (existingEmail) {
      return res.status(400).json({ errors: { email: 'Email already registered' } });
    }
    
    // Check if username already exists
    const existingUsername = await queryOne(
      'SELECT id FROM users WHERE username = $1',
      [cleanUsername]
    );
    
    if (existingUsername) {
      return res.status(400).json({ errors: { username: 'Username already taken' } });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate verification token
    const verificationToken = generateRandomToken();
    const verificationExpires = getTokenExpiry(24); // 24 hours
    
    // Insert user
    const result = await queryOne(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, verification_token, verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, username, first_name, last_name, created_at`,
      [cleanEmail, cleanUsername, passwordHash, cleanFirstName, cleanLastName, verificationToken, verificationExpires]
    );
    
    // Send verification email
    await sendVerificationEmail(cleanEmail, cleanUsername, verificationToken);
    
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        firstName: result.first_name,
        lastName: result.last_name
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    const validation = validateLogin({ username, password });
    
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    // Find user by username or email
    const cleanInput = sanitizeUsername(username);
    
    const user = await queryOne(
      `SELECT id, email, username, password_hash, first_name, last_name, 
              is_verified, is_profile_complete, gender, sexual_preference,
              biography, latitude, longitude, city, country, fame_rating
       FROM users 
       WHERE username = $1 OR email = $1`,
      [cleanInput]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Check if email is verified
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    // Update last seen and online status
    await query(
      'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Generate token
    const token = generateToken(user);
    
    // Return user data (without password)
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        isProfileComplete: user.is_profile_complete,
        gender: user.gender,
        sexualPreference: user.sexual_preference,
        biography: user.biography,
        location: user.city ? { city: user.city, country: user.country } : null,
        fameRating: user.fame_rating
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (update online status)
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await query(
      'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [req.userId]
    );
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify user's email address
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }
    
    // Find user with valid token
    const user = await queryOne(
      `SELECT id, username FROM users 
       WHERE verification_token = $1 AND verification_expires > CURRENT_TIMESTAMP`,
      [token]
    );
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    // Update user as verified
    await query(
      `UPDATE users SET is_verified = true, verification_token = NULL, verification_expires = NULL WHERE id = $1`,
      [user.id]
    );
    
    res.json({ message: 'Email verified successfully. You can now log in.' });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    const cleanEmail = sanitizeEmail(email);
    
    const user = await queryOne(
      'SELECT id, username, is_verified FROM users WHERE email = $1',
      [cleanEmail]
    );
    
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists, a verification email has been sent.' });
    }
    
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new token
    const verificationToken = generateRandomToken();
    const verificationExpires = getTokenExpiry(24);
    
    await query(
      'UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );
    
    await sendVerificationEmail(cleanEmail, user.username, verificationToken);
    
    res.json({ message: 'If an account exists, a verification email has been sent.' });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    const cleanEmail = sanitizeEmail(email);
    
    const user = await queryOne(
      'SELECT id, username FROM users WHERE email = $1',
      [cleanEmail]
    );
    
    // Always return same message (don't reveal if email exists)
    if (user) {
      const resetToken = generateRandomToken();
      const resetExpires = getTokenExpiry(1); // 1 hour
      
      await query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [resetToken, resetExpires, user.id]
      );
      
      await sendPasswordResetEmail(cleanEmail, user.username, resetToken);
    }
    
    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Reset token required' });
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ errors: { password: passwordValidation.errors[0] } });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ errors: { confirmPassword: 'Passwords do not match' } });
    }
    
    // Find user with valid reset token
    const user = await queryOne(
      `SELECT id FROM users 
       WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
      [token]
    );
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Hash new password
    const passwordHash = await hashPassword(password);
    
    // Update password and clear reset token
    await query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [passwordHash, user.id]
    );
    
    res.json({ message: 'Password reset successful. You can now log in.' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Get user photos
    const photos = await query(
      'SELECT id, filename, is_profile_picture FROM photos WHERE user_id = $1 ORDER BY is_profile_picture DESC',
      [req.userId]
    );
    
    // Get user tags
    const tags = await query(
      `SELECT t.id, t.name FROM tags t
       JOIN user_tags ut ON t.id = ut.tag_id
       WHERE ut.user_id = $1`,
      [req.userId]
    );
    
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        isVerified: req.user.is_verified,
        isProfileComplete: req.user.is_profile_complete,
        gender: req.user.gender,
        sexualPreference: req.user.sexual_preference,
        biography: req.user.biography,
        birthDate: req.user.birth_date,
        location: req.user.city ? {
          latitude: req.user.latitude,
          longitude: req.user.longitude,
          city: req.user.city,
          country: req.user.country
        } : null,
        fameRating: req.user.fame_rating,
        photos: photos.rows,
        tags: tags.rows,
        createdAt: req.user.created_at
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// --- OAUTH ROUTES (VERSION MANUELLE) ---

// 1. Google Login
router.get('/google', (req, res) => {
  // Redirection manuelle vers l'URL Google construite dans lib/oauth.js
  res.redirect(getGoogleAuthURL());
});

// 2. Google Callback
router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) throw new Error('No code provided');

    // Récupération manuelle des infos Google
    const googleProfile = await getGoogleUser(code);
    
    // Logique métier (création/lien en base)
    const user = await handleOAuthUser('google', googleProfile);

    // Connexion réussie : Token + Redirect
    handleOAuthSuccess(user, res);
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
});

// 3. GitHub Login
router.get('/github', (req, res) => {
  // Redirection manuelle vers l'URL GitHub
  res.redirect(getGithubAuthURL());
});

// 4. GitHub Callback
router.get('/github/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) throw new Error('No code provided');

    const githubProfile = await getGithubUser(code);
    const user = await handleOAuthUser('github', githubProfile);

    handleOAuthSuccess(user, res);
  } catch (error) {
    console.error('GitHub Auth Error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
});

// Helper pour finaliser la connexion OAuth
const handleOAuthSuccess = async (user, res) => {
    // Mettre à jour le statut en ligne
    await query(
      'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const token = generateToken(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    res.redirect(`${frontendUrl}/login?token=${token}`);
};

export default router;