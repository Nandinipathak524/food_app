/**
 * Doctor Controller
 *
 * Handles doctor dashboard, patient viewing, notes,
 * replying to questions, and PDF generation.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import pdfService from '../services/pdf.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * Get all patients with shared sessions
 * GET /api/doctor/patients
 *
 * CRITICAL: Only returns sessions where is_shared = TRUE
 * This enforces patient privacy at the query level
 */
export async function getPatients(req, res) {
  try {
    const { risk_level, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Build query with privacy filter
    let sql = `
      SELECT
        ss.id as session_id,
        ss.patient_id,
        ss.symptoms,
        ss.risk_level,
        ss.safe_ai_summary,
        ss.status,
        ss.created_at,
        ss.updated_at,
        u.name as patient_name,
        u.email as patient_email,
        (SELECT COUNT(*) FROM medical_reports mr WHERE mr.session_id = ss.id) as report_count,
        (SELECT COUNT(*) FROM followup_qa fq WHERE fq.session_id = ss.id AND fq.asked_by = 'patient' AND fq.is_answered = FALSE) as unanswered_questions
      FROM screening_sessions ss
      JOIN users u ON ss.patient_id = u.id
      WHERE ss.is_shared = TRUE
    `;

    const params = [];

    // Filter by risk level
    if (risk_level && ['green', 'yellow', 'red'].includes(risk_level)) {
      sql += ' AND ss.risk_level = ?';
      params.push(risk_level);
    }

    // Search by patient name or symptoms
    if (search) {
      sql += ' AND (u.name LIKE ? OR ss.symptoms LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY FIELD(ss.risk_level, "red", "yellow", "green"), ss.updated_at DESC';
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const patients = await query(sql, params);

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM screening_sessions ss
      JOIN users u ON ss.patient_id = u.id
      WHERE ss.is_shared = TRUE
    `;
    const countParams = [];

    if (risk_level && ['green', 'yellow', 'red'].includes(risk_level)) {
      countSql += ' AND ss.risk_level = ?';
      countParams.push(risk_level);
    }

    if (search) {
      countSql += ' AND (u.name LIKE ? OR ss.symptoms LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    // Truncate summaries for card view
    const patientsWithTruncatedSummary = patients.map(p => ({
      ...p,
      short_summary: p.safe_ai_summary
        ? p.safe_ai_summary.substring(0, 200) + (p.safe_ai_summary.length > 200 ? '...' : '')
        : null
    }));

    res.json({
      success: true,
      data: {
        patients: patientsWithTruncatedSummary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients'
    });
  }
}

/**
 * Get full session details
 * GET /api/doctor/session/:id
 *
 * CRITICAL: Verifies is_shared = TRUE before returning data
 */
export async function getSessionDetails(req, res) {
  try {
    const { id: sessionId } = req.params;

    // Get session (only if shared)
    const sessions = await query(
      `SELECT ss.*, u.name as patient_name, u.email as patient_email, u.phone as patient_phone
       FROM screening_sessions ss
       JOIN users u ON ss.patient_id = u.id
       WHERE ss.id = ? AND ss.is_shared = TRUE`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not accessible'
      });
    }

    const session = sessions[0];

    // Get all follow-up Q&A
    const followupQA = await query(
      `SELECT id, question, answer, asked_by, question_type, is_answered, created_at, answered_at
       FROM followup_qa
       WHERE session_id = ?
       ORDER BY created_at ASC`,
      [sessionId]
    );

    // Get medical reports
    const reports = await query(
      `SELECT id, file_url, original_filename, report_type, ai_report_summary, processing_status, created_at
       FROM medical_reports
       WHERE session_id = ?
       ORDER BY created_at DESC`,
      [sessionId]
    );

    // Get doctor notes
    const notes = await query(
      `SELECT dn.id, dn.note, dn.note_type, dn.created_at, u.name as doctor_name
       FROM doctor_notes dn
       JOIN users u ON dn.doctor_id = u.id
       WHERE dn.session_id = ?
       ORDER BY dn.created_at DESC`,
      [sessionId]
    );

    // Separate Q&A by type
    const aiQuestions = followupQA.filter(q => q.asked_by === 'ai');
    const patientQuestions = followupQA.filter(q => q.asked_by === 'patient' && q.question_type === 'doctor_question');
    const doctorQuestions = followupQA.filter(q => q.asked_by === 'doctor');

    res.json({
      success: true,
      data: {
        session,
        aiIntake: aiQuestions,
        patientQuestions,
        doctorQuestions,
        reports,
        notes
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
 * Reply to a patient question
 * POST /api/doctor/session/:id/reply
 */
export async function replyToQuestion(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { questionId, answer } = req.body;
    const doctorId = req.user.id;

    // Verify session is shared
    const sessions = await query(
      'SELECT id FROM screening_sessions WHERE id = ? AND is_shared = TRUE',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not accessible'
      });
    }

    // Update the question with doctor's answer
    const result = await query(
      `UPDATE followup_qa
       SET answer = ?, is_answered = TRUE, answered_at = NOW()
       WHERE id = ? AND session_id = ?`,
      [answer, questionId, sessionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    logger.info('Doctor replied to question', {
      doctorId,
      sessionId,
      questionId
    });

    res.json({
      success: true,
      message: 'Reply sent successfully'
    });
  } catch (error) {
    logger.error('Reply to question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reply'
    });
  }
}

/**
 * Ask a follow-up question to patient
 * POST /api/doctor/session/:id/ask
 */
export async function askPatient(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { question, question_type } = req.body;
    const doctorId = req.user.id;

    // Verify session is shared
    const sessions = await query(
      'SELECT id FROM screening_sessions WHERE id = ? AND is_shared = TRUE',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not accessible'
      });
    }

    // Insert question
    const qaId = uuidv4();
    await query(
      `INSERT INTO followup_qa (id, session_id, question, asked_by, question_type, is_answered)
       VALUES (?, ?, ?, 'doctor', ?, FALSE)`,
      [qaId, sessionId, question, question_type || 'general']
    );

    logger.info('Doctor asked question', { doctorId, sessionId, qaId });

    res.status(201).json({
      success: true,
      message: 'Question sent to patient',
      data: { questionId: qaId }
    });
  } catch (error) {
    logger.error('Ask patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send question'
    });
  }
}

/**
 * Add clinical note
 * POST /api/doctor/session/:id/note
 */
export async function addNote(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { note, note_type } = req.body;
    const doctorId = req.user.id;

    // Verify session is shared
    const sessions = await query(
      'SELECT id FROM screening_sessions WHERE id = ? AND is_shared = TRUE',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not accessible'
      });
    }

    // Insert note
    const noteId = uuidv4();
    await query(
      `INSERT INTO doctor_notes (id, session_id, doctor_id, note, note_type)
       VALUES (?, ?, ?, ?, ?)`,
      [noteId, sessionId, doctorId, note, note_type || 'general']
    );

    logger.info('Doctor added note', { doctorId, sessionId, noteId });

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: { noteId }
    });
  } catch (error) {
    logger.error('Add note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note'
    });
  }
}

/**
 * Download session summary as PDF
 * GET /api/doctor/session/:id/pdf
 */
export async function downloadPDF(req, res) {
  try {
    const { id: sessionId } = req.params;
    const doctorId = req.user.id;
    const doctorName = req.user.name;

    // Get session (only if shared)
    const sessions = await query(
      `SELECT ss.*, u.name as patient_name, u.email as patient_email
       FROM screening_sessions ss
       JOIN users u ON ss.patient_id = u.id
       WHERE ss.id = ? AND ss.is_shared = TRUE`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not accessible'
      });
    }

    const session = sessions[0];

    // Get follow-up Q&A
    const followupQA = await query(
      'SELECT question, answer, asked_by FROM followup_qa WHERE session_id = ? AND is_answered = TRUE',
      [sessionId]
    );

    // Get reports
    const reports = await query(
      'SELECT original_filename, ai_report_summary FROM medical_reports WHERE session_id = ?',
      [sessionId]
    );

    // Get notes
    const doctorNotes = await query(
      `SELECT dn.note, dn.note_type, dn.created_at, u.name as doctor_name
       FROM doctor_notes dn
       JOIN users u ON dn.doctor_id = u.id
       WHERE dn.session_id = ?`,
      [sessionId]
    );

    // Generate PDF
    const pdfResult = await pdfService.generatePatientSummaryPDF({
      patient: { name: session.patient_name, email: session.patient_email },
      session,
      followupQA,
      reports,
      doctorNotes,
      generatedBy: doctorName
    });

    // Log the download
    await query(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, 'pdf_download', 'session', ?, ?)`,
      [uuidv4(), doctorId, sessionId, JSON.stringify({ filename: pdfResult.filename })]
    );

    logger.info('PDF downloaded', { doctorId, sessionId, filename: pdfResult.filename });

    // Send file
    res.download(pdfResult.filepath, pdfResult.filename, (err) => {
      if (err) {
        logger.error('PDF download error:', err);
      }
    });
  } catch (error) {
    logger.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF'
    });
  }
}

