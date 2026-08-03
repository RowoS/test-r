import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getDashboardCounts,
  getRecentTickets,
  getTicketsByCategory,
  getTicketsOpenedOverTime,
  getRecentActivity,
  getAgentWorkload
} from '@/lib/dashboard-actions'
import { DashboardStats } from '../admin/components/DashboardStats'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'agent', 'manager'].includes(profile.role)) {
    redirect('/tickets')
  }

  // allSettled, not all — a failure in one view (e.g. the category
  // join) shouldn't blank out the count cards, which are the most
  // load-bearing number on this page. Each section gets its own
  // fail state instead of the whole page throwing.
  const isAdmin = profile.role === 'admin'

  const [countsResult, recentResult, categoryResult, openedResult, activityResult, workloadResult] = await Promise.allSettled([
    getDashboardCounts(),
    getRecentTickets(),
    getTicketsByCategory(),
    getTicketsOpenedOverTime('week'),
    isAdmin ? getRecentActivity() : Promise.resolve(null), // skip the call entirely for non-admins
    isAdmin ? getAgentWorkload() : Promise.resolve(null), 
  ])

  return (
    <div className="container mx-auto py-8 max-w-5xl px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Ticket statistics overview.</p>
      </div>
      <DashboardStats
        role={profile.role as 'admin' | 'agent' | 'manager'}
        counts={countsResult.status === 'fulfilled' ? countsResult.value : null}
        recentTickets={recentResult.status === 'fulfilled' ? recentResult.value : null}
        byCategory={categoryResult.status === 'fulfilled' ? categoryResult.value : null}
        initialOpened={openedResult.status === 'fulfilled' ? openedResult.value : null}
        recentActivity={activityResult.status === 'fulfilled' ? activityResult.value : null}
        agentWorkload={workloadResult.status === 'fulfilled' ? workloadResult.value : null}
      />
    </div>
  )
}