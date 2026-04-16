/**
 * Patient Dashboard
 *
 * Shows list of screening sessions with their status and risk levels.
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { patientAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  PlusCircle,
  FileText,
  Clock,
  ChevronRight,
  Loader2,
  FolderOpen,
  Eye,
  EyeOff,
  Upload,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

function PatientDashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  // Report analyzer state
  const [reportFile, setReportFile] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportResult, setReportResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await patientAPI.getSessions()
      setSessions(response.data.data.sessions)
    } catch (error) {
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  // Report analyzer handlers
  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (!selected) return

    if (selected.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 10MB.')
      return
    }
    setReportFile(selected)
    setReportResult(null)
  }

  const handleAnalyze = async () => {
    if (!reportFile) return
    setReportLoading(true)
    setReportResult(null)

    try {
      const response = await patientAPI.analyzeReport(reportFile)
      setReportResult(response.data.data)
      toast.success('Report analyzed successfully!')
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to analyze report.'
      toast.error(message)
    } finally {
      setReportLoading(false)
    }
  }

  const handleClearReport = () => {
    setReportFile(null)
    setReportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const styles = {
      intake: 'bg-blue-100 text-blue-800',
      followup: 'bg-purple-100 text-purple-800',
      reviewed: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800'
    }

    const labels = {
      intake: 'Intake',
      followup: 'Awaiting Answers',
      reviewed: 'Reviewed',
      completed: 'Completed'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.intake}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
          <p className="text-gray-600 mt-1">View and manage your pre-consultation sessions</p>
        </div>
        <Link
          to="/patient/new-session"
          className="btn btn-primary"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          New Consultation
        </Link>
      </div>

      {/* Report Analyzer */}
      <div className="card mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Report Analyzer</h3>
            <p className="text-sm text-gray-500">Upload a medical test report (PDF) to get an AI-powered summary</p>
          </div>
        </div>

        {!reportFile ? (
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-gray-600 font-medium text-sm">Click to select a PDF file</p>
            <p className="text-xs text-gray-400 mt-1">PDF only, max 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">{reportFile.name}</p>
                <p className="text-sm text-gray-500">{(reportFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={handleClearReport}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {reportFile && !reportResult && (
          <button
            onClick={handleAnalyze}
            disabled={reportLoading}
            className="btn btn-primary w-full mt-4"
          >
            {reportLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Analyzing report...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Analyze Report
              </>
            )}
          </button>
        )}

        {reportResult && (
          <div className="mt-4 fade-in">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900">Analysis Result</span>
              <span className="text-sm text-gray-500">({reportResult.reportType || 'General'})</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {reportResult.aiSummary}
            </div>
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                This AI analysis is for informational purposes only. Always consult a healthcare professional for interpretation.
              </p>
            </div>
            <button onClick={handleClearReport} className="btn btn-outline w-full mt-3">
              Analyze Another Report
            </button>
          </div>
        )}
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="card text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
          <p className="text-gray-600 mb-6">
            Start a new pre-consultation to describe your symptoms and get AI-assisted guidance.
          </p>
          <Link to="/patient/new-session" className="btn btn-primary">
            <PlusCircle className="w-5 h-5 mr-2" />
            Start New Consultation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              to={`/patient/session/${session.id}`}
              className="card card-hover flex items-center gap-4"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <RiskBadge level={session.risk_level} size="sm" />
                  {getStatusBadge(session.status)}
                  {session.is_shared ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <Eye className="w-3 h-3" /> Shared
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <EyeOff className="w-3 h-3" /> Private
                    </span>
                  )}
                </div>

                <p className="text-gray-900 font-medium truncate">
                  {session.symptoms.substring(0, 100)}
                  {session.symptoms.length > 100 ? '...' : ''}
                </p>

                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(session.created_at)}
                  </span>
                  {session.reportCount > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {session.reportCount} report(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default PatientDashboard
