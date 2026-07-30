'use server'

import { createClient } from '@/lib/supabase/server'

export type DashboardCounts = {
  openCount: number
  inProgressCount: number
  approachingSlaCount: number
  breachedSlaCount: number
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_ticket_counts')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return {
    openCount: data.open_count,
    inProgressCount: data.in_progress_count,
    approachingSlaCount: data.approaching_sla_count,
    breachedSlaCount: data.breached_sla_count,
  }
}

export type RecentTicket = {
  id: string
  ticketNumber: string
  title: string
  priority: string
  status: string
  categoryId: string
  createdAt: string
}

export async function getRecentTickets(): Promise<RecentTicket[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_recent_tickets')
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    ticketNumber: r.ticket_number,
    title: r.title,
    priority: r.priority,
    status: r.status,
    categoryId: r.category_id,
    createdAt: r.created_at,
  }))
}

export type CategoryBreakdown = {
  categoryId: string
  categoryName: string
  ticketCount: number
}

export async function getTicketsByCategory(): Promise<CategoryBreakdown[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_tickets_by_category')
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    ticketCount: r.ticket_count,
  }))
}

export type OpenedPeriod = 'week' | 'month' | 'year'

export type OpenedBucket = {
  bucket: string // ISO date, truncated to the period's grain
  count: number
}

// Aggregates the daily view up to the requested grain in JS rather
// than adding three more DB views. Trade-off: pulls one row per
// (day, priority) for the whole range instead of doing the group-by
// in Postgres. Fine at dashboard scale; revisit if the daily view
// ever needs a WHERE created_at > x bound because the table's grown
// large enough that "all time" stops being a reasonable default.
export async function getTicketsOpenedOverTime(
  period: OpenedPeriod
): Promise<OpenedBucket[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_tickets_opened_daily')
    .select('day, ticket_count')

  if (error) throw new Error(error.message)

  const grain = period === 'week' ? 'day' : period === 'month' ? 'day' : 'month'
  const buckets = new Map<string, number>()

  for (const row of data ?? []) {
    const date = new Date(row.day)
    const key =
      grain === 'day'
        ? date.toISOString().slice(0, 10)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) ?? 0) + row.ticket_count)
  }

  return Array.from(buckets, ([bucket, count]) => ({ bucket, count })).sort((a, b) =>
    a.bucket.localeCompare(b.bucket)
  )
}

export type RecentActivity = {
  id: string
  actorId: string | null
  actorName: string | null // null when actor_id is null (system-driven) or profile lookup misses
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_recent_activity')
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata,
    createdAt: r.created_at,
  }))
}