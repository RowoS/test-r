// app/(authenticated)/admin/users/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsers } from '@/lib/invite-actions'
import { InviteUserForm } from './components/InviteUserForm'
import { UserRoleTable } from './components/UserRoleTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/unauthorized')

  const users = await getUsers()

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Users &amp; Roles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Invite new staff and manage role assignments.
        </p>
      </div>
      <InviteUserForm />
      <UserRoleTable initialUsers={users} />
    </div>
  )
}