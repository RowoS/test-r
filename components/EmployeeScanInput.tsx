'use client'

import { useState } from 'react'
import { toFriendlyMessage } from '@/lib/qr/errors'

export interface EmployeeScanInputProps {
  title: string
  description?: string
  submitLabel: string
  submittingLabel: string
  onSubmit: (scannedEmployeeNo: string) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  accentColor?: 'blue' | 'green'
}

// Owns the scan input, its own submit state, and error display. Every
// QR-verification touchpoint (creation confirm, ticket close, and
// whatever comes next) hands this an onSubmit that calls the right
// server action — this component doesn't know or care which one.
export function EmployeeScanInput({
  title,
  description,
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
  disabled = false,
  accentColor = 'blue',
}: EmployeeScanInputProps) {
  const [employeeNo, setEmployeeNo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBusy = disabled || isSubmitting
  const ring = accentColor === 'green' ? 'focus:ring-green-500' : 'focus:ring-blue-500'
  const button =
    accentColor === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : 'bg-blue-600 hover:bg-blue-700'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = employeeNo.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(trimmed)
    } catch (err: any) {
      setError(toFriendlyMessage(err.message) || 'Scan did not match this ticket\'s requester.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      <span className="text-xs font-medium text-gray-500 uppercase">{title}</span>
      {description && <p className="text-sm text-gray-600">{description}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
        <input
          type="text"
          autoFocus
          value={employeeNo}
          onChange={(e) => setEmployeeNo(e.target.value)}
          placeholder="Scan or type employee ID..."
          className={`border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 ${ring}`}
          disabled={isBusy}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isBusy || !employeeNo.trim()}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md text-white disabled:opacity-50 transition-colors ${button}`}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="px-3 py-2 text-sm rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}