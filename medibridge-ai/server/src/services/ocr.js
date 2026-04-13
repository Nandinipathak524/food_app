/**
 * OCR Service
 *
 * Extracts text from uploaded PDF files.
 * Uses pdf-parse for text extraction.
 * For scanned PDFs, consider integrating Tesseract.js or a cloud OCR service.
 */

import pdfParse from 'pdf-parse';
import fs from 'fs';
import logger from '../utils/logger.js';

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{text: string, pages: number, info: object}>}
 */
export async function extractTextFromPDF(filePath) {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(filePath);

    // Parse PDF
    const data = await pdfParse(dataBuffer);

    const result = {
      text: data.text.trim(),
      pages: data.numpages,
      info: {
        title: data.info?.Title || null,
        author: data.info?.Author || null,
        creator: data.info?.Creator || null,
        creationDate: data.info?.CreationDate || null
      }
    };

    // Log extraction stats
    logger.info('PDF text extraction completed', {
      pages: result.pages,
      textLength: result.text.length,
      filePath
    });

    return result;
  } catch (error) {
    logger.error('PDF text extraction failed:', error);

    // If pdf-parse fails (e.g., scanned PDF), return empty with note
    if (error.message?.includes('encrypted') || error.message?.includes('password')) {
      throw new Error('PDF is encrypted and cannot be processed');
    }

    return {
      text: '',
      pages: 0,
      info: {},
      error: 'Could not extract text. The PDF may be scanned or image-based.',
      needsOCR: true
    };
  }
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text
 */
export function cleanExtractedText(text) {
  if (!text) return '';

  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove page numbers (common patterns)
    .replace(/\bPage\s+\d+\s+(of\s+\d+)?\b/gi, '')
    // Remove header/footer patterns
    .replace(/^.*?(confidential|private|draft).*?$/gim, '')
    // Trim
    .trim();
}

/**
 * Identify report type based on content
 * @param {string} text - Extracted text
 * @returns {string} Report type identifier
 */
export function identifyReportType(text) {
  const textLower = text.toLowerCase();

  const patterns = [
    { type: 'blood_test', keywords: ['hemoglobin', 'hematocrit', 'wbc', 'rbc', 'platelet', 'complete blood count', 'cbc'] },
    { type: 'lipid_panel', keywords: ['cholesterol', 'ldl', 'hdl', 'triglyceride', 'lipid profile'] },
    { type: 'liver_function', keywords: ['alt', 'ast', 'bilirubin', 'albumin', 'liver function', 'hepatic'] },
    { type: 'kidney_function', keywords: ['creatinine', 'bun', 'gfr', 'kidney function', 'renal'] },
    { type: 'thyroid', keywords: ['tsh', 't3', 't4', 'thyroid'] },
    { type: 'diabetes', keywords: ['glucose', 'hba1c', 'blood sugar', 'fasting glucose', 'diabetes'] },
    { type: 'xray', keywords: ['x-ray', 'xray', 'radiograph', 'chest x-ray'] },
    { type: 'mri', keywords: ['mri', 'magnetic resonance'] },
    { type: 'ct_scan', keywords: ['ct scan', 'computed tomography', 'cat scan'] },
    { type: 'ecg', keywords: ['ecg', 'ekg', 'electrocardiogram', 'heart rhythm'] },
    { type: 'ultrasound', keywords: ['ultrasound', 'sonography', 'echo'] },
    { type: 'urine_test', keywords: ['urinalysis', 'urine test', 'urine culture'] }
  ];

  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (textLower.includes(keyword)) {
        return pattern.type;
      }
    }
  }

  return 'general';
}

/**
 * Extract key values from medical report text
 * (Basic implementation - can be enhanced with NLP)
 * @param {string} text - Report text
 * @returns {Array<{name: string, value: string, unit: string, reference: string, isAbnormal: boolean}>}
 */
export function extractKeyValues(text) {
  const results = [];

  // Common patterns for lab values: "Test Name: Value Unit (Reference: X-Y)"
  const patterns = [
    // Pattern: "Name: Value Unit"
    /([A-Za-z\s]+):\s*([\d.]+)\s*([a-zA-Z/%]+)?/g,
    // Pattern: "Name Value Unit"
    /^([A-Za-z\s]+)\s+([\d.]+)\s*([a-zA-Z/%]+)/gm
  ];

  // Common test names to look for
  const testNames = [
    'Hemoglobin', 'Hematocrit', 'WBC', 'RBC', 'Platelet',
    'Glucose', 'HbA1c', 'Cholesterol', 'LDL', 'HDL', 'Triglycerides',
    'Creatinine', 'BUN', 'GFR', 'Sodium', 'Potassium', 'Chloride',
    'ALT', 'AST', 'Bilirubin', 'Albumin', 'Total Protein',
    'TSH', 'T3', 'T4'
  ];

  // Simple extraction - for production, use proper medical NLP
  for (const name of testNames) {
    const regex = new RegExp(`${name}[:\\s]+(\\d+[.,]?\\d*)\\s*([a-zA-Z/%]+)?`, 'i');
    const match = text.match(regex);

    if (match) {
      results.push({
        name,
        value: match[1],
        unit: match[2] || '',
        reference: '', // Would need more sophisticated parsing
        isAbnormal: false // Would need reference ranges to determine
      });
    }
  }

  return results;
}

export default {
  extractTextFromPDF,
  cleanExtractedText,
  identifyReportType,
  extractKeyValues
};
