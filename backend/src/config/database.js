import pg from 'pg';
const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Event listeners for debugging
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Connect to database
 */
export const connectDB = async () => {
  const client = await pool.connect();
  client.release();
  return true;
};

/**
 * Test database connection
 */
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
};

/**
 * Execute a query with parameters (protection against SQL injection)
 * @param {string} text - SQL query with $1, $2, etc. placeholders
 * @param {Array} params - Parameters array
 * @returns {Promise<Object>} Query result
 */
export const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production' && duration > 100) {
      console.log('Slow query:', { text, duration: `${duration}ms`, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Query error:', { text, error: error.message });
    throw error;
  }
};

/**
 * Execute a single query and return first row or null
 * @param {string} text - SQL query
 * @param {Array} params - Parameters
 * @returns {Promise<Object|null>} First row or null
 */
export const queryOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

/**
 * Execute a query and return all rows
 * @param {string} text - SQL query
 * @param {Array} params - Parameters
 * @returns {Promise<Array>} Array of rows
 */
export const queryAll = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows;
};

/**
 * Get a client from pool for transactions
 * @returns {Promise<Object>} Pool client
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function receiving client
 * @returns {Promise<any>} Result of callback
 */
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
