/**
 * Authentication Controller
 *
 * Handles user registration and login with JWT tokens.
 * Passwords are hashed using bcryptjs.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

const SALT_ROUNDS = 10;

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const {
      name,
      email,
      password,
      role,
      hospital_id,
      language,
      specialization,
      license_number,
      date_of_birth,
      phone
    } = req.body;

    // Check if email already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }

    // Validate doctor-specific fields
    if (role === 'doctor') {
      if (!specialization || !license_number) {
        return res.status(400).json({
          success: false,
          error: 'Doctors must provide specialization and license number'
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate unique ID
    const userId = uuidv4();

    // Insert user
    await query(
      `INSERT INTO users
       (id, name, email, password_hash, role, hospital_id, language, specialization, license_number, date_of_birth, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        email,
        passwordHash,
        role || 'patient',
        hospital_id || null,
        language || 'en',
        specialization || null,
        license_number || null,
        date_of_birth || null,
        phone || null
      ]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: userId,
        email,
        role: role || 'patient',
        name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('New user registered', { userId, email, role });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: userId,
          name,
          email,
          role: role || 'patient',
          language: language || 'en'
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const users = await query(
      'SELECT id, name, email, password_hash, role, language, hospital_id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language,
          hospital_id: user.hospital_id
        },
        token
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
export async function getProfile(req, res) {
  try {
    const users = await query(
      `SELECT id, name, email, role, language, hospital_id, specialization, license_number, date_of_birth, phone, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language,
          hospital_id: user.hospital_id,
          specialization: user.specialization,
          license_number: user.license_number,
          date_of_birth: user.date_of_birth,
          phone: user.phone,
          created_at: user.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
}

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export async function updateProfile(req, res) {
  try {
    const { name, language, phone, date_of_birth } = req.body;

    await query(
      `UPDATE users SET
        name = COALESCE(?, name),
        language = COALESCE(?, language),
        phone = COALESCE(?, phone),
        date_of_birth = COALESCE(?, date_of_birth)
       WHERE id = ?`,
      [name, language, phone, date_of_birth, req.user.id]
    );

    logger.info('User profile updated', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
}

export default {
  register,
  login,
  getProfile,
  updateProfile
};
