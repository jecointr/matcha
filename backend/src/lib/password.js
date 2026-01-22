import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if match
 */
export const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
