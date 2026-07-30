'use client'

import { useState } from 'react'
import { useIsTouchPrimary } from '@/lib/hooks/useMedia'
import { EmployeeScanInput, type EmployeeScanInputProps } from '@/components/EmployeeScanInput'
import { QrCameraScanner } from './QrCameraScanner'

type Mode = 'scan' | 'manual'

const TAB_BASE = 'px-3 py-1 text-xs font-medium rounded-md border transition-colors'
const TAB_ACTIVE = 'bg-gray-800 text-white border-gray-800'
const TAB_INACTIVE = 'border-gray-300 text-gray-600 hover:bg-gray-50'

/**
 * Drop-in replacement for EmployeeScanInput wherever a person needs to
 * verify a badge: phones default to the camera, mice/trackpads default to
 * manual entry (agenda item 5 — camera scan on phone, manual confirmation
 * stays available on PC/laptop) — and either can switch to the other.
 */
export function EmployeeVerification(props: EmployeeScanInputProps) {
  const isTouchPrimary = useIsTouchPrimary()
  const [mode, setMode] = useState<Mode | null>(null)
  const resolvedMode: Mode = mode ?? (isTouchPrimary ? 'scan' : 'manual')

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex space-x-2" role="tablist" aria-label="Verification method">
        <button
          type="button"
          role="tab"
          aria-selected={resolvedMode === 'scan'}
          onClick={() => setMode('scan')}
          disabled={props.disabled}
          className={`${TAB_BASE} ${resolvedMode === 'scan' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          Scan badge
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={resolvedMode === 'manual'}
          onClick={() => setMode('manual')}
          disabled={props.disabled}
          className={`${TAB_BASE} ${resolvedMode === 'manual' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          Enter manually
        </button>
      </div>

      {resolvedMode === 'scan' ? <QrCameraScanner {...props} /> : <EmployeeScanInput {...props} />}
    </div>
  )
}