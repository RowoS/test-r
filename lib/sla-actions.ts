'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SlaPriority = 'low' | 'medium' | 'high' | 'critical'

export type SlaRow = {
  id: string
  name: string
  priority: SlaPriority
  first_response_minutes: number
  resolution_minutes: number
}

async function getSupabaseAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return { supabase, user }
}

export async function getSlas(): Promise<SlaRow[]> {
  const { supabase } = await getSupabaseAndUser()
  const { data, error } = await supabase
    .from('slas')
    .select('id, name, priority, first_response_minutes, resolution_minutes')
    .order('priority')

  if (error) throw new Error(error.message)
  return data ?? []
}

// Validation lives here, not just in the form — this is the actual
// trust boundary. RLS (`slas_manage_admin`) is the authorization
// check; this is the business-rule check RLS doesn't do.
export async function upsertSla(input: {
  priority: SlaPriority
  name: string
  first_response_minutes: number
  resolution_minutes: number
}) {
  const { supabase } = await getSupabaseAndUser()

  if (input.first_response_minutes <= 0 || input.resolution_minutes <= 0) {
    throw new Error('SLA minutes must be positive.')
  }
  if (input.first_response_minutes > input.resolution_minutes) {
    throw new Error('First-response time cannot exceed resolution time.')
  }

  const { error } = await supabase
    .from('slas')
    .upsert(
      {
        priority: input.priority,
        name: input.name,
        first_response_minutes: input.first_response_minutes,
        resolution_minutes: input.resolution_minutes,
      },
      { onConflict: 'priority' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/admin/slas')
}