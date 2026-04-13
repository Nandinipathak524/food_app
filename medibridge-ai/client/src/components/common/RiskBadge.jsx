/**
 * Risk Badge Component
 *
 * Displays risk level with appropriate color coding.
 */

import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

const riskConfig = {
  green: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: CheckCircle,
    label: 'Low Risk'
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    icon: AlertTriangle,
    label: 'Moderate Risk'
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: AlertCircle,
    label: 'High Risk'
  }
}

function RiskBadge({ level, showLabel = true, size = 'md' }) {
  const config = riskConfig[level] || riskConfig.yellow

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const Icon = config.icon

  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full font-medium
      ${config.bg} ${config.text} ${sizeClasses[size]}
    `}>
      <Icon className={iconSizes[size]} />
      {showLabel && config.label}
    </span>
  )
}

export default RiskBadge
