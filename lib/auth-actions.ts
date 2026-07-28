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
 
  // Send each role to its own home screen instead of one shared landing page.
  // Falls back to the requester home if the role lookup fails for any reason.
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