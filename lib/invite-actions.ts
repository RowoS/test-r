// lib/invite-actions.ts
'use server'

import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/role-actions'
import type { Database } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

type Role = Database['public']['Enums']['roles']
const ROLES: readonly Role[] = ['agent', 'manager', 'admin']

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated.')
  await requireRole(supabase, user.id, ['admin'])
  return { supabase, user }
}

// Avoids visually ambiguous characters (0/O, 1/l/I) since this gets
// read off a screen and typed by a human during the manual handoff.
const TEMP_PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'

function generateTempPassword(length = 14): string {
  let pw = ''
  for (let i = 0; i < length; i++) {
    pw += TEMP_PW_CHARS[randomInt(TEMP_PW_CHARS.length)]
  }
  return pw
}

export type InviteUserInput = {
  email: string
  fullName: string
  role: Role
  department?: string
}

export type InviteUserResult =
  | { ok: true; userId: string; tempPassword: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof InviteUserInput, string>> }

function validateInvite(input: InviteUserInput) {
  const fieldErrors: Partial<Record<keyof InviteUserInput, string>> = {}
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email address.'
  if (!fullName) fieldErrors.fullName = 'Full name is required.'
  if (!ROLES.includes(input.role)) fieldErrors.role = 'Select a valid role.'

  return { fieldErrors, email, fullName, department: input.department?.trim() || null }
}

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  let caller
  try {
    caller = (await requireAdmin()).user
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  const { fieldErrors, email, fullName, department } = validateInvite(input)
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const admin = createServiceRoleClient()
  const tempPassword = generateTempPassword()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: input.role, department },
  })

  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: 'Account creation failed — no user was returned.' }

  await admin.from('activity_log').insert({
    actor_id: caller.id,
    action: 'user.invited',
    entity_type: 'profile',
    entity_id: data.user.id,
    metadata: { email, role: input.role, department },
  })

  revalidatePath('/admin/users')
  return { ok: true, userId: data.user.id, tempPassword }
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateUserRole(input: {
  profileId: string
  role: Role
  department?: string
}): Promise<ActionResult> {
  let supabase
  try {
    supabase = (await requireAdmin()).supabase
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  if (!ROLES.includes(input.role)) {
    return { ok: false, error: 'Select a valid role.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: input.role, department: input.department?.trim() || null })
    .eq('id', input.profileId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/users')
  return { ok: true }
}

export type AdminUserRow = {
  id: string
  fullName: string | null
  email: string | null
  role: Role
  department: string | null
  createdAt: string
}

export async function getUsers(): Promise<AdminUserRow[]> {
  const { supabase } = await requireAdmin()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, department, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!profiles?.length) return []

  const admin = createServiceRoleClient()
  const emailById = new Map<string, string>()
  const perPage = 200
  for (let page = 1; emailById.size < profiles.length; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage })
    if (listError || !data.users.length) break
    for (const u of data.users) emailById.set(u.id, u.email ?? '')
    if (data.users.length < perPage) break
  }

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: emailById.get(p.id) ?? null,
    role: p.role,
    department: p.department,
    createdAt: p.created_at,
  }))
}