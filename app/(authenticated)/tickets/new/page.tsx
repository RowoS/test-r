import { TicketForm } from '../components/TicketForm'

export const metadata = {
  title: 'New Ticket',
}

export default function NewTicketPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
        <p className="text-sm text-gray-500 mt-1">
          Draft a new support ticket. The ticket will remain in pending confirmation until verified by the requester.
        </p>
      </div>
      
      <TicketForm />
    </div>
  )
}