/**
 * Get patient questions that need response
 * GET /api/doctor/questions
 */
export async function getPendingQuestions(req, res) {
  try {
    const questions = await query(
      `SELECT
        fq.id,
        fq.session_id,
        fq.question,
        fq.created_at,
        ss.risk_level,
        u.name as patient_name
       FROM followup_qa fq
       JOIN screening_sessions ss ON fq.session_id = ss.id
       JOIN users u ON ss.patient_id = u.id
       WHERE fq.asked_by = 'patient'
         AND fq.question_type = 'doctor_question'
         AND fq.is_answered = FALSE
         AND ss.is_shared = TRUE
       ORDER BY FIELD(ss.risk_level, 'red', 'yellow', 'green'), fq.created_at ASC`
    );

    res.json({
      success: true,
      data: { questions }
    });
  } catch (error) {
    logger.error('Get pending questions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions'
    });
  }
}

/**
 * Get dashboard statistics
 * GET /api/doctor/stats
 */
export async function getStats(req, res) {
  try {
    // Get counts by risk level
    const riskCounts = await query(
      `SELECT risk_level, COUNT(*) as count
       FROM screening_sessions
       WHERE is_shared = TRUE
       GROUP BY risk_level`
    );

    // Get pending questions count
    const pendingQuestions = await query(
      `SELECT COUNT(*) as count
       FROM followup_qa fq
       JOIN screening_sessions ss ON fq.session_id = ss.id
       WHERE fq.asked_by = 'patient'
         AND fq.question_type = 'doctor_question'
         AND fq.is_answered = FALSE
         AND ss.is_shared = TRUE`
    );

    // Get today's sessions
    const todaySessions = await query(
      `SELECT COUNT(*) as count
       FROM screening_sessions
       WHERE is_shared = TRUE AND DATE(created_at) = CURDATE()`
    );

    // Format risk counts
    const risks = { green: 0, yellow: 0, red: 0 };
    riskCounts.forEach(r => {
      if (r.risk_level) risks[r.risk_level] = r.count;
    });

    res.json({
      success: true,
      data: {
        totalPatients: risks.green + risks.yellow + risks.red,
        riskDistribution: risks,
        pendingQuestions: pendingQuestions[0].count,
        todaySessions: todaySessions[0].count
      }
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
}

/**
 * View uploaded report file
 * GET /api/doctor/report/:reportId/file
 */
export async function viewReportFile(req, res) {
  try {
    const { reportId } = req.params;

    // Get report with session verification
    const reports = await query(
      `SELECT mr.file_url, mr.original_filename, mr.mime_type
       FROM medical_reports mr
       JOIN screening_sessions ss ON mr.session_id = ss.id
       WHERE mr.id = ? AND ss.is_shared = TRUE`,
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or not accessible'
      });
    }

    const report = reports[0];

    // Send file
    if (fs.existsSync(report.file_url)) {
      res.setHeader('Content-Type', report.mime_type || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${report.original_filename}"`);
      fs.createReadStream(report.file_url).pipe(res);
    } else {
      res.status(404).json({
        success: false,
        error: 'Report file not found'
      });
    }
  } catch (error) {
    logger.error('View report file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve report'
    });
  }
}

export default {
  getPatients,
  getSessionDetails,
  replyToQuestion,
  askPatient,
  addNote,
  downloadPDF,
  getPendingQuestions,
  getStats,
  viewReportFile
};
