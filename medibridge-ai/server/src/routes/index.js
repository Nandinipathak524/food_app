/**
 * Main Router
 *
 * Aggregates all route modules and exports them.
 */

import { Router } from 'express';
import authRoutes from './auth.js';
import patientRoutes from './patient.js';
import doctorRoutes from './doctor.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'MediBridge AI API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/patient', patientRoutes);
router.use('/doctor', doctorRoutes);

export default router;
