/**
 * Patient Controller
 *
 * Handles patient screening sessions, symptom intake,
 * follow-up answers, report uploads, and privacy settings.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, getConnection } from '../config/database.js';
import llmService from '../services/llm.js';
import ocrService from '../services/ocr.js';
import logger from '../utils/logger.js';

/**
 * Create a new screening session
 * POST /api/patient/session
 */
export async function createSession(req, res) {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const patientId = req.user.id;
    const {
      symptoms,
      duration,
      severity,
      age,
      gender,
      existing_conditions
    } = req.body;

    // Generate session ID
    const sessionId = uuidv4();

    // Detect language and translate if needed
    const { text: processedSymptoms, originalLanguage } = await llmService.translateIfNeeded(symptoms);

    // Insert session with initial intake data
    await connection.execute(
      `INSERT INTO screening_sessions
       (id, patient_id, symptoms, duration, severity, age, gender, existing_conditions, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake')`,
      [
        sessionId,
        patientId,
        processedSymptoms,
        duration || null,
        severity || 'moderate',
        age || null,
        gender || null,
        existing_conditions || null
      ]
    );

    // Generate AI follow-up questions
    const patientData = {
      symptoms: processedSymptoms,
      duration,
      severity,
      age,
      gender,
      existing_conditions
    };

    const followupQuestions = await llmService.generateFollowupQuestions(patientData);

    // Store follow-up questions in database
    for (const q of followupQuestions) {
      const questionId = uuidv4();
      await connection.execute(
        `INSERT INTO followup_qa (id, session_id, question, asked_by, question_type, is_answered)
         VALUES (?, ?, ?, 'ai', ?, FALSE)`,
        [questionId, sessionId, q.question, q.question_type || 'general']
      );
    }

    // Update session with AI followup JSON
    await connection.execute(
      `UPDATE screening_sessions SET ai_followup_json = ?, status = 'followup' WHERE id = ?`,
      [JSON.stringify(followupQuestions), sessionId]
    );

    await connection.commit();

    logger.info('New screening session created', {
      sessionId,
      patientId,
      questionCount: followupQuestions.length
    });

    // Fetch created questions with IDs
    const [questions] = await connection.execute(
      'SELECT id, question, question_type FROM followup_qa WHERE session_id = ? AND asked_by = "ai"',
      [sessionId]
    );

    res.status(201).json({
      success: true,
      message: 'Screening session created. Please answer the follow-up questions.',
      data: {
        sessionId,
        followupQuestions: questions,
        originalLanguage,
        status: 'followup'
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create screening session'
    });
  } finally {
    connection.release();
  }
}

/**
 * Answer follow-up questions
 * POST /api/patient/session/:id/answer
 */
