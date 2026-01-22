import { verifyToken } from '../lib/jwt.js';
import { queryOne } from '../config/database.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Get user from database
    const user = await queryOne(
      `SELECT id, email, username, first_name, last_name, is_verified, is_profile_complete,
              gender, sexual_preference, biography, birth_date, latitude, longitude,
              city, country, is_online, fame_rating, created_at
       FROM users WHERE id = $1`,
      [decoded.userId]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token exists, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      
      if (decoded) {
        const user = await queryOne(
          `SELECT id, email, username, first_name, last_name, is_verified, is_profile_complete
           FROM users WHERE id = $1`,
          [decoded.userId]
        );
        
        if (user) {
          req.user = user;
          req.userId = user.id;
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};

/**
 * Require verified email middleware
 * Must be used after authenticate middleware
 */
export const requireVerified = (req, res, next) => {
  if (!req.user.is_verified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

/**
 * Require complete profile middleware
 * Must be used after authenticate middleware
 */
export const requireCompleteProfile = (req, res, next) => {
  if (!req.user.is_profile_complete) {
    return res.status(403).json({ 
      error: 'Profile completion required',
      code: 'PROFILE_INCOMPLETE'
    });
  }
  next();
};
