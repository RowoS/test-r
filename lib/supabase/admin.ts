import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS entirely and can call
 * supabase.auth.admin.*. This is NOT the same client as
 * lib/supabase/server's createClient(): that one is cookie-based,
 * scoped to the signed-in user, and safe to use throughout the app.
 * This one is scoped to the whole project.
 *
 * Rules for using this file:
 * - Server-side only. Never import this into a Client Component or
 *   anything that could end up in a browser bundle.
 * - Only call it from code paths that have already verified the
 *   caller is an Admin (see requireRole() in lib/rbac.ts) — this
 *   client has no RLS to fall back on if that check is skipped.
 * - SUPABASE_SERVICE_ROLE_KEY must never be prefixed with
 *   NEXT_PUBLIC_ — that prefix is what makes an env var visible to
 *   the browser, and this key must never be.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}