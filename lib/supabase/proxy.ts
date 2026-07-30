import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/role-actions'
 
// Routes anyone can hit without being signed in.
const PUBLIC_ROUTES = ['/', '/login',  '/auth']
 
// Routes that require a specific role, beyond just being signed in.
// Checked in order; first prefix match wins.
const ROLE_PROTECTED_ROUTES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: '/slas', roles: ['admin'] },
  { prefix: '/dashboard', roles: ['agent', 'admin', 'manager'] },
  { prefix: '/reports', roles: ['manager'] },
  { prefix: '/tickets', roles: ['admin', 'agent', 'manager'] },
]
 
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}


export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )
  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
 
  const pathname = request.nextUrl.pathname
 
  // Not signed in, trying to reach a page that requires auth -> bounce to login.
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
 
  // Signed in, but the page requires a specific role -> check it.
  // Only queried when the path actually matches a role-gated prefix, so
  // most requests (public pages, general authenticated pages) skip this
  // lookup entirely.
  if (user) {
    const roleRule = ROLE_PROTECTED_ROUTES.find((rule) => pathname.startsWith(rule.prefix))
    if (roleRule) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.sub)
        .single()
 
      if (!profile || !roleRule.roles.includes(profile.role as UserRole)) {
        const url = request.nextUrl.clone()
        url.pathname = '/unauthorized'
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return supabaseResponse
}