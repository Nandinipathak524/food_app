/**
 * Main App Component
 *
 * Handles routing and role-based navigation.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout
import Layout from './components/common/Layout'
import LoadingScreen from './components/common/LoadingScreen'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard'
import NewSession from './pages/patient/NewSession'
import SessionDetails from './pages/patient/SessionDetails'

// Doctor pages
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorSessionView from './pages/doctor/DoctorSessionView'
import PendingQuestions from './pages/doctor/PendingQuestions'

// Protected route wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'doctor') {
      return <Navigate to="/doctor" replace />
    }
    return <Navigate to="/patient" replace />
  }

  return children
}

// Public route (redirect if already logged in)
function PublicRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    // Redirect to appropriate dashboard
    if (user.role === 'doctor') {
      return <Navigate to="/doctor" replace />
    }
    return <Navigate to="/patient" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <RegisterPage />
        </PublicRoute>
      } />

      {/* Patient routes */}
      <Route path="/patient" element={
        <ProtectedRoute allowedRoles={['patient']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<PatientDashboard />} />
        <Route path="new-session" element={<NewSession />} />
        <Route path="session/:sessionId" element={<SessionDetails />} />
      </Route>

      {/* Doctor routes */}
      <Route path="/doctor" element={
        <ProtectedRoute allowedRoles={['doctor']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<DoctorDashboard />} />
        <Route path="session/:sessionId" element={<DoctorSessionView />} />
        <Route path="questions" element={<PendingQuestions />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
