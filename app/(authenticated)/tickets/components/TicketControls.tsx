'use client'

import { useTicketControls, type ManualStatus, type ValidStatus } from '@/lib/hooks/useTicketControls'

const STATUS_OPTIONS: { label: string; value: ValidStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Reopened', value: 'reopened' },
]

interface StaffMember {
  id: string
  full_name: string
  role: string
}

interface TicketControlsProps {
  ticketId: string
  currentStatus: ValidStatus
  currentAssigneeId: string | null
  staffList: StaffMember[]
}

export function TicketControls({ ticketId, currentStatus, currentAssigneeId, staffList }: TicketControlsProps) {
  const { isUpdating, error, handleStatusChange, handleAssignment } = useTicketControls(ticketId, currentStatus, currentAssigneeId)

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">Ticket Controls</h3>
      
      {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <div className="flex flex-col space-y-3">
        <div className="flex flex-col space-y-1">
          <label htmlFor="status" className="text-xs font-medium text-gray-500 uppercase">
            Status
          </label>
          <select
            id="status"
            className="border border-gray-300 rounded-md p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            defaultValue={currentStatus}
            disabled={isUpdating}
            onChange={(e) => handleStatusChange(e.target.value as ManualStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label htmlFor="assignee" className="text-xs font-medium text-gray-500 uppercase">
            Assigned To
          </label>
          <select
            id="assignee"
            className="border border-gray-300 rounded-md p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            defaultValue={currentAssigneeId || ''}
            disabled={isUpdating}
            onChange={(e) => handleAssignment(e.target.value)}
          >
            <option value="">-- Unassigned --</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.full_name} ({staff.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}