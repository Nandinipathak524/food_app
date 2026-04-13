/**
 * Authentication Context
 *
 * Manages user authentication state, login/logout,
 * and persists auth token in localStorage.
 */

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')

      if (storedToken) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
          const response = await api.get('/auth/me')
          setUser(response.data.data.user)
          setToken(storedToken)
        } catch (error) {
          // Token invalid or expired
          localStorage.removeItem('token')
          delete api.defaults.headers.common['Authorization']
          setUser(null)
          setToken(null)
        }
      }

      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { user: userData, token: authToken } = response.data.data

    localStorage.setItem('token', authToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`

    setUser(userData)
    setToken(authToken)

    return userData
  }

  const register = async (data) => {
    const response = await api.post('/auth/register', data)
    const { user: userData, token: authToken } = response.data.data

    localStorage.setItem('token', authToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`

    setUser(userData)
    setToken(authToken)

    return userData
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setToken(null)
  }

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }))
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isDoctor: user?.role === 'doctor',
    isPatient: user?.role === 'patient',
    login,
    register,
    logout,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
