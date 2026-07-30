import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSlas } from '@/lib/sla-actions'
import { SlaSettingsForm } from '../components/SLASettingsForm'

export const metadata = { title: 'SLA Settings | Admin' }

export default async function SlaSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Page-level gate in addition to RLS: RLS stops a non-admin from
  // writing, but without this check they'd still see an editable
  // form that fails silently on save. Fail visibly, earlier.
  if (profile?.role !== 'admin') {
    redirect('/tickets')
  }

  const slas = await getSlas()

  return (
    <div className="container mx-auto py-8 max-w-3xl px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SLA Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set the maximum first-response and resolution time for each ticket priority.
        </p>
      </div>
      <SlaSettingsForm initialSlas={slas} />
    </div>
  )
}