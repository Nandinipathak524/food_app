/**
 * Authentication Middleware
 *
 * Handles JWT verification and role-based access control.
 * All protected routes must use these middlewares.
 */

import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid token.'
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Please login again.'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
}

/**
 * Role-based access control middleware factory
 * @param {...string} allowedRoles - Roles that can access the route
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.id} (${req.user.role}) to ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource.'
      });
    }

    next();
  };
}

/**
 * Verify user owns the resource or is a doctor
 * Used for session access control
 */
export async function verifySessionAccess(req, res, next) {
  try {
    const sessionId = req.params.id || req.params.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required.'
      });
    }

    const [session] = await query(
      'SELECT patient_id, is_shared FROM screening_sessions WHERE id = ?',
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found.'
      });
    }

    // Patient can always access their own sessions
    if (req.user.role === 'patient') {
      if (session.patient_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only access your own sessions.'
        });
      }
    }

    // Doctor can only access shared sessions
    if (req.user.role === 'doctor') {
      if (!session.is_shared) {
        return res.status(403).json({
          success: false,
          error: 'This session is private and not shared with doctors.'
        });
      }
    }

    // Attach session info to request
    req.session = session;
    next();
  } catch (error) {
    logger.error('Session access verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify session access.'
    });
  }
}

/**
 * Rate limiting per user (simple in-memory implementation)
 * For production, use Redis-based rate limiting
 */
const rateLimitMap = new Map();

export function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create user's request history
    let requests = rateLimitMap.get(key) || [];

    // Filter requests within the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    if (requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.'
      });
    }

    requests.push(now);
    rateLimitMap.set(key, requests);

    next();
  };
}
