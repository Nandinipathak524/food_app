/**
 * Doctor Dashboard
 *
 * Shows patient cards with risk levels and pending questions.
 * Only displays sessions that patients have shared.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { doctorAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  Users,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Loader2,
  Search,
  Filter,
  Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'

function DoctorDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  useEffect(() => {
    fetchData()
  }, [riskFilter])

  const fetchData = async () => {
    try {
      const [statsRes, patientsRes] = await Promise.all([
        doctorAPI.getStats(),
        doctorAPI.getPatients({ risk_level: riskFilter || undefined })
      ])

      setStats(statsRes.data.data)
      setPatients(patientsRes.data.data.patients)
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const response = await doctorAPI.getPatients({
        search: searchTerm,
        risk_level: riskFilter || undefined
      })
      setPatients(response.data.data.patients)
    } catch (error) {
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
        <p className="text-gray-600 mt-1">View and manage patient pre-consultations</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPatients}</p>
                <p className="text-sm text-gray-500">Total Patients</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.riskDistribution.red}</p>
                <p className="text-sm text-gray-500">High Risk</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.riskDistribution.yellow}</p>
                <p className="text-sm text-gray-500">Moderate Risk</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingQuestions}</p>
                <p className="text-sm text-gray-500">Pending Questions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending questions alert */}
      {stats?.pendingQuestions > 0 && (
        <Link
          to="/doctor/questions"
          className="block mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">
                You have {stats.pendingQuestions} unanswered patient question(s)
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-purple-600" />
          </div>
        </Link>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search patients by name or symptoms..."
            className="form-input pl-10 w-full"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="form-select"
          >
            <option value="">All Risk Levels</option>
            <option value="red">High Risk</option>
            <option value="yellow">Moderate Risk</option>
            <option value="green">Low Risk</option>
          </select>

          <button
            onClick={handleSearch}
            className="btn btn-primary"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>
      </div>

      {/* Patients list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      ) : patients.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
          <p className="text-gray-600">
            {riskFilter || searchTerm
              ? 'Try adjusting your filters'
              : 'No patients have shared their sessions yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {patients.map((patient) => (
            <Link
              key={patient.session_id}
              to={`/doctor/session/${patient.session_id}`}
              className="card card-hover"
            >
              <div className="flex items-start gap-4">
                {/* Patient info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{patient.patient_name}</h3>
                    <RiskBadge level={patient.risk_level} size="sm" />
                    {patient.unanswered_questions > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        <MessageSquare className="w-3 h-3" />
                        {patient.unanswered_questions} question(s)
                      </span>
                    )}
                  </div>

                  <p className="text-gray-700 mb-3">
                    {patient.short_summary || patient.symptoms?.substring(0, 150)}
                    {(patient.symptoms?.length > 150 && !patient.short_summary) ? '...' : ''}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(patient.updated_at || patient.created_at)}
                    </span>
                    {patient.report_count > 0 && (
                      <span className="flex items-center gap-1">
                        📄 {patient.report_count} report(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default DoctorDashboard
