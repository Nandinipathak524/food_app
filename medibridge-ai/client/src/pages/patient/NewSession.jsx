/**
 * New Session Page
 *
 * Multi-step form for symptom intake and follow-up questions.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientAPI } from '../../services/api'
import RiskBadge from '../../components/common/RiskBadge'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Stethoscope
} from 'lucide-react'
import toast from 'react-hot-toast'

// Dynamic follow-up questions based on symptoms
const symptomTriggers = {
  chest: ['Do you feel pain radiating to your arm, jaw, or back?', 'Are you experiencing shortness of breath?'],
  headache: ['Have you experienced vision changes?', 'Do you feel nauseous or sensitive to light?'],
  breathing: ['Do you have a cough? If yes, is it dry or productive?', 'Have you been exposed to smoke or allergens?'],
  stomach: ['Have you experienced nausea or vomiting?', 'Have your eating habits changed recently?']
}

function NewSession() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    symptoms: '',
    duration: '',
    severity: 'moderate',
    age: '',
    gender: '',
    existing_conditions: ''
  })

  // AI follow-up questions and answers
  const [followupQuestions, setFollowupQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [sessionId, setSessionId] = useState(null)

  // Results
  const [result, setResult] = useState(null)

  // Dynamic questions based on symptoms
  const [dynamicQuestions, setDynamicQuestions] = useState([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Check for symptom triggers
    if (name === 'symptoms') {
      const triggered = []
      Object.entries(symptomTriggers).forEach(([keyword, questions]) => {
        if (value.toLowerCase().includes(keyword)) {
          triggered.push(...questions)
        }
      })
      setDynamicQuestions([...new Set(triggered)])
    }
  }

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // Step 1: Submit initial intake
  const handleIntakeSubmit = async (e) => {
    e.preventDefault()

    if (!formData.symptoms || formData.symptoms.length < 10) {
      toast.error('Please describe your symptoms in more detail')
      return
    }

    setLoading(true)

    try {
      const response = await patientAPI.createSession({
        ...formData,
        age: formData.age ? parseInt(formData.age) : null
      })

      setSessionId(response.data.data.sessionId)
      setFollowupQuestions(response.data.data.followupQuestions)
      setStep(2)
      toast.success('Session created. Please answer the follow-up questions.')
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create session'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Submit follow-up answers
  const handleFollowupSubmit = async (e) => {
    e.preventDefault()

    // Check all questions are answered
    const unanswered = followupQuestions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      toast.error('Please answer all questions')
      return
    }

    setLoading(true)

    try {
      const answerArray = followupQuestions.map(q => ({
        questionId: q.id,
        answer: answers[q.id]
      }))

      const response = await patientAPI.answerFollowup(sessionId, answerArray)

      setResult(response.data.data)
      setStep(3)
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to submit answers'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Render step 1: Initial intake
  const renderIntakeForm = () => (
    <form onSubmit={handleIntakeSubmit} className="space-y-6">
      {/* Symptoms */}
      <div>
        <label className="form-label">
          What symptoms are you experiencing? <span className="text-red-500">*</span>
        </label>
        <textarea
          name="symptoms"
          value={formData.symptoms}
          onChange={handleChange}
          rows={4}
          className="form-textarea"
          placeholder="Describe your symptoms in detail. For example: 'I've been having a persistent headache on the right side of my head, accompanied by mild nausea...'"
        />
        <p className="text-xs text-gray-500 mt-1">
          Be as specific as possible to help us understand your condition better.
        </p>
      </div>

      {/* Dynamic questions based on symptoms */}
      {dynamicQuestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Additional Information
          </h4>
          <div className="space-y-3">
            {dynamicQuestions.map((question, index) => (
              <div key={index}>
                <label className="block text-sm text-blue-800 mb-1">{question}</label>
                <input
                  type="text"
                  className="form-input bg-white"
                  placeholder="Type your answer..."
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      symptoms: `${prev.symptoms}\n${question}: ${e.target.value}`
                    }))
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duration and Severity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">How long have you had these symptoms?</label>
          <select
            name="duration"
            value={formData.duration}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">Select duration</option>
            <option value="Just started">Just started</option>
            <option value="A few hours">A few hours</option>
            <option value="1-2 days">1-2 days</option>
            <option value="3-7 days">3-7 days</option>
            <option value="1-2 weeks">1-2 weeks</option>
            <option value="More than 2 weeks">More than 2 weeks</option>
            <option value="More than a month">More than a month</option>
          </select>
        </div>

        <div>
          <label className="form-label">How severe are your symptoms?</label>
          <select
            name="severity"
            value={formData.severity}
            onChange={handleChange}
            className="form-select"
          >
            <option value="mild">Mild - Noticeable but manageable</option>
            <option value="moderate">Moderate - Affecting daily activities</option>
            <option value="severe">Severe - Very difficult to manage</option>
          </select>
        </div>
      </div>

      {/* Age and Gender */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Age</label>
          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            className="form-input"
            placeholder="Enter your age"
            min="0"
            max="150"
          />
        </div>

        <div>
          <label className="form-label">Gender</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
      </div>

      {/* Existing conditions */}
      <div>
        <label className="form-label">Do you have any existing medical conditions?</label>
        <textarea
          name="existing_conditions"
          value={formData.existing_conditions}
          onChange={handleChange}
          rows={2}
          className="form-textarea"
          placeholder="E.g., diabetes, high blood pressure, asthma, allergies..."
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </div>
    </form>
  )

  // Render step 2: Follow-up questions
  const renderFollowupForm = () => (
    <form onSubmit={handleFollowupSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-sm">
          Please answer these follow-up questions to help us better understand your symptoms.
          Your answers will be reviewed by a healthcare professional.
        </p>
      </div>

      {followupQuestions.map((q, index) => (
        <div key={q.id} className="p-4 bg-gray-50 rounded-lg">
          <label className="block font-medium text-gray-900 mb-2">
            {index + 1}. {q.question}
          </label>
          <textarea
            value={answers[q.id] || ''}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            rows={2}
            className="form-textarea"
            placeholder="Type your answer here..."
          />
        </div>
      ))}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="btn btn-secondary"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              Submit Answers
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </div>
    </form>
  )

  // Render step 3: Results
  const renderResults = () => (
    <div className="space-y-6">
      {/* Risk level card */}
      <div className={`
        rounded-lg p-6 border-2
        ${result.riskLevel === 'red' ? 'bg-red-50 border-red-200' :
          result.riskLevel === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
          'bg-green-50 border-green-200'}
      `}>
        <div className="flex items-center gap-3 mb-4">
          <RiskBadge level={result.riskLevel} size="lg" />
        </div>

        <p className="text-gray-800 mb-4">{result.riskExplanation}</p>

        {result.riskLevel === 'red' && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-4">
            <p className="text-red-800 font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {result.recommendation}
            </p>
          </div>
        )}

        {result.riskLevel === 'yellow' && (
          <p className="text-yellow-800 font-medium">
            {result.recommendation}
          </p>
        )}

        {result.riskLevel === 'green' && (
          <p className="text-green-800">
            {result.recommendation}
          </p>
        )}
      </div>

      {/* AI Summary */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary-600" />
          Pre-Consultation Summary
        </h3>
        <div className="prose prose-sm max-w-none text-gray-700">
          <p>{result.summary}</p>
        </div>
      </div>

      {/* Next steps */}
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          What's Next?
        </h3>
        <ul className="text-primary-800 space-y-2 text-sm">
          <li>• Your session has been saved and can be shared with doctors</li>
          <li>• You can upload any medical reports or test results</li>
          <li>• Ask questions directly to healthcare professionals</li>
          <li>• Toggle privacy settings to control who can view your data</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate(`/patient/session/${sessionId}`)}
          className="btn btn-primary flex-1"
        >
          View Full Session
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
        <button
          onClick={() => navigate('/patient')}
          className="btn btn-secondary"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`
                flex items-center justify-center w-10 h-10 rounded-full font-medium
                ${step >= s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-500'}
              `}
            >
              {step > s ? <CheckCircle className="w-5 h-5" /> : s}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Describe Symptoms</span>
          <span>Answer Questions</span>
          <span>View Results</span>
        </div>
      </div>

      {/* Step content */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {step === 1 && 'Tell us about your symptoms'}
          {step === 2 && 'Follow-up Questions'}
          {step === 3 && 'Your Assessment Results'}
        </h2>

        {step === 1 && renderIntakeForm()}
        {step === 2 && renderFollowupForm()}
        {step === 3 && renderResults()}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        This is a pre-consultation tool and does not provide medical diagnosis.
        Always consult with a healthcare professional for medical advice.
      </p>
    </div>
  )
}

export default NewSession
