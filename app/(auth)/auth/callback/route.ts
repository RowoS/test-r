import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole, roleHomeRoute } from '@/lib/role-actions'
 
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
 
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
 
    if (!error && data.user) {
      // If the link explicitly said where to go (e.g. deep-linked from an
      // email), honor that. Otherwise route by role, same as a normal login.
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }
 
      const role = await getCurrentUserRole(supabase, data.user.id)
      return NextResponse.redirect(`${origin}${roleHomeRoute(role)}`)
    }
  }
 
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
