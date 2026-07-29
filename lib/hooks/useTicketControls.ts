import { useState } from 'react'
import {
  updateTicketStatus,
  assignTicket,
  closeTicketViaQr,
  overrideCloseTicket,
} from '@/lib/ticket-actions'

// 'closed' is intentionally absent — it's no longer a value the plain
// dropdown can set directly. Getting to 'closed' now always goes
// through one of the two functions below, so there's exactly one
// place each records what happened (QR-confirmed vs. override) rather
// than a raw update that leaves no trace of which path was taken.
export type ManualStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'reopened'
export type ValidStatus = ManualStatus | 'closed'

export function useTicketControls(ticketId: string, initialStatus: ValidStatus, initialAssigneeId: string | null) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = async (newStatus: ManualStatus) => {
    if (newStatus === initialStatus) return
    setIsUpdating(true)
    setError(null)

    try {
      await updateTicketStatus(ticketId, newStatus)
    } catch (err: any) {
      setError(err.message || 'Failed to update status.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssignment = async (assigneeId: string) => {
    if (assigneeId === (initialAssigneeId || '')) return
    setIsUpdating(true)
    setError(null)

    try {
      await assignTicket(ticketId, assigneeId || null)
    } catch (err: any) {
      setError(err.message || 'Failed to assign ticket.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleQrClose = async (scannedEmployeeNo: string) => {
    setIsUpdating(true)
    setError(null)

    try {
      await closeTicketViaQr(ticketId, scannedEmployeeNo)
    } catch (err: any) {
      setError(err.message || 'QR close failed.')
      throw err // let the caller keep its own form open on failure
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOverrideClose = async (reason?: string) => {
    setIsUpdating(true)
    setError(null)

    try {
      await overrideCloseTicket(ticketId, reason)
    } catch (err: any) {
      setError(err.message || 'Override close failed.')
      throw err
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    isUpdating,
    error,
    handleStatusChange,
    handleAssignment,
    handleQrClose,
    handleOverrideClose,
  }
}