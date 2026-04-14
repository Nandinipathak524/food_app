/**
 * Database Seeder
 *
 * Creates demo doctors and patients for testing.
 * Passwords are hashed using bcryptjs.
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;

// Demo users data
const demoUsers = [
  // Doctors
  {
    name: 'Dr. Sarah Johnson',
    email: 'doctor1@medibridge.com',
    password: 'Doctor123!',
    role: 'doctor',
    hospital_id: 'HOSP001',
    specialization: 'General Medicine',
    license_number: 'MD-12345',
    language: 'en'
  },
  {
    name: 'Dr. Michael Chen',
    email: 'doctor2@medibridge.com',
    password: 'Doctor123!',
    role: 'doctor',
    hospital_id: 'HOSP001',
    specialization: 'Cardiology',
    license_number: 'MD-67890',
    language: 'en'
  },
  {
    name: 'Dr. Priya Sharma',
    email: 'doctor3@medibridge.com',
    password: 'Doctor123!',
    role: 'doctor',
    hospital_id: 'HOSP001',
    specialization: 'Pediatrics',
    license_number: 'MD-11111',
    language: 'en'
  },
  // Patients
  {
    name: 'John Smith',
    email: 'patient1@test.com',
    password: 'Patient123!',
    role: 'patient',
    hospital_id: 'HOSP001',
    language: 'en',
    date_of_birth: '1985-03-15',
    phone: '+1-555-0101'
  },
  {
    name: 'Emily Davis',
    email: 'patient2@test.com',
    password: 'Patient123!',
    role: 'patient',
    hospital_id: 'HOSP001',
    language: 'en',
    date_of_birth: '1990-07-22',
    phone: '+1-555-0102'
  },
  {
    name: 'Robert Wilson',
    email: 'patient3@test.com',
    password: 'Patient123!',
    role: 'patient',
    hospital_id: 'HOSP001',
    language: 'es',
    date_of_birth: '1978-11-08',
    phone: '+1-555-0103'
  },
  // Admin
  {
    name: 'Admin User',
    email: 'admin@medibridge.com',
    password: 'Admin123!',
    role: 'admin',
    hospital_id: 'HOSP001',
    language: 'en'
  }
];

// Demo screening sessions
const demoSessions = [
  {
    symptoms: 'Persistent headache for the past 3 days, accompanied by mild nausea and sensitivity to light.',
    duration: '3 days',
    severity: 'moderate',
    age: 39,
    gender: 'male',
    existing_conditions: 'None',
    risk_level: 'yellow',
    safe_ai_summary: 'Patient reports persistent headache lasting 3 days with associated symptoms of mild nausea and photosensitivity. No known pre-existing conditions. Symptoms warrant medical evaluation to rule out underlying causes.',
    is_shared: true,
    status: 'reviewed'
  },
  {
    symptoms: 'Chest tightness and shortness of breath when climbing stairs.',
    duration: '1 week',
    severity: 'moderate',
    age: 34,
    gender: 'female',
    existing_conditions: 'Asthma (childhood)',
    risk_level: 'red',
    safe_ai_summary: 'Patient experiencing chest tightness and dyspnea on exertion. History of childhood asthma noted. These symptoms require prompt medical evaluation given the cardiac and respiratory differential diagnosis.',
    is_shared: true,
    status: 'intake'
  },
  {
    symptoms: 'Mild sore throat and runny nose.',
    duration: '2 days',
    severity: 'mild',
    age: 46,
    gender: 'male',
    existing_conditions: 'Seasonal allergies',
    risk_level: 'green',
    safe_ai_summary: 'Patient presents with mild upper respiratory symptoms consistent with common cold or seasonal allergies. No concerning features noted. Symptomatic care recommended.',
    is_shared: false,
    status: 'completed'
  }
];

async function seed() {
  console.log('🌱 Starting database seeding...');

  const connectionConfig = process.env.MYSQL_URL
    ? process.env.MYSQL_URL
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medibridge_ai'
      };
  const connection = await mysql.createConnection(connectionConfig);

  try {
    // Clear existing data (in reverse order of dependencies)
    console.log('🗑️  Clearing existing data...');
    await connection.query('DELETE FROM audit_log');
    await connection.query('DELETE FROM doctor_notes');
    await connection.query('DELETE FROM medical_reports');
    await connection.query('DELETE FROM followup_qa');
    await connection.query('DELETE FROM screening_sessions');
    await connection.query('DELETE FROM doctor_patient_assignments');
    await connection.query('DELETE FROM users');

    // Insert users
    console.log('👥 Creating demo users...');
    const userIds = {};

    for (const user of demoUsers) {
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      await connection.query(
        `INSERT INTO users (id, name, email, password_hash, role, hospital_id, language, specialization, license_number, date_of_birth, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.name,
          user.email,
          passwordHash,
          user.role,
          user.hospital_id,
          user.language,
          user.specialization || null,
          user.license_number || null,
          user.date_of_birth || null,
          user.phone || null
        ]
      );

      userIds[user.email] = id;
      console.log(`  ✅ Created ${user.role}: ${user.email}`);
    }

    // Insert screening sessions for patients
    console.log('📋 Creating demo screening sessions...');
    const patientEmails = ['patient1@test.com', 'patient2@test.com', 'patient3@test.com'];

    for (let i = 0; i < demoSessions.length; i++) {
      const session = demoSessions[i];
      const patientId = userIds[patientEmails[i]];
      const sessionId = uuidv4();

      await connection.query(
        `INSERT INTO screening_sessions
         (id, patient_id, symptoms, duration, severity, age, gender, existing_conditions, risk_level, safe_ai_summary, is_shared, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          patientId,
          session.symptoms,
          session.duration,
          session.severity,
          session.age,
          session.gender,
          session.existing_conditions,
          session.risk_level,
          session.safe_ai_summary,
          session.is_shared,
          session.status
        ]
      );

      // Add some follow-up Q&A for each session
      const followupQuestions = [
        { question: 'Have you experienced these symptoms before?', asked_by: 'ai', answer: 'No, this is the first time', question_type: 'history' },
        { question: 'Are you currently taking any medications?', asked_by: 'ai', answer: 'Only occasional ibuprofen', question_type: 'medication' },
        { question: 'On a scale of 1-10, how would you rate your discomfort?', asked_by: 'ai', answer: '6 out of 10', question_type: 'severity' }
      ];

      for (const qa of followupQuestions) {
        await connection.query(
          `INSERT INTO followup_qa (id, session_id, question, answer, asked_by, question_type, is_answered)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), sessionId, qa.question, qa.answer, qa.asked_by, qa.question_type, true]
        );
      }

      console.log(`  ✅ Created session for ${patientEmails[i]} (Risk: ${session.risk_level})`);
    }

    // Create doctor-patient assignments
    console.log('🔗 Creating doctor-patient assignments...');
    const doctorId = userIds['doctor1@medibridge.com'];
    const patient1Id = userIds['patient1@test.com'];
    const patient2Id = userIds['patient2@test.com'];

    await connection.query(
      `INSERT INTO doctor_patient_assignments (id, doctor_id, patient_id, is_active)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
      [uuidv4(), doctorId, patient1Id, true, uuidv4(), doctorId, patient2Id, true]
    );

    console.log('');
    console.log('✅ Seeding completed successfully!');
    console.log('');
    console.log('📝 Demo Credentials:');
    console.log('─'.repeat(50));
    console.log('Doctors:');
    console.log('  Email: doctor1@medibridge.com  Password: Doctor123!');
    console.log('  Email: doctor2@medibridge.com  Password: Doctor123!');
    console.log('  Email: doctor3@medibridge.com  Password: Doctor123!');
    console.log('');
    console.log('Patients:');
    console.log('  Email: patient1@test.com       Password: Patient123!');
    console.log('  Email: patient2@test.com       Password: Patient123!');
    console.log('  Email: patient3@test.com       Password: Patient123!');
    console.log('');
    console.log('Admin:');
    console.log('  Email: admin@medibridge.com    Password: Admin123!');
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
