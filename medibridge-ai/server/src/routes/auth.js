/**
 * Authentication Routes
 *
 * Public routes for registration and login.
 * Protected routes for profile management.
 */

import { Router } from 'express';
import authController from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../validators/index.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Protected routes
router.get('/me', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);

export default router;
