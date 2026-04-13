/**
 * Pending Questions Page
 *
 * Lists all unanswered patient questions for the doctor to respond to.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { doctorAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  MessageSquare,
  Clock,
  ChevronRight,
  Loader2,
  Inbox,
  Send
} from 'lucide-react'
import toast from 'react-hot-toast'

function PendingQuestions() {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await doctorAPI.getPendingQuestions()
      setQuestions(response.data.data.questions)
    } catch (error) {
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (sessionId, questionId) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply')
      return
    }

    setSubmitting(true)
    try {
      await doctorAPI.replyToQuestion(sessionId, questionId, replyText)
      toast.success('Reply sent')
      setReplyingTo(null)
      setReplyText('')
      // Remove answered question from list
      setQuestions(prev => prev.filter(q => q.id !== questionId))
    } catch (error) {
      toast.error('Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-primary-600" />
          Pending Questions
        </h1>
        <p className="text-gray-600 mt-1">
          {questions.length} question(s) awaiting your response
        </p>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="card text-center py-12">
          <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600">
            You have no pending patient questions at the moment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="card">
              <div className="flex items-start gap-4">
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">{q.patient_name}</span>
                    <RiskBadge level={q.risk_level} size="sm" />
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(q.created_at)}
                    </span>
                  </div>

                  <p className="text-gray-800 mb-4">{q.question}</p>

                  {/* Reply form or button */}
                  {replyingTo === q.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="form-input flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleReply(q.session_id, q.id)
                          }
                        }}
                      />
                      <button
                        onClick={() => handleReply(q.session_id, q.id)}
                        disabled={submitting}
                        className="btn btn-primary"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyText('')
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setReplyingTo(q.id)}
                        className="btn btn-primary"
                      >
                        Reply
                      </button>
                      <Link
                        to={`/doctor/session/${q.session_id}`}
                        className="btn btn-outline flex items-center gap-2"
                      >
                        View Session
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingQuestions
