'use client'

import { useState } from 'react'
import { EmployeeScanInput } from '@/components/EmployeeScanInput'

interface TicketCloseActionsProps {
  isUpdating: boolean
  onQrClose: (scannedEmployeeNo: string) => Promise<void>
  onOverrideClose: (reason?: string) => Promise<void>
}

type Mode = 'idle' | 'qr' | 'override'

export function TicketCloseActions({ isUpdating, onQrClose, onOverrideClose }: TicketCloseActionsProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await onOverrideClose(reason.trim() || undefined)
    } catch (err: any) {
      setError(err.message || 'Override close failed.')
    }
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-col space-y-2 pt-3 border-t border-gray-100">
        <span className="text-xs font-medium text-gray-500 uppercase">Close Ticket</span>
        <button
          type="button"
          onClick={() => setMode('qr')}
          disabled={isUpdating}
          className="px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Confirm &amp; Close via QR
        </button>
        <button
          type="button"
          onClick={() => setMode('override')}
          disabled={isUpdating}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Override Close (no scan)
        </button>
      </div>
    )
  }

  if (mode === 'qr') {
    return (
      <div className="pt-3 border-t border-gray-100">
        <EmployeeScanInput
          title="Scan Requester ID"
          submitLabel="Confirm Close"
          submittingLabel="Closing..."
          onSubmit={onQrClose}
          onCancel={() => setMode('idle')}
          disabled={isUpdating}
          accentColor="green"
        />
      </div>
    )
  }

  return (
    <form onSubmit={submitOverride} className="flex flex-col space-y-2 pt-3 border-t border-gray-100">
      <span className="text-xs font-medium text-gray-500 uppercase">Override Reason (optional)</span>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Requester unreachable, closing per manager approval"
        className="border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 resize-none"
        disabled={isUpdating}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={isUpdating}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {isUpdating ? 'Closing...' : 'Close Without Scan'}
        </button>
        <button
          type="button"
          onClick={() => { setMode('idle'); setError(null); setReason('') }}
          disabled={isUpdating}
          className="px-3 py-2 text-sm rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}