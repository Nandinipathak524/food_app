/**
 * Session Details Page (Patient View)
 *
 * Shows full session details including AI summary, Q&A,
 * reports, privacy controls, and doctor communication.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { patientAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Upload,
  FileText,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  Stethoscope,
  Search,
  X,
  UserCog
} from 'lucide-react'
import toast from 'react-hot-toast'

function SessionDetails() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [followupQA, setFollowupQA] = useState([])
  const [reports, setReports] = useState([])
  const [doctorNotes, setDoctorNotes] = useState([])

  const [uploading, setUploading] = useState(false)
  const [askingDoctor, setAskingDoctor] = useState(false)
  const [doctorQuestion, setDoctorQuestion] = useState('')

  // Doctor selection modal state
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [doctorSearch, setDoctorSearch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  useEffect(() => {
    fetchSessionDetails()
  }, [sessionId])

  const fetchSessionDetails = async () => {
    try {
      const response = await patientAPI.getSessionDetails(sessionId)
      const { session, followupQA, reports, doctorNotes } = response.data.data
      setSession(session)
      setFollowupQA(followupQA)
      setReports(reports)
      setDoctorNotes(doctorNotes)
    } catch (error) {
      toast.error('Failed to load session details')
      navigate('/patient')
    } finally {
      setLoading(false)
    }
  }

  const fetchDoctors = async () => {
    setDoctorsLoading(true)
    try {
      const response = await patientAPI.getDoctors()
      setDoctors(response.data.data.doctors)
    } catch (error) {
      toast.error('Failed to load doctors')
    } finally {
      setDoctorsLoading(false)
    }
  }

  const handleShareClick = () => {
    if (session.is_shared) {
      // If already shared, just unshare
      handleUnshare()
    } else {
      // Open doctor selection modal
      setShowDoctorModal(true)
      setDoctorSearch('')
      setSelectedDoctor(null)
      fetchDoctors()
    }
  }

  const handleSelectDoctor = async (doctor) => {
    try {
      await patientAPI.togglePrivacy(sessionId, true, doctor.id)
      setSession(prev => ({ ...prev, is_shared: true }))
      setSelectedDoctor(doctor)
      setShowDoctorModal(false)
      toast.success(`Session shared with ${doctor.name}`)
    } catch (error) {
      toast.error('Failed to share session')
    }
  }

  const handleUnshare = async () => {
    try {
      await patientAPI.togglePrivacy(sessionId, false)
      setSession(prev => ({ ...prev, is_shared: false }))
      setSelectedDoctor(null)
      toast.success('Session is now private')
    } catch (error) {
      toast.error('Failed to update privacy setting')
    }
  }

  const filteredDoctors = doctors.filter(doc => {
    const search = doctorSearch.toLowerCase()
    if (!search) return true
    return (
      doc.name.toLowerCase().includes(search) ||
      (doc.specialization && doc.specialization.toLowerCase().includes(search))
    )
  })

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploading(true)

    try {
      const response = await patientAPI.uploadReport(sessionId, file)
      toast.success('Report uploaded and processed')

      // Refresh to get new report
      fetchSessionDetails()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload report')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAskDoctor = async (e) => {
    e.preventDefault()

    if (!doctorQuestion.trim()) {
      toast.error('Please enter a question')
      return
    }

    if (!session.is_shared) {
      toast.error('Please enable sharing to ask questions to doctors')
      return
    }

    setAskingDoctor(true)

    try {
      await patientAPI.askDoctor(sessionId, doctorQuestion)
      toast.success('Your question has been submitted')
      setDoctorQuestion('')
      fetchSessionDetails()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit question')
    } finally {
      setAskingDoctor(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/patient')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Session Details</h1>
            <RiskBadge level={session.risk_level} />
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Created {formatDate(session.created_at)}
          </p>
        </div>

        {/* Privacy toggle */}
        <button
          onClick={handleShareClick}
          className={`
            btn flex items-center gap-2
            ${session.is_shared
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          `}
        >
          {session.is_shared ? (
            <>
              <Eye className="w-4 h-4" />
              Shared{selectedDoctor ? ` with ${selectedDoctor.name}` : ' with Doctors'}
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" />
              Share with Doctor
            </>
          )}
        </button>
      </div>

      {/* Risk warning for red */}
      {session.risk_level === 'red' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">High Risk Assessment</h3>
              <p className="text-red-800 text-sm mt-1">
                Based on your symptoms, we recommend seeking medical attention promptly.
                Please consult with a healthcare professional as soon as possible.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Symptoms section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reported Symptoms</h2>

          <div className="space-y-4">
            <div>
              <p className="text-gray-800">{session.symptoms}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1">Duration</p>
                <p className="font-medium">{session.duration || 'Not specified'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1">Severity</p>
                <p className="font-medium capitalize">{session.severity}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1">Age</p>
                <p className="font-medium">{session.age || 'Not specified'}</p>
              </div>
            </div>

            {session.existing_conditions && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1 text-sm">Existing Conditions</p>
                <p className="text-gray-800">{session.existing_conditions}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {session.safe_ai_summary && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary-600" />
              AI-Generated Summary
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>{session.safe_ai_summary}</p>
            </div>
          </div>
        )}

        {/* Follow-up Q&A */}
        {followupQA.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Follow-up Questions & Answers
            </h2>
            <div className="space-y-4">
              {followupQA.filter(qa => qa.asked_by === 'ai').map((qa) => (
                <div key={qa.id} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">{qa.question}</p>
                  <p className="text-gray-700">{qa.answer || 'Not answered'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medical Reports */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Medical Reports</h2>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-primary"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Report
                </>
              )}
            </button>
          </div>

          {reports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No reports uploaded yet. Upload your medical test reports for AI analysis.
            </p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="w-8 h-8 text-red-500" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{report.original_filename}</p>
                      <p className="text-xs text-gray-500 mb-2">
                        {report.report_type && `Type: ${report.report_type.replace('_', ' ')} • `}
                        {formatDate(report.created_at)}
                      </p>
                      {report.ai_report_summary && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">AI Summary:</p>
                          <p className="text-sm text-blue-800">{report.ai_report_summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doctor Notes */}
        {doctorNotes.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Doctor's Notes</h2>
            <div className="space-y-4">
              {doctorNotes.map((note, index) => (
                <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-green-900">
                      {note.doctor_name}
                      {note.note_type !== 'general' && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-green-200 rounded-full capitalize">
                          {note.note_type}
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-green-700">
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                  <p className="text-green-800">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Questions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Questions to Doctor
          </h2>

          {/* Existing questions */}
          {followupQA.filter(qa => qa.asked_by === 'patient' && qa.question_type === 'doctor_question').length > 0 && (
            <div className="space-y-3 mb-4">
              {followupQA
                .filter(qa => qa.asked_by === 'patient' && qa.question_type === 'doctor_question')
                .map((qa) => (
                  <div key={qa.id} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 mb-2">{qa.question}</p>
                    {qa.answer ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <p className="text-gray-700">{qa.answer}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Awaiting response...</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Ask question form */}
          {session.is_shared ? (
            <form onSubmit={handleAskDoctor} className="flex gap-3">
              <input
                type="text"
                value={doctorQuestion}
                onChange={(e) => setDoctorQuestion(e.target.value)}
                placeholder="Type your question for the doctor..."
                className="form-input flex-1"
              />
              <button
                type="submit"
                disabled={askingDoctor || !doctorQuestion.trim()}
                className="btn btn-primary"
              >
                {askingDoctor ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">
              Enable sharing to ask questions to doctors
            </p>
          )}
        </div>
      </div>

      {/* Doctor Selection Modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Select a Doctor</h3>
              <button
                onClick={() => setShowDoctorModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Search by name or specialization..."
                  className="form-input pl-10"
                  autoFocus
                />
              </div>
            </div>

            {/* Doctor list */}
            <div className="flex-1 overflow-y-auto p-4">
              {doctorsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {doctorSearch ? 'No doctors found matching your search.' : 'No doctors available.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDoctors.map((doctor) => (
                    <button
                      key={doctor.id}
                      onClick={() => handleSelectDoctor(doctor)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <UserCog className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{doctor.name}</p>
                        {doctor.specialization && (
                          <p className="text-sm text-gray-500">{doctor.specialization}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionDetails
