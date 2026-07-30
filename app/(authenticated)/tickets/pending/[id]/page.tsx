import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManualConfirmationFallback } from '@/app/(authenticated)/tickets/components/ManualConfirmationFallback'

interface PendingTicketPageProps {
  params: Promise<{ id: string }>
}
export default async function PendingTicketPage({ params }: PendingTicketPageProps) {
  const supabase = await createClient()
  const { id: ticketId } = await params

  // Server Layer: Fetch raw data to display the awaiting confirmation state[cite: 5]
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, title, status, created_at, ticket_number')
    .eq('id', ticketId)
    .single()

// STRICT GUARD 1: Database threw an error
  if (error) {
    return (
      <div className="p-8 text-red-600 font-mono bg-red-50">
        <h3>Supabase Query Failed:</h3>
        <p>{error.message}</p>
        <p>Attempted Ticket ID: {ticketId}</p>
      </div>
    )
  }

  // STRICT GUARD 2: Database returned successfully, but payload is empty
  // IMPORTANT: The 'return' keyword here is mandatory.
  if (!ticket) {
    return (
      <div className="p-8 text-red-600 font-mono bg-red-50">
        Ticket is null. The record does not exist, or Row-Level Security blocked your read access.
      </div>
    )
  }

  // Defensive routing: If the ticket has already passed the confirmation phase, kick them to the active view.
  if (ticket.status !== 'pending_confirmation') {
    redirect(`/tickets/${ticket.id}`)
  }

  return (
    <div className="container mx-auto py-12 max-w-4xl px-4 flex flex-col items-center">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4 animate-pulse">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Awaiting Confirmation</h1>
        <p className="text-gray-500 mt-2">
          Ticket <span className="font-semibold">{ticket.ticket_number}</span> has been drafted.
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Draft Title: {ticket.title}
        </p>
      </div>

      <ManualConfirmationFallback ticketId={ticket.id} />
    </div>
  )
}