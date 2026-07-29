import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { TicketControls } from '../components/TicketControls'
import { TicketComments } from '../components/TicketComment'
import { TicketAttachments } from '../components/TicketAttachment'
import type { ValidStatus } from '@/lib/hooks/useTicketControls'

export const metadata = {
  title: 'Ticket Details',
}

interface TicketDetailPageProps {
  params: Promise<{ id: string }>
}

// Explicitly define the expected shape of the Supabase response
type TicketDetail = {
  id: string
  ticket_number: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  department: string | null
  category: { name: string } | null
  requester: { full_name: string; employee_no: string } | null
  assigned_to: { id: string; full_name: string } | null
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const supabase = await createClient()
  const { id: ticketId } = await params

  const { data, error: ticketError } = await supabase
    .from('tickets')
    .select(`
      id,
      ticket_number,
      title,
      description,
      status,
      priority,
      created_at,
      department,
      category:ticket_categories(name),
      requester:employees(full_name, employee_no),
      assigned_to:profiles(id, full_name)
    `)
    .eq('id', ticketId)
    .single()

  if (ticketError || !data) {
    notFound()
  }

  // Cast the generic response to our explicit type to resolve TypeScript array inference
  const ticket = (data as unknown) as TicketDetail

  if (ticket.status === 'pending_confirmation') {
    redirect(`/tickets/pending/${ticket.id}`)
  }

  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['agent', 'admin'])
    .order('full_name')


const { data: commentsData } = await supabase
  .from('ticket_comments')
  .select(`
    id,
    body,
    is_internal,
    created_at,
    user:profiles(full_name)
  `)
  .eq('ticket_id', ticketId)
  .order('created_at', { ascending: true })

  const { data: attachmentsData } = await supabase
  .from('ticket_attachments')
  .select(`
    id,
    storage_path,
    original_filename,
    size_bytes,
    created_at,
    uploaded_by:profiles(full_name)
  `)
  .eq('tickets_id', ticketId)
  .order('created_at', { ascending: true })



  const comments = (commentsData as unknown) as import('../components/TicketComment').CommentRow[]
  const attachments = (attachmentsData as unknown) as import('../components/TicketAttachment').AttachmentRow[]
  
  return (
    <div className="container mx-auto py-8 max-w-6xl px-4 flex flex-col md:flex-row gap-6">
      
      <div className="mb-4">
        <Link 
          href="/tickets" 
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tickets
        </Link>
      </div>

      <div className="flex-1 flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {ticket.ticket_number} • Opened {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 capitalize border border-blue-200">
              {ticket.priority} Priority
            </span>
          </div>
          
          <div className="prose max-w-none text-gray-700 mt-4 border-t border-gray-100 pt-4">
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Attachments</h2>
            <TicketAttachments 
                ticketId={ticket.id} 
                ticketStatus={ticket.status as ValidStatus | 'pending_confirmation'} 
                attachments={attachments || []} 
            />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity & Comments</h2>
            <TicketComments ticketId={ticket.id} comments={comments || []} />
        </div>
      </div>

      <div className="w-full md:w-80 flex flex-col space-y-6">
        <TicketControls 
          ticketId={ticket.id}
          currentStatus={ticket.status as ValidStatus}
          currentAssigneeId={ticket.assigned_to?.id || null}
          staffList={staffList || []}
        />

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">Requester Info</h3>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase">Name</span>
            <span className="text-sm font-medium text-gray-900">{ticket.requester?.full_name}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase">Employee ID</span>
            <span className="text-sm font-medium text-gray-900">{ticket.requester?.employee_no}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase">Department Snapshot</span>
            <span className="text-sm font-medium text-gray-900">{ticket.department || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}