export async function answerFollowup(req, res) {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const { id: sessionId } = req.params;
    const { answers } = req.body;
    const patientId = req.user.id;

    // Verify session belongs to patient
    const [sessions] = await connection.execute(
      'SELECT * FROM screening_sessions WHERE id = ? AND patient_id = ?',
      [sessionId, patientId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessions[0];

    // Update each answer
    for (const { questionId, answer } of answers) {
      await connection.execute(
        `UPDATE followup_qa
         SET answer = ?, is_answered = TRUE, answered_at = NOW()
         WHERE id = ? AND session_id = ?`,
        [answer, questionId, sessionId]
      );
    }

    // Fetch all Q&A for risk assessment
    const [allQA] = await connection.execute(
      'SELECT question, answer FROM followup_qa WHERE session_id = ? AND is_answered = TRUE',
      [sessionId]
    );

    // Perform risk assessment
    const patientData = {
      symptoms: session.symptoms,
      duration: session.duration,
      severity: session.severity,
      age: session.age,
      gender: session.gender,
      existing_conditions: session.existing_conditions
    };

    const riskAssessment = await llmService.assessRisk(patientData, allQA);

    // Generate doctor summary
    const summary = await llmService.generateDoctorSummary(patientData, allQA);

    // Update session with risk level and summary
    await connection.execute(
      `UPDATE screening_sessions SET
        risk_level = ?,
        risk_explanation = ?,
        raw_llm_output = ?,
        safe_ai_summary = ?,
        status = 'reviewed'
       WHERE id = ?`,
      [
        riskAssessment.risk_level,
        riskAssessment.explanation,
        summary.raw,
        summary.sanitized,
        sessionId
      ]
    );

    await connection.commit();

    logger.info('Follow-up answers submitted', {
      sessionId,
      riskLevel: riskAssessment.risk_level
    });

    res.json({
      success: true,
      message: 'Answers submitted successfully',
      data: {
        riskLevel: riskAssessment.risk_level,
        riskExplanation: riskAssessment.explanation,
        recommendation: riskAssessment.recommendation,
        summary: summary.sanitized,
        status: 'reviewed'
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Answer followup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process answers'
    });
  } finally {
    connection.release();
  }
}

/**
 * Upload medical report (PDF)
 * POST /api/patient/session/:id/upload-report
 */
export async function uploadReport(req, res) {
  try {
    const { id: sessionId } = req.params;
    const patientId = req.user.id;

    // Verify session belongs to patient
    const sessions = await query(
      'SELECT id FROM screening_sessions WHERE id = ? AND patient_id = ?',
      [sessionId, patientId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.file;
    const reportId = uuidv4();

    // Insert report record with pending status
    await query(
      `INSERT INTO medical_reports
       (id, session_id, file_url, original_filename, file_size, mime_type, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, 'processing')`,
      [
        reportId,
        sessionId,
        file.path,
        file.originalname,
        file.size,
        file.mimetype
      ]
    );

    // Extract text from PDF
    const extraction = await ocrService.extractTextFromPDF(file.path);
    const cleanedText = ocrService.cleanExtractedText(extraction.text);
    const reportType = ocrService.identifyReportType(cleanedText);

    // Generate AI summary of the report
    let aiSummary = '';
    if (cleanedText) {
      aiSummary = await llmService.analyzeReport(cleanedText, reportType);
    } else {
      aiSummary = 'Unable to extract text from this document. It may be a scanned image. Please discuss this report directly with your doctor.';
    }

    // Update report with extracted data
    await query(
      `UPDATE medical_reports SET
        extracted_text = ?,
        ai_report_summary = ?,
        report_type = ?,
        processing_status = 'completed'
       WHERE id = ?`,
      [cleanedText, aiSummary, reportType, reportId]
    );

    logger.info('Report uploaded and processed', {
      reportId,
      sessionId,
      reportType
    });

    res.status(201).json({
      success: true,
      message: 'Report uploaded and processed successfully',
      data: {
        reportId,
        reportType,
        summary: aiSummary,
        canAskQuestions: cleanedText.length > 0
      }
    });
  } catch (error) {
    logger.error('Upload report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload and process report'
    });
  }
}

/**
 * Ask question about a report
 * POST /api/patient/session/:sessionId/report/:reportId/ask
 */
export async function askReportQuestion(req, res) {
  try {
    const { sessionId, reportId } = req.params;
    const { question } = req.body;
    const patientId = req.user.id;

    // Verify session and report belong to patient
    const reports = await query(
      `SELECT mr.* FROM medical_reports mr
       JOIN screening_sessions ss ON mr.session_id = ss.id
       WHERE mr.id = ? AND ss.id = ? AND ss.patient_id = ?`,
      [reportId, sessionId, patientId]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const report = reports[0];

    if (!report.ai_report_summary) {
      return res.status(400).json({
        success: false,
        error: 'Report has not been processed yet'
      });
    }

    // Generate answer using LLM
    const answer = await llmService.answerReportQuestion(report.ai_report_summary, question);

    // Store the Q&A
    const qaId = uuidv4();
    await query(
      `INSERT INTO followup_qa (id, session_id, question, answer, asked_by, question_type, is_answered, answered_at)
       VALUES (?, ?, ?, ?, 'patient', 'report', TRUE, NOW())`,
      [qaId, sessionId, question, answer]
    );

    res.json({
      success: true,
      data: {
        question,
        answer
      }
    });
  } catch (error) {
    logger.error('Ask report question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process question'
    });
  }
}

/**
 * Toggle privacy setting for a session
 * POST /api/patient/session/:id/privacy-toggle
 */
export async function togglePrivacy(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { is_shared } = req.body;
    const patientId = req.user.id;

    // Verify session belongs to patient
    const sessions = await query(
      'SELECT id, is_shared FROM screening_sessions WHERE id = ? AND patient_id = ?',
      [sessionId, patientId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Update privacy setting
    await query(
      'UPDATE screening_sessions SET is_shared = ? WHERE id = ?',
      [is_shared, sessionId]
    );

    logger.info('Session privacy updated', {
      sessionId,
      isShared: is_shared
    });

    res.json({
      success: true,
      message: is_shared
        ? 'Your session is now visible to doctors'
        : 'Your session is now private',
      data: { is_shared }
    });
  } catch (error) {
    logger.error('Toggle privacy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update privacy setting'
    });
  }
}

/**
 * Get all sessions for current patient
 * GET /api/patient/sessions
 */
export async function getSessions(req, res) {
  try {
    const patientId = req.user.id;

    const sessions = await query(
      `SELECT
        id, symptoms, duration, severity, risk_level, is_shared, status,
        safe_ai_summary, created_at, updated_at
       FROM screening_sessions
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [patientId]
    );

    // Get report count for each session
    for (const session of sessions) {
      const reportCount = await query(
        'SELECT COUNT(*) as count FROM medical_reports WHERE session_id = ?',
        [session.id]
      );
      session.reportCount = reportCount[0].count;
    }

    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
}

/**
 * Get single session details
 * GET /api/patient/session/:id
 */
export async function getSessionDetails(req, res) {
  try {
    const { id: sessionId } = req.params;
    const patientId = req.user.id;

    // Get session
    const sessions = await query(
      'SELECT * FROM screening_sessions WHERE id = ? AND patient_id = ?',
      [sessionId, patientId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessions[0];

    // Get follow-up Q&A
    const followupQA = await query(
      'SELECT id, question, answer, asked_by, question_type, created_at FROM followup_qa WHERE session_id = ? ORDER BY created_at',
      [sessionId]
    );

    // Get reports
    const reports = await query(
      `SELECT id, original_filename, report_type, ai_report_summary, processing_status, created_at
       FROM medical_reports WHERE session_id = ?`,
      [sessionId]
    );

    // Get doctor notes (if shared)
    let doctorNotes = [];
    if (session.is_shared) {
      doctorNotes = await query(
        `SELECT dn.note, dn.note_type, dn.created_at, u.name as doctor_name
         FROM doctor_notes dn
         JOIN users u ON dn.doctor_id = u.id
         WHERE dn.session_id = ?
         ORDER BY dn.created_at DESC`,
        [sessionId]
      );
    }

    res.json({
      success: true,
      data: {
        session,
        followupQA,
        reports,
        doctorNotes
      }
    });
  } catch (error) {
    logger.error('Get session details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session details'
    });
  }
}

/**
 * Ask a question to the doctor
 * POST /api/patient/session/:id/ask-doctor
 */
export async function askDoctor(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { question } = req.body;
    const patientId = req.user.id;

    // Verify session belongs to patient and is shared
    const sessions = await query(
      'SELECT id, is_shared FROM screening_sessions WHERE id = ? AND patient_id = ?',
      [sessionId, patientId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!sessions[0].is_shared) {
      return res.status(400).json({
        success: false,
        error: 'Please enable sharing to ask questions to doctors'
      });
    }

    // Insert question
    const qaId = uuidv4();
    await query(
      `INSERT INTO followup_qa (id, session_id, question, asked_by, question_type, is_answered)
       VALUES (?, ?, ?, 'patient', 'doctor_question', FALSE)`,
      [qaId, sessionId, question]
    );

    logger.info('Patient question submitted', { sessionId, qaId });

    res.status(201).json({
      success: true,
      message: 'Your question has been submitted. A doctor will respond soon.',
      data: { questionId: qaId }
    });
  } catch (error) {
    logger.error('Ask doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit question'
    });
  }
}

export default {
  createSession,
  answerFollowup,
  uploadReport,
  askReportQuestion,
  togglePrivacy,
  getSessions,
  getSessionDetails,
  askDoctor
};
