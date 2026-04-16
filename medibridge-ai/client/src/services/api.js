/**
 * API Service
 *
 * Axios instance configured for the MediBridge API.
 * Handles authentication headers and error responses.
 */

import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 seconds
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred'

    // Handle specific error codes
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect
      localStorage.removeItem('token')
      window.location.href = '/login'
      toast.error('Session expired. Please login again.')
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.')
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    }

    return Promise.reject(error)
  }
)

export default api

// ==================== AUTH API ====================

export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  register: (data) =>
    api.post('/auth/register', data),

  getProfile: () =>
    api.get('/auth/me'),

  updateProfile: (data) =>
    api.put('/auth/profile', data)
}

// ==================== PATIENT API ====================

export const patientAPI = {
  createSession: (data) =>
    api.post('/patient/session', data),

  getSessions: () =>
    api.get('/patient/sessions'),

  getSessionDetails: (sessionId) =>
    api.get(`/patient/session/${sessionId}`),

  answerFollowup: (sessionId, answers) =>
    api.post(`/patient/session/${sessionId}/answer`, { answers }),

  uploadReport: (sessionId, file) => {
    const formData = new FormData()
    formData.append('report', file)
    return api.post(`/patient/session/${sessionId}/upload-report`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  askReportQuestion: (sessionId, reportId, question) =>
    api.post(`/patient/session/${sessionId}/report/${reportId}/ask`, { question }),

  togglePrivacy: (sessionId, isShared, doctorId = null) =>
    api.post(`/patient/session/${sessionId}/privacy-toggle`, { is_shared: isShared, doctor_id: doctorId }),

  getDoctors: () =>
    api.get('/patient/doctors'),

  askDoctor: (sessionId, question, doctorId) =>
    api.post(`/patient/session/${sessionId}/ask-doctor`, { question, doctor_id: doctorId }),

  analyzeReport: (file) => {
    const formData = new FormData()
    formData.append('report', file)
    return api.post('/patient/analyze-report', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    })
  }
}

// ==================== DOCTOR API ====================

export const doctorAPI = {
  getStats: () =>
    api.get('/doctor/stats'),

  getPatients: (params = {}) =>
    api.get('/doctor/patients', { params }),

  getSessionDetails: (sessionId) =>
    api.get(`/doctor/session/${sessionId}`),

  getPendingQuestions: () =>
    api.get('/doctor/questions'),

  replyToQuestion: (sessionId, questionId, answer) =>
    api.post(`/doctor/session/${sessionId}/reply`, { questionId, answer }),

  askPatient: (sessionId, question, questionType = 'general') =>
    api.post(`/doctor/session/${sessionId}/ask`, { question, question_type: questionType }),

  addNote: (sessionId, note, noteType = 'general') =>
    api.post(`/doctor/session/${sessionId}/note`, { note, note_type: noteType }),

  downloadPDF: (sessionId) =>
    api.get(`/doctor/session/${sessionId}/pdf`, { responseType: 'blob' }),

  getReportFile: (reportId) =>
    api.get(`/doctor/report/${reportId}/file`, { responseType: 'blob' })
}

