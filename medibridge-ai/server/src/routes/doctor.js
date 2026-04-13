/**
 * Doctor Routes
 *
 * All routes require authentication and doctor role.
 * Handles patient viewing, notes, questions, and PDF download.
 */

import { Router } from 'express';
import doctorController from '../controllers/doctor.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, addNoteSchema, replySchema } from '../validators/index.js';

const router = Router();

// All routes require authentication and doctor role
router.use(authenticate, authorize('doctor'));

// Dashboard
router.get('/stats', doctorController.getStats);
router.get('/patients', doctorController.getPatients);
router.get('/questions', doctorController.getPendingQuestions);

// Session details
router.get('/session/:id', doctorController.getSessionDetails);

// Communication
router.post('/session/:id/reply', doctorController.replyToQuestion);
router.post('/session/:id/ask', validate(replySchema), doctorController.askPatient);

// Clinical notes
router.post('/session/:id/note', validate(addNoteSchema), doctorController.addNote);

// PDF download
router.get('/session/:id/pdf', doctorController.downloadPDF);

// Report file viewing
router.get('/report/:reportId/file', doctorController.viewReportFile);

export default router;
