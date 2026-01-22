/**
 * Manual validators - No external validation library (per project requirements)
 */

// Common weak passwords list (top 100 most common)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'shadow', '123123', '654321', 'superman', 'qazwsx',
  'michael', 'football', 'password1', 'password123', 'batman', 'login',
  'admin', 'welcome', 'hello', 'charlie', 'donald', 'password2', 'qwerty123',
  'admin123', 'root', 'toor', 'pass', 'test', 'guest', 'master123', 'changeme',
  'passwd', 'administrator', 'manager', 'love', 'soccer', 'killer', 'george',
  'princess', 'pepper', 'joshua', 'computer', 'hockey', 'access', 'thunder',
  'starwars', 'asshole', 'jennifer', 'hunter', 'ginger', 'jessica', 'andrew',
  'matthew', 'michelle', 'hannah', 'william', 'austin', 'nicole', 'daniel',
  'zxcvbn', 'fuckyou', 'jordan', 'andrew', 'taylor', 'robert', 'thomas',
  'joseph', 'james', 'john', 'david', 'liverpool', 'arsenal', 'chelsea',
  'daniel123', 'guitar', 'summer', 'buster', 'yankees', 'corvette', 'cheese',
  'cookie', 'merlin', 'wizard', 'purple', 'orange', 'yellow', 'flower'
]);

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return email.length <= 255 && emailRegex.test(email);
};

/**
 * Validate username (alphanumeric, 3-50 chars)
 */
export const isValidUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
};

/**
 * Validate password strength
 * - At least 8 characters
 * - Contains uppercase, lowercase, number, special char
 * - Not a common password
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger password');
  }
  
  return { valid: errors.length === 0, errors };
};

/**
 * Validate name (first name or last name)
 */
export const isValidName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  // Allow letters, spaces, hyphens, apostrophes (for names like O'Connor, Jean-Pierre)
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{1,100}$/;
  return trimmed.length >= 1 && trimmed.length <= 100 && nameRegex.test(trimmed);
};

/**
 * Sanitize string input (basic XSS prevention)
 */
export const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .slice(0, 1000); // Limit length
};

/**
 * Sanitize email (lowercase and trim)
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 255);
};

/**
 * Sanitize username (lowercase and trim)
 */
export const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') return '';
  return username.trim().toLowerCase().slice(0, 50);
};

/**
 * Validate registration input
 */
export const validateRegistration = (data) => {
  const errors = {};
  
  // Email
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Invalid email format';
  }
  
  // Username
  if (!data.username) {
    errors.username = 'Username is required';
  } else if (!isValidUsername(data.username)) {
    errors.username = 'Username must be 3-50 characters (letters, numbers, _ -)';
  }
  
  // First name
  if (!data.firstName) {
    errors.firstName = 'First name is required';
  } else if (!isValidName(data.firstName)) {
    errors.firstName = 'Invalid first name';
  }
  
  // Last name
  if (!data.lastName) {
    errors.lastName = 'Last name is required';
  } else if (!isValidName(data.lastName)) {
    errors.lastName = 'Invalid last name';
  }
  
  // Password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.errors[0];
  }
  
  // Confirm password
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate login input
 */
export const validateLogin = (data) => {
  const errors = {};
  
  if (!data.username) {
    errors.username = 'Username is required';
  }
  
  if (!data.password) {
    errors.password = 'Password is required';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};
