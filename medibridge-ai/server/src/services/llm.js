/**
 * LLM Service with Medical Safety Guardrails
 *
 * CRITICAL: This service handles all AI interactions with strict safety measures.
 * The LLM must NEVER diagnose, prescribe, or provide medical treatment advice.
 *
 * Safety layers:
 * 1. Carefully crafted system prompts with explicit restrictions
 * 2. Output validation and sanitization
 * 3. Hardcoded emergency pattern detection and override
 * 4. Risk level validation with rules-based fallback
 */

import OpenAI from 'openai';
import logger from '../utils/logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.LLM_MODEL || 'gpt-4-turbo-preview';

// ==================== SYSTEM PROMPTS ====================

const SYSTEM_PROMPTS = {
  /**
   * Intake assistant: Collects symptoms and generates follow-up questions
   */
  intake: `You are a medical intake assistant for a hospital pre-consultation system.

STRICT RULES - YOU MUST FOLLOW THESE:
1. NEVER diagnose any condition
2. NEVER prescribe or suggest any medication, treatment, or remedy
3. NEVER provide emergency medical instructions
4. NEVER speculate about what condition the patient might have
5. NEVER say things like "this could be" or "you might have"

YOUR ONLY ROLE IS TO:
1. Acknowledge the patient's reported symptoms professionally
2. Ask relevant follow-up questions to gather more information
3. Collect medical history details
4. Help the patient describe their symptoms more precisely

When generating follow-up questions:
- Ask about onset, duration, and pattern of symptoms
- Ask about aggravating and relieving factors
- Ask about associated symptoms
- Ask about relevant medical history
- Keep questions clear and simple

Always end by reminding the patient that this is a pre-consultation intake and they should consult with a doctor for proper evaluation.`,

  /**
   * Risk assessment: Categorizes urgency WITHOUT diagnosing
   */
  riskAssessment: `You are a medical triage assistant that helps categorize the urgency of symptoms.

STRICT RULES:
1. NEVER diagnose or name any specific condition
2. NEVER prescribe medication or treatment
3. Only categorize based on symptom severity patterns

Categorize into three levels:
- GREEN: Symptoms that appear mild and routine
- YELLOW: Symptoms that warrant timely medical attention
- RED: Symptoms that may require urgent/emergency evaluation

For RED symptoms, always include: "Please seek immediate medical attention."

Respond ONLY with a JSON object in this format:
{
  "risk_level": "green|yellow|red",
  "explanation": "Brief explanation without diagnosis",
  "recommendation": "What type of care timeframe is suggested"
}`,

  /**
   * Summary generator: Creates clinical brief for doctors
   */
  summary: `You are a medical documentation assistant that creates structured summaries for doctors.

STRICT RULES:
1. Only summarize what the patient reported - do not infer diagnoses
2. Present information objectively
3. Do not suggest treatments or medications

Create a structured summary with these sections:
1. Chief Complaint: Primary symptoms reported
2. History of Present Illness: Duration, severity, pattern
3. Associated Symptoms: Related symptoms mentioned
4. Relevant Medical History: Pre-existing conditions
5. Patient Concerns: Questions or worries expressed

Keep the summary factual and objective. Use medical terminology where appropriate but avoid diagnostic conclusions.`,

  /**
   * Report analyzer: Summarizes medical test reports
   */
  reportAnalyzer: `You are a medical report explanation assistant.

STRICT RULES:
1. NEVER interpret results as indicative of any specific disease
2. NEVER provide treatment recommendations
3. Explain what different values and terms mean in general
4. Always recommend discussing results with a doctor

Your role is to:
1. Identify the type of test/report
2. Explain medical terms in simple language
3. Highlight which values are marked as out of range (if any)
4. Explain what those measurements generally represent

Always end with: "Please discuss these results with your doctor for proper interpretation and any necessary follow-up."`
};

// ==================== EMERGENCY PATTERNS ====================

/**
 * Keywords that should trigger RED risk level override
 * Regardless of LLM assessment
 */
const EMERGENCY_PATTERNS = [
  // Cardiac
  /chest\s*pain/i,
  /heart\s*attack/i,
  /crushing\s*(chest|pressure)/i,
  /pain\s*radiating\s*(to|down)\s*(arm|jaw)/i,

  // Respiratory
  /can'?t\s*breathe/i,
  /difficulty\s*breathing/i,
  /severe\s*shortness\s*of\s*breath/i,
  /choking/i,

  // Neurological
  /stroke/i,
  /sudden\s*(weakness|numbness)/i,
  /face\s*drooping/i,
  /slurred\s*speech/i,
  /worst\s*headache\s*(of\s*my\s*life|ever)/i,
  /sudden\s*vision\s*(loss|change)/i,

  // Severe bleeding/trauma
  /heavy\s*bleeding/i,
  /blood\s*loss/i,
  /severe\s*injury/i,
  /unconscious/i,
  /passed\s*out/i,
  /seizure/i,

  // Allergic reaction
  /anaphyla/i,
  /throat\s*(closing|swelling)/i,
  /can'?t\s*swallow/i,

  // Suicide/self-harm
  /suicid/i,
  /self\s*harm/i,
  /want\s*to\s*(die|end)/i,
  /kill\s*(myself|my\s*self)/i,

  // Severe pain
  /excruciating\s*pain/i,
  /unbearable\s*pain/i,
  /10\s*out\s*of\s*10\s*pain/i
];

