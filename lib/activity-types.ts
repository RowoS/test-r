export type ActivityLogRow = {
  id: string
  actorId: string | null // null on system/trigger-driven entries with no auth.uid()
  actorName: string | null // resolved from profiles; null when actorId is null or the lookup misses
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}