-- MediBridge AI Database Schema
-- Initial Migration: Create all required tables

-- Users table: stores both doctors and patients
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'patient', 'admin') NOT NULL DEFAULT 'patient',
    hospital_id VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    specialization VARCHAR(100), -- For doctors only
    license_number VARCHAR(100), -- For doctors only
    date_of_birth DATE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_hospital (hospital_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Screening sessions: patient symptom intake sessions
CREATE TABLE IF NOT EXISTS screening_sessions (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,

    -- Initial intake data
    symptoms TEXT NOT NULL,
    duration VARCHAR(100),
    severity ENUM('mild', 'moderate', 'severe') DEFAULT 'moderate',
    age INT,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    existing_conditions TEXT,

    -- AI-generated content
    ai_followup_json JSON, -- Structured follow-up questions from LLM
    raw_llm_output LONGTEXT, -- Complete raw LLM response (for audit)
    safe_ai_summary LONGTEXT, -- Sanitized summary for display

    -- Risk assessment
    risk_level ENUM('green', 'yellow', 'red') DEFAULT 'green',
    risk_explanation TEXT,

    -- Privacy control
    is_shared BOOLEAN DEFAULT TRUE,

    -- Status tracking
    status ENUM('intake', 'followup', 'reviewed', 'completed') DEFAULT 'intake',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_patient (patient_id),
    INDEX idx_risk_level (risk_level),
    INDEX idx_is_shared (is_shared),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Follow-up Q&A: stores all questions and answers in sessions
CREATE TABLE IF NOT EXISTS followup_qa (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    asked_by ENUM('ai', 'patient', 'doctor') NOT NULL,
    question_type VARCHAR(50), -- e.g., 'symptom', 'history', 'lifestyle'
    is_answered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP NULL,

    FOREIGN KEY (session_id) REFERENCES screening_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_asked_by (asked_by),
    INDEX idx_is_answered (is_answered)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medical reports: uploaded test reports (PDF)
CREATE TABLE IF NOT EXISTS medical_reports (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,

    -- File information
    file_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),

    -- OCR and AI processing
    extracted_text LONGTEXT, -- OCR-extracted text
    ai_report_summary LONGTEXT, -- AI-generated summary in simple language
    report_type VARCHAR(100), -- e.g., 'blood_test', 'xray', 'mri', etc.

    -- Status
    processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES screening_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_processing_status (processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Doctor notes: clinical notes added by doctors
CREATE TABLE IF NOT EXISTS doctor_notes (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    note TEXT NOT NULL,
    note_type ENUM('general', 'recommendation', 'followup', 'urgent') DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES screening_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log: tracks important actions for compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- e.g., 'session', 'report', 'note'
    entity_id VARCHAR(36),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Doctor-Patient assignments (optional: for specific doctor assignments)
CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
    id VARCHAR(36) PRIMARY KEY,
    doctor_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(36) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_assignment (doctor_id, patient_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
