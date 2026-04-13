/**
 * Doctor Session View
 *
 * Detailed view of a patient's session with ability to
 * add notes, reply to questions, and download PDF.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doctorAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  ArrowLeft,
  Loader2,
  Download,
  MessageSquare,
  Send,
  FileText,
  StickyNote,
  Plus,
  AlertCircle,
  User,
  Calendar,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'

function DoctorSessionView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [session, setSession] = useState(null)
  const [aiIntake, setAiIntake] = useState([])
  const [patientQuestions, setPatientQuestions] = useState([])
  const [reports, setReports] = useState([])
  const [notes, setNotes] = useState([])

  // Reply state
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // Note state
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('general')
  const [submittingNote, setSubmittingNote] = useState(false)

  useEffect(() => {
    fetchSessionDetails()
  }, [sessionId])

  const fetchSessionDetails = async () => {
    try {
      const response = await doctorAPI.getSessionDetails(sessionId)
      const data = response.data.data
      setSession(data.session)
      setAiIntake(data.aiIntake)
      setPatientQuestions(data.patientQuestions)
      setReports(data.reports)
      setNotes(data.notes)
    } catch (error) {
      toast.error('Failed to load session details')
      navigate('/doctor')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true)
    try {
      const response = await doctorAPI.downloadPDF(sessionId)

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `patient_summary_${sessionId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF downloaded successfully')
    } catch (error) {
      toast.error('Failed to download PDF')
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()

    if (!replyText.trim()) {
      toast.error('Please enter a reply')
      return
    }

    setSubmittingReply(true)
    try {
      await doctorAPI.replyToQuestion(sessionId, replyingTo, replyText)
      toast.success('Reply sent')
      setReplyingTo(null)
      setReplyText('')
      fetchSessionDetails()
    } catch (error) {
      toast.error('Failed to send reply')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleAddNote = async (e) => {
    e.preventDefault()

    if (!noteText.trim()) {
      toast.error('Please enter a note')
      return
    }

    setSubmittingNote(true)
    try {
      await doctorAPI.addNote(sessionId, noteText, noteType)
      toast.success('Note added')
      setShowNoteForm(false)
      setNoteText('')
      setNoteType('general')
      fetchSessionDetails()
    } catch (error) {
      toast.error('Failed to add note')
    } finally {
      setSubmittingNote(false)
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

  if (!session) return null

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/doctor')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{session.patient_name}</h1>
            <RiskBadge level={session.risk_level} />
          </div>
          <p className="text-gray-600 text-sm mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(session.created_at)}
          </p>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={downloadingPDF}
          className="btn btn-primary"
        >
          {downloadingPDF ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
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
              <h3 className="font-semibold text-red-900">High Risk Patient</h3>
              <p className="text-red-800 text-sm mt-1">
                This patient's symptoms have been flagged as high risk.
                Please review and follow up as appropriate.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Patient Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Patient Information
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Age</p>
              <p className="font-medium">{session.age || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Gender</p>
              <p className="font-medium capitalize">{session.gender || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="font-medium">{session.duration || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Severity</p>
              <p className="font-medium capitalize">{session.severity || 'N/A'}</p>
            </div>
          </div>

          {session.existing_conditions && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 font-medium mb-1">Existing Conditions</p>
              <p className="text-yellow-900">{session.existing_conditions}</p>
            </div>
          )}
        </div>

        {/* Chief Complaint */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chief Complaint</h2>
          <p className="text-gray-800">{session.symptoms}</p>
        </div>

        {/* AI Summary */}
        {session.safe_ai_summary && (
          <div className="card bg-blue-50 border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">AI-Generated Summary</h2>
            <p className="text-blue-800">{session.safe_ai_summary}</p>
          </div>
        )}

        {/* AI Intake Q&A */}
        {aiIntake.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Intake Interview</h2>
            <div className="space-y-3">
              {aiIntake.map((qa) => (
                <div key={qa.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 text-sm mb-1">{qa.question}</p>
                  <p className="text-gray-700">{qa.answer || 'Not answered'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medical Reports */}
        {reports.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Medical Reports</h2>
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{report.original_filename}</p>
                      <p className="text-xs text-gray-500">
                        {report.report_type && `Type: ${report.report_type.replace('_', ' ')} • `}
                        {formatDate(report.created_at)}
                      </p>
                      {report.ai_report_summary && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{report.ai_report_summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Questions */}
        {patientQuestions.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Patient Questions
            </h2>
            <div className="space-y-4">
              {patientQuestions.map((qa) => (
                <div key={qa.id} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="font-medium text-purple-900 mb-2">{qa.question}</p>
                  <p className="text-xs text-purple-600 mb-3">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDate(qa.created_at)}
                  </p>

                  {qa.answer ? (
                    <div className="p-3 bg-white rounded-lg border border-purple-200">
                      <p className="text-sm font-medium text-gray-700 mb-1">Your reply:</p>
                      <p className="text-gray-800">{qa.answer}</p>
                    </div>
                  ) : replyingTo === qa.id ? (
                    <form onSubmit={handleReply} className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="form-input flex-1"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={submittingReply}
                        className="btn btn-primary"
                      >
                        {submittingReply ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyText('')
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setReplyingTo(qa.id)}
                      className="btn btn-outline text-sm"
                    >
                      Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Notes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <StickyNote className="w-5 h-5" />
              Clinical Notes
            </h2>
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Note
            </button>
          </div>

          {/* Add note form */}
          {showNoteForm && (
            <form onSubmit={handleAddNote} className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="mb-3">
                <label className="form-label">Note Type</label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="form-select"
                >
                  <option value="general">General</option>
                  <option value="recommendation">Recommendation</option>
                  <option value="followup">Follow-up Required</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Note</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="form-textarea"
                  placeholder="Enter your clinical note..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submittingNote}
                  className="btn btn-primary"
                >
                  {submittingNote ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteForm(false)
                    setNoteText('')
                    setNoteType('general')
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Existing notes */}
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No clinical notes yet</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`
                    p-4 rounded-lg border
                    ${note.note_type === 'urgent' ? 'bg-red-50 border-red-200' :
                      note.note_type === 'followup' ? 'bg-yellow-50 border-yellow-200' :
                      note.note_type === 'recommendation' ? 'bg-green-50 border-green-200' :
                      'bg-gray-50 border-gray-200'}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`
                      text-xs font-medium px-2 py-0.5 rounded-full capitalize
                      ${note.note_type === 'urgent' ? 'bg-red-200 text-red-800' :
                        note.note_type === 'followup' ? 'bg-yellow-200 text-yellow-800' :
                        note.note_type === 'recommendation' ? 'bg-green-200 text-green-800' :
                        'bg-gray-200 text-gray-800'}
                    `}>
                      {note.note_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {note.doctor_name} • {formatDate(note.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-800">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DoctorSessionView
