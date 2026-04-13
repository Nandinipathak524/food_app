/**
 * Patient Routes
 *
 * All routes require authentication and patient role.
 * Handles screening sessions, follow-ups, reports, and privacy.
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import patientController from '../controllers/patient.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validate,
  createSessionSchema,
  answerFollowupSchema,
  togglePrivacySchema,
  askReportQuestionSchema
} from '../validators/index.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// All routes require authentication and patient role
router.use(authenticate, authorize('patient'));

// Session management
router.post('/session', validate(createSessionSchema), patientController.createSession);
router.get('/sessions', patientController.getSessions);
router.get('/session/:id', patientController.getSessionDetails);

// Follow-up answers
router.post('/session/:id/answer', validate(answerFollowupSchema), patientController.answerFollowup);

// Report upload
router.post('/session/:id/upload-report', upload.single('report'), patientController.uploadReport);

// Ask question about report
router.post(
  '/session/:sessionId/report/:reportId/ask',
  validate(askReportQuestionSchema),
  patientController.askReportQuestion
);

// Privacy control
router.post('/session/:id/privacy-toggle', validate(togglePrivacySchema), patientController.togglePrivacy);

// Ask doctor
router.post('/session/:id/ask-doctor', patientController.askDoctor);

// Error handler for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File is too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${error.message}`
    });
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
});

export default router;
