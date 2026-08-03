// app/(authenticated)/admin/activity/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActivityLog } from '@/lib/activity-actions'
import { ActivityLogView } from '../components/ActivityLogView'

export default async function ActivityLogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // activity_log_select_staff only checks auth.role() = 'authenticated' —
  // unlike tickets_select, it does NOT scope by role or department.
  // The database will happily return every entry to any signed-in staff
  // member, so admin-only visibility has to be enforced here.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/unauthorized')

  const initialLogs = await getActivityLog({ limit: 25 })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Activity Log</h1>
      <ActivityLogView initialLogs={initialLogs} />
    </div>
  )
}