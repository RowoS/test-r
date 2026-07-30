import { createClient } from '@/lib/supabase/server'
import { TicketTable, type TicketRow } from './components/TicketTable'
import { signOut } from '@/lib/auth-actions'
import Link from 'next/link'

export const metadata = {
  title: 'Tickets',
}

export default async function TicketsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser();

  let userRole = null;

  if (user) {
    // Query your profiles table using the user's ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    userRole = profile?.role;
  }

  // Server Layer: Fetch data directly using Supabase joined queries
  // RLS (tickets_select) automatically scopes this to what the user is allowed to see[cite: 2, 5].
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select(`
      id,
      ticket_number,
      title,
      status,
      priority,
      created_at,
      category:ticket_categories(name),
      requester:employees(full_name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          Failed to load tickets: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track system requests.</p>
        </div>
        
      {userRole !== 'manager' && (
        <Link 
          href="/tickets/new" 
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Draft
        </Link>
      )}
      
      </div>

      <TicketTable tickets={(tickets as unknown) as TicketRow[]} />
      <form>
        <button formAction={signOut}>Sign out</button>
      </form>
    </div>
  )
}