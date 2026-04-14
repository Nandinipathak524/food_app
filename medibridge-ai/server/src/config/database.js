/**
 * Database Configuration
 *
 * Uses mysql2 with promise support for async/await queries.
 * Connection pool is used for better performance and connection management.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

// Support Railway's MYSQL_URL or individual env vars
const connectionConfig = process.env.MYSQL_URL
  ? { uri: process.env.MYSQL_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medibridge_ai',
    };

// Create connection pool for better performance
const pool = mysql.createPool({
  ...connectionConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/**
 * Execute a query with parameters
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, error: error.message });
    throw error;
  }
}

/**
 * Get a connection from the pool for transactions
 * @returns {Promise<import('mysql2/promise').PoolConnection>} Database connection
 */
export async function getConnection() {
  return pool.getConnection();
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
}

export default pool;
