// app/(auth)/add-password/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole, roleHomeRoute } from '@/lib/role-actions'
import { SetPasswordForm } from '@/components/SetPasswordForm'

export default async function AddPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Mirrors the middleware's own gate, but in the opposite direction:
  // proxy.ts forces anyone with the flag still set to land here; this
  // sends anyone who's already done it back out, so the page can't be
  // revisited as a way to needlessly reset a working password.
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_reset_required')
    .eq('id', user.id)
    .single()

  if (profile && !profile.password_reset_required) {
    const role = await getCurrentUserRole(supabase, user.id)
    redirect(roleHomeRoute(role))
  }

  const { email } = await searchParams
  const expectedEmail = email ?? user.email ?? ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">Set your password</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Choose a password to finish setting up your account.
        </p>
        <SetPasswordForm expectedEmail={expectedEmail} />
      </div>
    </div>
  )
}