/**
 * Words/phrases that should never appear in LLM output
 */
const FORBIDDEN_OUTPUT_PATTERNS = [
  /you\s*(have|might\s*have|could\s*have|probably\s*have)/i,
  /diagnosis\s*is/i,
  /i\s*diagnose/i,
  /take\s*(this|these)\s*(medication|medicine|drug|pill)/i,
  /prescribe/i,
  /you\s*should\s*take\s*\d+\s*mg/i,
  /treatment\s*plan/i,
  /i\s*recommend\s*(taking|using)\s*(medication|medicine)/i
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if text contains emergency patterns
 */
function detectEmergencyPatterns(text) {
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize LLM output to remove forbidden content
 */
function sanitizeOutput(text) {
  let sanitized = text;

  // Check for forbidden patterns and log violations
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(sanitized)) {
      logger.warn('LLM output contained forbidden pattern', {
        pattern: pattern.toString(),
        text: text.substring(0, 200)
      });

      // Remove the problematic sentence
      sanitized = sanitized.replace(
        new RegExp(`[^.]*${pattern.source}[^.]*\\.?`, 'gi'),
        '[Content removed for safety]'
      );
    }
  }

  return sanitized;
}

/**
 * Validate and potentially override risk level
 */
function validateRiskLevel(symptoms, llmRisk) {
  // Check for emergency patterns - override to RED
  if (detectEmergencyPatterns(symptoms)) {
    logger.info('Emergency pattern detected, overriding to RED risk level');
    return 'red';
  }

  // Validate LLM response
  const validLevels = ['green', 'yellow', 'red'];
  if (!validLevels.includes(llmRisk?.toLowerCase())) {
    logger.warn('Invalid risk level from LLM, defaulting to yellow', { llmRisk });
    return 'yellow';
  }

  return llmRisk.toLowerCase();
}

// ==================== MAIN SERVICE FUNCTIONS ====================

/**
 * Generate follow-up questions based on initial symptoms
 */
export async function generateFollowupQuestions(patientData) {
  const { symptoms, duration, severity, age, gender, existing_conditions } = patientData;

  const userMessage = `
Patient Information:
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}
- Existing conditions: ${existing_conditions || 'None reported'}

Reported Symptoms:
${symptoms}

Duration: ${duration || 'Not specified'}
Severity: ${severity || 'Not specified'}

Please generate 3-5 follow-up questions to better understand the patient's symptoms. Return as a JSON array of questions with question_type field.
Format: [{"question": "...", "question_type": "symptom|history|lifestyle|severity"}]
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.intake },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Extract questions array (handle different response formats)
    const questions = parsed.questions || parsed;

    if (!Array.isArray(questions)) {
      throw new Error('LLM did not return an array of questions');
    }

    // Validate and limit to 5 questions
    return questions.slice(0, 5).map(q => ({
      question: sanitizeOutput(q.question),
      question_type: q.question_type || 'general'
    }));
  } catch (error) {
    logger.error('Error generating follow-up questions:', error);
    throw new Error('Failed to generate follow-up questions');
  }
}

/**
 * Assess risk level based on all collected information
 */
export async function assessRisk(patientData, followupAnswers = []) {
  const { symptoms, duration, severity, age, gender, existing_conditions } = patientData;

  // First check for emergency patterns (rules-based override)
  const allText = `${symptoms} ${followupAnswers.map(a => `${a.question} ${a.answer}`).join(' ')}`;

  if (detectEmergencyPatterns(allText)) {
    return {
      risk_level: 'red',
      explanation: 'Based on the symptoms described, urgent medical attention may be needed.',
      recommendation: 'Please seek immediate medical evaluation. If this is an emergency, call emergency services.',
      override_reason: 'emergency_pattern_detected'
    };
  }

  const userMessage = `
Patient Information:
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}
- Existing conditions: ${existing_conditions || 'None reported'}

Reported Symptoms:
${symptoms}

Duration: ${duration || 'Not specified'}
Severity: ${severity || 'Not specified'}

