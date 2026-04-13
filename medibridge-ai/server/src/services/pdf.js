/**
 * PDF Generation Service
 *
 * Generates professional medical summary PDFs for doctor download.
 * Uses PDFKit for document generation.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for risk levels
const RISK_COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444'
};

/**
 * Generate a patient summary PDF
 */
export async function generatePatientSummaryPDF(data) {
  const {
    patient,
    session,
    followupQA,
    reports,
    doctorNotes,
    generatedBy
  } = data;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const filename = `patient_summary_${session.id}_${Date.now()}.pdf`;
      const filepath = path.join(process.env.UPLOAD_DIR || './uploads', 'pdfs', filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // ==================== HEADER ====================
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('MediBridge AI', { align: 'center' })
        .fontSize(12)
        .font('Helvetica')
        .text('Pre-Consultation Summary Report', { align: 'center' })
        .moveDown();

      // Divider line
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown();

      // ==================== PATIENT INFORMATION ====================
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text('Patient Information')
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151');

      const patientInfo = [
        ['Name:', patient.name || 'N/A'],
        ['Age:', session.age ? `${session.age} years` : 'N/A'],
        ['Gender:', capitalizeFirst(session.gender) || 'N/A'],
        ['Session ID:', session.id],
        ['Date:', new Date(session.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })]
      ];

      patientInfo.forEach(([label, value]) => {
        doc
          .font('Helvetica-Bold')
          .text(label, { continued: true })
          .font('Helvetica')
          .text(` ${value}`);
      });

      doc.moveDown();

      // ==================== RISK LEVEL ====================
      const riskColor = RISK_COLORS[session.risk_level] || RISK_COLORS.yellow;

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text('Risk Assessment', { continued: true })
        .fontSize(12)
        .fillColor(riskColor)
        .text(`  [${session.risk_level?.toUpperCase() || 'UNKNOWN'}]`);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .moveDown(0.5);

      if (session.risk_explanation) {
        doc.text(session.risk_explanation);
      }

      doc.moveDown();

      // ==================== CHIEF COMPLAINT ====================
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text('Chief Complaint')
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(session.symptoms || 'No symptoms recorded')
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text('Duration: ', { continued: true })
        .font('Helvetica')
        .text(session.duration || 'Not specified');

      doc
        .font('Helvetica-Bold')
        .text('Severity: ', { continued: true })
        .font('Helvetica')
        .text(capitalizeFirst(session.severity) || 'Not specified');

      doc.moveDown();

      // ==================== EXISTING CONDITIONS ====================
      if (session.existing_conditions) {
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text('Pre-existing Conditions')
          .moveDown(0.5);

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#374151')
          .text(session.existing_conditions)
          .moveDown();
      }

      // ==================== FOLLOW-UP Q&A ====================
      if (followupQA && followupQA.length > 0) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text('Follow-up Interview')
          .moveDown(0.5);

        followupQA.forEach((qa, index) => {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#374151')
            .text(`Q${index + 1}: ${qa.question}`)
            .font('Helvetica')
            .fillColor('#6b7280')
            .text(`A: ${qa.answer || 'No answer provided'}`)
            .moveDown(0.5);
        });

        doc.moveDown();
      }

      // ==================== AI SUMMARY ====================
      if (session.safe_ai_summary) {
        if (doc.y > 600) {
          doc.addPage();
        }

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text('AI-Generated Summary')
          .moveDown(0.5);

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#374151')
          .text(session.safe_ai_summary)
          .moveDown();
      }

      // ==================== MEDICAL REPORTS ====================
      if (reports && reports.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
        }

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text('Uploaded Medical Reports')
          .moveDown(0.5);

        reports.forEach((report, index) => {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#374151')
            .text(`Report ${index + 1}: ${report.original_filename || 'Unknown'}`)
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#6b7280')
            .text(report.ai_report_summary || 'Summary not available')
            .moveDown(0.5);
        });

        doc.moveDown();
      }

      // ==================== DOCTOR NOTES ====================
      if (doctorNotes && doctorNotes.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
        }

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text('Clinical Notes')
          .moveDown(0.5);

        doctorNotes.forEach((note) => {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#374151')
            .text(`[${capitalizeFirst(note.note_type)}] - ${new Date(note.created_at).toLocaleDateString()}`)
            .font('Helvetica')
            .fillColor('#6b7280')
            .text(note.note)
            .moveDown(0.5);
        });

        doc.moveDown();
      }

      // ==================== FOOTER ====================
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);

        // Footer line
        doc
          .strokeColor('#e5e7eb')
          .lineWidth(0.5)
          .moveTo(50, 780)
          .lineTo(545, 780)
          .stroke();

        // Footer text
        doc
          .fontSize(8)
          .fillColor('#9ca3af')
          .text(
            'CONFIDENTIAL - This document contains protected health information.',
            50,
            785,
            { align: 'center', width: 495 }
          )
          .text(
            `Generated by MediBridge AI | ${generatedBy ? `By: Dr. ${generatedBy}` : ''} | Page ${i + 1} of ${pageCount}`,
            50,
            795,
            { align: 'center', width: 495 }
          );
      }

      // ==================== DISCLAIMER ====================
      doc.addPage();

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text('Important Disclaimer', { align: 'center' })
        .moveDown();

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(
          'This pre-consultation summary is generated by an AI-assisted intake system and is intended to support, not replace, clinical judgment. The AI system does not diagnose conditions, prescribe treatments, or provide medical advice.',
          { align: 'justify' }
        )
        .moveDown()
        .text(
          'All information should be verified through direct patient consultation. Risk assessments are based on pattern matching and should be clinically validated. This document is confidential and intended only for authorized healthcare providers.',
          { align: 'justify' }
        )
        .moveDown(2)
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(`Document generated: ${new Date().toISOString()}`, { align: 'center' })
        .text(`Session ID: ${session.id}`, { align: 'center' });

      // Finalize PDF
      doc.end();

      writeStream.on('finish', () => {
        resolve({
          filename,
          filepath,
          url: `/uploads/pdfs/${filename}`
        });
      });

      writeStream.on('error', (error) => {
        logger.error('PDF write error:', error);
        reject(error);
      });

    } catch (error) {
      logger.error('PDF generation error:', error);
      reject(error);
    }
  });
}

/**
 * Helper function to capitalize first letter
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default {
  generatePatientSummaryPDF
};
