# MediBridge AI

**Hospital Pre-Consultation & Doctor Assist Platform**

A production-grade web application with AI-assisted medical pre-consultation. The system is privacy-first, role-based (Doctor/Patient), and uses LLMs strictly for intake, follow-up questions, risk categorization, and summaries with medical safety guardrails.

> ⚠️ **Important**: This system is designed for pre-consultation intake ONLY. It does NOT diagnose, prescribe medication, or provide medical treatment advice.

## Features

### Patient Features
- 🩺 **Smart Symptom Intake**: Dynamic form with context-aware follow-up questions
- 🤖 **AI-Powered Follow-up**: LLM generates relevant follow-up questions based on symptoms
- 🚦 **Risk Assessment**: Automatic categorization (Green/Yellow/Red) with safety overrides
- 📄 **Report Upload**: Upload PDF medical reports with AI-powered analysis
- 🔒 **Privacy Control**: Toggle session visibility to doctors
- 💬 **Doctor Communication**: Ask questions directly to healthcare providers

### Doctor Features
- 📊 **Dashboard**: Overview of patients sorted by risk level
- 👀 **Patient Cards**: View shared patient sessions with AI summaries
- 📝 **Clinical Notes**: Add notes with categorization (General/Recommendation/Follow-up/Urgent)
- 💬 **Reply to Questions**: Answer patient questions directly
- 📥 **PDF Export**: Download comprehensive patient summary as PDF
- 🔍 **Search & Filter**: Find patients by name, symptoms, or risk level

### Safety Features
- 🛡️ **Prompt Guardrails**: LLM is strictly instructed to never diagnose or prescribe
- ✅ **Output Validation**: All LLM outputs are sanitized before display
- 🚨 **Emergency Detection**: Hardcoded pattern matching for urgent symptoms (overrides LLM)
- 🔐 **Privacy Enforcement**: Session visibility enforced at database query level

## Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend
- **Node.js** with Express.js
- **MySQL** with mysql2 driver
- **JWT** for authentication
- **Zod** for validation
- **PDFKit** for PDF generation
- **Multer** for file uploads
- **pdf-parse** for PDF text extraction

### AI/LLM
- **OpenAI GPT-4** (configurable for Claude or other providers)
- **Custom prompt templates** with safety guardrails
- **Hybrid risk assessment**: LLM + rules-based overrides

## Project Structure

```
medibridge-ai/
├── server/                 # Backend API
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth & validation middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic (LLM, PDF, OCR)
│   │   ├── utils/          # Logger, helpers
│   │   ├── validators/     # Zod schemas
│   │   └── app.js          # Entry point
│   ├── migrations/         # Database migrations
│   ├── seeds/              # Demo data seeders
│   ├── uploads/            # Uploaded files storage
│   └── package.json
│
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React context (Auth)
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   └── App.jsx         # Main app with routing
│   ├── index.html
│   └── package.json
│
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **MySQL** 8.0+
- **OpenAI API Key** (or Claude/other LLM provider)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd medibridge-ai

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

```bash
# In server directory
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=medibridge_ai

# JWT
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
LLM_PROVIDER=openai
LLM_MODEL=gpt-4-turbo-preview

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 3. Setup Database

```bash
# Create database and tables
cd server
npm run migrate

# Seed demo data
npm run seed
```

Or run both together:
```bash
npm run migrate:fresh
```

### 4. Start the Application

**Development mode (two terminals):**

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

## Demo Credentials

After seeding, you can login with these accounts:

### Doctors
| Email | Password |
|-------|----------|
| doctor1@medibridge.com | Doctor123! |
| doctor2@medibridge.com | Doctor123! |
| doctor3@medibridge.com | Doctor123! |

### Patients
| Email | Password |
|-------|----------|
| patient1@test.com | Patient123! |
| patient2@test.com | Patient123! |
| patient3@test.com | Patient123! |

### Admin
| Email | Password |
|-------|----------|
| admin@medibridge.com | Admin123! |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update profile

### Patient Routes (requires patient role)
- `POST /api/patient/session` - Create new screening session
- `GET /api/patient/sessions` - List all sessions
- `GET /api/patient/session/:id` - Get session details
- `POST /api/patient/session/:id/answer` - Submit follow-up answers
- `POST /api/patient/session/:id/upload-report` - Upload PDF report
- `POST /api/patient/session/:id/privacy-toggle` - Toggle sharing
- `POST /api/patient/session/:id/ask-doctor` - Ask doctor a question

### Doctor Routes (requires doctor role)
- `GET /api/doctor/stats` - Dashboard statistics
- `GET /api/doctor/patients` - List shared patient sessions
- `GET /api/doctor/session/:id` - Get full session details
- `GET /api/doctor/questions` - List pending questions
- `POST /api/doctor/session/:id/reply` - Reply to question
- `POST /api/doctor/session/:id/note` - Add clinical note
- `GET /api/doctor/session/:id/pdf` - Download PDF summary

## LLM Safety Guardrails

The system implements multiple layers of safety:

### 1. System Prompts
Each LLM interaction uses carefully crafted system prompts that explicitly prohibit:
- Diagnosing conditions
- Prescribing medications
- Providing emergency medical instructions
- Speculating about conditions

### 2. Output Sanitization
All LLM outputs are scanned for forbidden patterns and sanitized:
```javascript
const FORBIDDEN_OUTPUT_PATTERNS = [
  /you\s*(have|might\s*have|could\s*have)/i,
  /diagnosis\s*is/i,
  /prescribe/i,
  // ... more patterns
];
```

### 3. Emergency Override
The system uses hardcoded pattern matching to detect emergency symptoms:
```javascript
const EMERGENCY_PATTERNS = [
  /chest\s*pain/i,
  /can'?t\s*breathe/i,
  /stroke/i,
  /suicid/i,
  // ... more patterns
];
```
When detected, these **override** the LLM's risk assessment to RED.

## Privacy Controls

Patient privacy is enforced at multiple levels:

1. **Database Level**: Doctor queries include `WHERE is_shared = TRUE`
2. **API Level**: Middleware verifies sharing status before returning data
3. **UI Level**: Private sessions are not displayed in doctor dashboard

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Disclaimer

**This software is for educational and demonstration purposes only.** It is NOT a medical device and should NOT be used for actual medical diagnosis, treatment, or emergency situations. Always consult qualified healthcare professionals for medical advice.

---

Built with ❤️ for better healthcare accessibility
