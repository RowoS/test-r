'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActivityLogRow } from '@/lib/activity-types'

export type GetActivityLogFilters = {
  entityType?: string
  entityId?: string
  action?: string
  limit?: number
  before?: string // cursor: created_at of the last row already fetched
}

export async function getActivityLog(
  filters: GetActivityLogFilters = {}
): Promise<ActivityLogRow[]> {
  const supabase = await createClient()
  const limit = Math.min(filters.limit ?? 50, 200)

  let query = supabase
    .from('activity_log')
    .select('id, actor_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.entityId) query = query.eq('entity_id', filters.entityId)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.before) query = query.lt('created_at', filters.before)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))
}