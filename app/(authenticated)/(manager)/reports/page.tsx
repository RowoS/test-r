import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/auth-actions'

export default async function managerDashboard() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect('/login')
  }

  return (
    <div>
      <p>Welcome, manager</p>
      <form>
        <button formAction={signOut}>Sign out</button>
      </form>
    </div>
  )
}