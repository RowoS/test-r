export type ActivityLogRow = {
  id: string
  actorId: string | null // null on system/trigger-driven entries with no auth.uid()
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}