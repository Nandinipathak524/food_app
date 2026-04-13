/**
 * Patient Dashboard
 *
 * Shows list of screening sessions with their status and risk levels.
 */

import { useState, useEffect } from 'react'
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
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'

function PatientDashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

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
