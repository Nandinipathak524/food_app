/**
 * Input Validation Schemas
 *
 * Uses Zod for type-safe runtime validation.
 * All API inputs should be validated before processing.
 */

import { z } from 'zod';

// Common validation patterns
const emailSchema = z.string().email('Invalid email format').max(255);
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// ==================== Auth Validators ====================

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['doctor', 'patient']).default('patient'),
  hospital_id: z.string().max(100).optional(),
  language: z.string().max(10).default('en'),
  specialization: z.string().max(100).optional(),
  license_number: z.string().max(100).optional(),
  date_of_birth: z.string().optional(),
  phone: z.string().max(20).optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// ==================== Session Validators ====================

export const createSessionSchema = z.object({
  symptoms: z.string()
    .min(10, 'Please describe your symptoms in more detail (at least 10 characters)')
    .max(5000, 'Symptoms description is too long'),
  duration: z.string().max(100).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).default('moderate'),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  existing_conditions: z.string().max(2000).optional()
});

export const answerFollowupSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answer: z.string().min(1).max(2000)
  })).min(1, 'At least one answer is required')
});

export const togglePrivacySchema = z.object({
  is_shared: z.boolean()
});

// ==================== Doctor Validators ====================

export const addNoteSchema = z.object({
  note: z.string()
    .min(1, 'Note cannot be empty')
    .max(10000, 'Note is too long'),
  note_type: z.enum(['general', 'recommendation', 'followup', 'urgent']).default('general')
});

export const replySchema = z.object({
  question: z.string()
    .min(1, 'Question cannot be empty')
    .max(2000, 'Question is too long'),
  question_type: z.string().max(50).default('doctor')
});

// ==================== Report Validators ====================

export const askReportQuestionSchema = z.object({
  question: z.string()
    .min(5, 'Please ask a more detailed question')
    .max(500, 'Question is too long')
});

// ==================== Validation Middleware Factory ====================

/**
 * Creates a validation middleware for a given Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to find data: 'body', 'query', or 'params'
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body :
                   source === 'query' ? req.query :
                   req.params;

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
      }

      // Replace request data with validated and transformed data
      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        req.query = result.data;
      }

      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data'
      });
    }
  };
}

// Export Zod for use in other files
export { z };