Follow-up Q&A:
${followupAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Based on the information provided, categorize the urgency level. Remember: DO NOT diagnose. Only assess urgency based on symptom severity patterns.
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.riskAssessment },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3, // Lower temperature for more consistent risk assessment
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    // Validate and potentially override risk level
    result.risk_level = validateRiskLevel(allText, result.risk_level);
    result.explanation = sanitizeOutput(result.explanation || '');
    result.recommendation = sanitizeOutput(result.recommendation || '');

    return result;
  } catch (error) {
    logger.error('Error assessing risk:', error);
    // Default to yellow on error - safe middle ground
    return {
      risk_level: 'yellow',
      explanation: 'Unable to fully assess. Please consult with a doctor.',
      recommendation: 'Schedule a medical consultation for proper evaluation.'
    };
  }
}

/**
 * Generate summary for doctor review
 */
export async function generateDoctorSummary(patientData, followupAnswers = [], reports = []) {
  const { symptoms, duration, severity, age, gender, existing_conditions } = patientData;

  const userMessage = `
Patient Demographics:
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}

Chief Complaint:
${symptoms}

Duration: ${duration || 'Not specified'}
Severity: ${severity || 'Not specified'}

Pre-existing Conditions:
${existing_conditions || 'None reported'}

Follow-up Interview:
${followupAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

${reports.length > 0 ? `
Uploaded Reports Summary:
${reports.map(r => r.ai_report_summary).join('\n---\n')}
` : ''}

Please create a structured clinical summary for the reviewing physician.
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.summary },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });

    const rawOutput = response.choices[0].message.content;
    const sanitizedOutput = sanitizeOutput(rawOutput);

    return {
      raw: rawOutput,
      sanitized: sanitizedOutput
    };
  } catch (error) {
    logger.error('Error generating doctor summary:', error);
    throw new Error('Failed to generate summary');
  }
}

/**
 * Analyze and summarize a medical report
 */
export async function analyzeReport(extractedText, reportType = 'general') {
  const userMessage = `
Report Type: ${reportType}

Report Content:
${extractedText}

Please:
1. Identify what type of medical test/report this is
2. Explain any medical terms in simple language
3. Note any values marked as out of normal range
4. Provide a brief, patient-friendly summary

Remember: Do NOT interpret results as indicative of any disease. Only explain what the terms mean.
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.reportAnalyzer },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });

    return sanitizeOutput(response.choices[0].message.content);
  } catch (error) {
    logger.error('Error analyzing report:', error);
    throw new Error('Failed to analyze report');
  }
}

/**
 * Answer patient question about their report
 */
export async function answerReportQuestion(reportSummary, question) {
  const userMessage = `
Report Summary:
${reportSummary}

Patient Question:
${question}

Please answer the patient's question about their report. Remember:
- Only explain terms and values
- Do NOT diagnose or suggest treatments
- Recommend consulting their doctor for interpretation
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.reportAnalyzer },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.5,
      max_tokens: 800
    });

    return sanitizeOutput(response.choices[0].message.content);
  } catch (error) {
    logger.error('Error answering report question:', error);
    throw new Error('Failed to answer question');
  }
}

/**
 * Detect language from text (simple implementation)
 */
export function detectLanguage(text) {
  // Simple language detection based on character patterns
  // For production, use a proper library like 'franc' or 'langdetect'

  // Check for common non-English characters
  const hasSpanish = /[áéíóúñ¿¡]/i.test(text);
  const hasFrench = /[àâçéèêëîïôûùü]/i.test(text);
  const hasGerman = /[äöüß]/i.test(text);
  const hasHindi = /[\u0900-\u097F]/u.test(text);
  const hasChinese = /[\u4e00-\u9fff]/u.test(text);
  const hasArabic = /[\u0600-\u06FF]/u.test(text);

  if (hasHindi) return 'hi';
  if (hasChinese) return 'zh';
  if (hasArabic) return 'ar';
  if (hasSpanish) return 'es';
  if (hasFrench) return 'fr';
  if (hasGerman) return 'de';

  return 'en'; // Default to English
}

/**
 * Translate text if needed (placeholder - integrate with translation API)
 */
export async function translateIfNeeded(text, targetLanguage = 'en') {
  const detectedLang = detectLanguage(text);

  if (detectedLang === targetLanguage) {
    return { text, originalLanguage: detectedLang, wasTranslated: false };
  }

  // For production, integrate with Google Translate, DeepL, or similar
  // This is a placeholder that returns the original text
  logger.info(`Translation needed: ${detectedLang} -> ${targetLanguage}`);

  return {
    text,
    originalLanguage: detectedLang,
    wasTranslated: false,
    note: 'Translation service not configured'
  };
}

export default {
  generateFollowupQuestions,
  assessRisk,
  generateDoctorSummary,
  analyzeReport,
  answerReportQuestion,
  detectLanguage,
  translateIfNeeded
};
