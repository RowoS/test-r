'use client'

import Link from 'next/link'
import { useTicketFilter, type TicketStatusFilter } from '@/lib/hooks/useTicketFilter'

// Matches the Supabase join payload from the server
export type TicketRow = {
  id: string
  ticket_number: string
  title: string
  status: string
  priority: string
  created_at: string
  category: { name: string } | null
  requester: { full_name: string } | null
}

interface TicketTableProps {
  tickets: TicketRow[]
}

const STATUS_FILTERS: { label: string; value: TicketStatusFilter }[] = [
  { label: 'All Tickets', value: 'all' },
  { label: 'Pending Confirmation', value: 'pending_confirmation' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export function TicketTable({ tickets }: TicketTableProps) {
  const { activeFilter, setActiveFilter, filteredTickets } = useTicketFilter(tickets)

  return (
    <div className="flex flex-col space-y-4">
      {/* Business Logic Integration: Filtering Controls */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeFilter === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Presentation: Data Table */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No tickets found for this filter.
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/tickets/${ticket.status === 'pending_confirmation' ? `pending/${ticket.id}` : ticket.id}`} className="block">
                      <div className="text-sm font-semibold text-blue-600 hover:underline">{ticket.ticket_number}</div>
                      <div className="text-sm text-gray-900 truncate max-w-50">{ticket.title}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ticket.requester?.full_name || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ticket.category?.name || 'Uncategorized'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}