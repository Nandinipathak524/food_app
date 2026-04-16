/**
 * Login Page
 *
 * User authentication with email and password.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Stethoscope, Mail, Lock, Loader2, Eye, EyeOff, Users, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState('patient')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)

    try {
      const user = await login(formData.email, formData.password)
      toast.success('Welcome back!')

      // Redirect based on role
      if (user.role === 'doctor') {
        navigate('/doctor')
      } else {
        navigate('/patient')
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <Stethoscope className="w-10 h-10 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">MediBridge AI</h1>
          </div>
          <p className="text-gray-600">Hospital Pre-Consultation Platform</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role toggle */}
            <div>
              <label className="form-label">Login as</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`
                    flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors
                    ${role === 'patient'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <Users className="w-5 h-5" />
                  Patient
                </button>
                <button
                  type="button"
                  onClick={() => setRole('doctor')}
                  className={`
                    flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors
                    ${role === 'doctor'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <UserCog className="w-5 h-5" />
                  Doctor
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="form-label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`form-input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`form-input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Create Account
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Demo Credentials ({role === 'doctor' ? 'Doctor' : 'Patient'}):</p>
            <div className="text-xs text-gray-600">
              {role === 'doctor' ? (
                <p><span className="font-medium">Email:</span> doctor1@medibridge.com &nbsp;|&nbsp; <span className="font-medium">Password:</span> Doctor123!</p>
              ) : (
                <p><span className="font-medium">Email:</span> patient1@test.com &nbsp;|&nbsp; <span className="font-medium">Password:</span> Patient123!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
