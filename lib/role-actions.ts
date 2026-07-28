import type { SupabaseClient } from '@supabase/supabase-js'
 
export type UserRole = 'agent' | 'admin' | 'manager'
 
// Where each role lands after authenticating.
const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  admin: '/panel',
  agent: '/dashboard',
  manager: '/reports',
}
 
export function roleHomeRoute(role: UserRole | null | undefined): string {
  return ROLE_HOME_ROUTES[role ?? 'agent'] ?? '/dashboard'
}
 
/**
 * Looks up the caller's role from `profiles`.
 *
 * NOTE: this is a UX/routing convenience only, not a security check.
 * The RLS policies on `profiles` (and every other table) enforce access
 * regardless of whether this function is called, or what it returns.
 */
export async function getCurrentUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
 
  if (error || !data) return null
  return data.role as UserRole
}
 
/**
 * Server Action / Route Handler guard for role-gated operations.
 *
 * Use this as defense-in-depth specifically in code paths that bypass RLS
 * on their own — e.g. anything using the service_role key, or calling a
 * security-definer RPC like the retention-purge functions. RLS already
 * blocks unauthorized table access for normal queries; this covers the
 * cases where RLS isn't in the loop at all.
 */
export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  allowed: UserRole[]
): Promise<UserRole> {
  const role = await getCurrentUserRole(supabase, userId)
  if (!role || !allowed.includes(role)) {
    throw new Error('Not authorized')
  }
  return role
}
 
