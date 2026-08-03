'use server'
 
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole, roleHomeRoute } from '@/lib/role-actions'
 
export async function login(formData: FormData) {
  const supabase = await createClient()
 
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
 
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }
 
  revalidatePath('/', 'layout')

  // password_reset_required is set true by default on every profile
  // (see 20260803150000_password_reset_required.sql) and only cleared
  // via complete_password_setup() below — so this is checked before
  // role routing, not after, on every login, not just the first one
  // post-invite. A user who abandons the set-password step and logs
  // in again later still lands back here instead of their dashboard.
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_reset_required')
    .eq('id', data.user.id)
    .single()

  if (profile?.password_reset_required) {
    redirect(`/add-password?email=${encodeURIComponent(data.user.email ?? '')}`)
  }
 
  const role = await getCurrentUserRole(supabase, data.user.id)
  redirect(roleHomeRoute(role))
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Check your email to confirm your account')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export type SetPasswordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }

export async function setPassword(input: {
  password: string
  confirmPassword: string
  expectedEmail: string
}): Promise<SetPasswordResult> {
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Your session has expired. Please log in again.' }
  }

  if (user.email !== input.expectedEmail) {
    return {
      ok: false,
      error: 'Security alert: The active session does not match the expected invitee. Please log out and try again.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: input.password })
  if (error) return { ok: false, error: error.message }

  // RPC, not a direct profiles.update() — trg_prevent_password_flag_bypass
  // rejects a bare column write on password_reset_required from a
  // non-admin caller. This function is the only sanctioned path.
  const { error: rpcError } = await supabase.rpc('complete_password_setup')
  if (rpcError) return { ok: false, error: rpcError.message }

  const role = await getCurrentUserRole(supabase, user.id)
  return { ok: true, redirectTo: roleHomeRoute(role) }
}