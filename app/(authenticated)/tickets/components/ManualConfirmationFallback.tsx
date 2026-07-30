'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmTicketCreation } from '@/lib/ticket-actions'
import { EmployeeVerification } from './EmployeeVerification'

interface ManualConfirmationFallbackProps {
  ticketId: string
}

export function ManualConfirmationFallback({ ticketId }: ManualConfirmationFallbackProps) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

  const handleConfirm = async (scannedEmployeeNo: string) => {
    await confirmTicketCreation(ticketId, scannedEmployeeNo)
    setSuccess(true)
    router.push(`/tickets/${ticketId}`)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 max-w-md w-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Manual QR Fallback</h3>
      <EmployeeVerification
        title="Employee ID"
        description="Awaiting employee QR scan. To manually confirm this ticket creation, enter the requester's Employee ID below."
        submitLabel="Confirm Ticket"
        submittingLabel="Confirming..."
        onSubmit={handleConfirm}
        disabled={success}
        accentColor="blue"
      />
    </div>
  )
}