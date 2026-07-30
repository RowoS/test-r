'use client'

import { useState } from 'react'
import { useQrScanner, type QrScannerError } from '@/lib/hooks/useQRScanner'
import { toFriendlyMessage } from '@/lib/qr/errors'
import type { EmployeeScanInputProps } from '@/components/EmployeeScanInput'

// Same shape as EmployeeScanInput minus submitLabel — there's no submit
// button here, the decode itself is the submit. Kept as an Omit (rather
// than a separate interface) so EmployeeVerification can spread one prop
// object at either child without a mapping step.
type QrCameraScannerProps = Omit<EmployeeScanInputProps, 'submitLabel'>

const SCANNER_ERROR_COPY: Record<QrScannerError, string> = {
  'insecure-context': 'Camera scanning needs a secure (https) connection. Enter the ID manually instead.',
  'no-camera-support': "This browser doesn't support camera access. Enter the ID manually instead.",
  'permission-denied': 'Camera access was denied. Allow camera access, or enter the ID manually.',
  'no-camera-found': 'No camera was found on this device. Enter the ID manually instead.',
  'camera-in-use': 'The camera is in use by another app. Close it, or enter the ID manually.',
  unknown: "Couldn't start the camera. Enter the ID manually instead.",
}

export function QrCameraScanner({
  title,
  description,
  submittingLabel,
  onSubmit,
  onCancel,
  disabled = false,
  accentColor = 'blue',
}: QrCameraScannerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBusy = disabled || isSubmitting
  const frameColor = accentColor === 'green' ? 'border-green-400' : 'border-blue-400'
  const button = accentColor === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'

  const { videoRef, isActive, error: cameraError, start, reset } = useQrScanner({
    onDecode: async (value) => {
      setIsSubmitting(true)
      setError(null)
      try {
        await onSubmit(value)
      } catch (err: any) {
        setError(toFriendlyMessage(err.message) || 'Scan did not match this ticket\'s requester.')
        // Give the reader a moment to see the error before the camera is
        // ready to pick up another badge — a lingering QR code still in
        // frame would otherwise immediately re-trigger the same submit.
        window.setTimeout(reset, 1500)
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="flex flex-col space-y-2">
      <span className="text-xs font-medium text-gray-500 uppercase">{title}</span>
      {description && <p className="text-sm text-gray-600">{description}</p>}

      {!isActive && (
        <button
          type="button"
          onClick={() => void start()}
          disabled={isBusy}
          className={`px-3 py-2 text-sm font-medium rounded-md text-white disabled:opacity-50 transition-colors ${button}`}
        >
          Start camera
        </button>
      )}

      {cameraError && <p className="text-xs text-red-600">{SCANNER_ERROR_COPY[cameraError]}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {isSubmitting && <p className="text-xs text-gray-500">{submittingLabel}</p>}

      <div className="relative overflow-hidden rounded-md bg-black aspect-square max-w-xs">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {isActive && (
          <div className={`pointer-events-none absolute inset-6 rounded-md border-2 ${frameColor}`} />
        )}
      </div>

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
  )
}