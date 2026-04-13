/**
 * Loading Screen Component
 *
 * Full-page loading indicator shown during auth initialization.
 */

import { Stethoscope, Loader2 } from 'lucide-react'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Stethoscope className="w-10 h-10 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">MediBridge AI</h1>
        </div>
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
        <p className="mt-2 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default LoadingScreen
