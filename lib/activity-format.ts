type ActivityLike = {
  action: string
  actorName: string | null
  metadata: Record<string, unknown>
}

export const ACTIVITY_ACTIONS: { value: string; label: string }[] = [
  { value: 'ticket.draft_created', label: 'Ticket Created' },
  { value: 'ticket.verified', label: 'Ticket Verified' },
  { value: 'ticket.status_changed', label: 'Status Changed' },
  { value: 'ticket.assigned', label: 'Ticket Assigned' },
  { value: 'ticket.deleted', label: 'Ticket Deleted' },
  { value: 'sla.created', label: 'SLA Created' },
  { value: 'sla.updated', label: 'SLA Updated' },
  { value: 'room_reservation.created', label: 'Room Reserved' },
  { value: 'room_reservation.cancelled', label: 'Reservation Cancelled' },
  { value: 'room_reservation.reactivated', label: 'Reservation Reactivated' },
  { value: 'room_reservation.updated', label: 'Reservation Updated' },
  { value: 'room_reservation.deleted', label: 'Reservation Deleted' },
  { value: 'conference_room.created', label: 'Room Added' },
  { value: 'conference_room.updated', label: 'Room Updated' },
]

export function describeActivity(a: ActivityLike): string {
  const who = a.actorName ?? 'System'
  switch (a.action) {
    case 'ticket.draft_created':
      return `${who} created a ticket draft`
    case 'ticket.verified':
      return `${who} verified a ticket`
    case 'ticket.status_changed':
      return `${who} changed a ticket's status (${a.metadata.from_status} → ${a.metadata.to_status})`
    case 'ticket.assigned':
      return `${who} assigned a ticket (${a.metadata.method})`
    case 'ticket.deleted':
      return `${who} deleted a ticket`
    case 'sla.created':
    case 'sla.updated':
      return `${who} updated the ${a.metadata.priority} priority SLA`
    case 'room_reservation.created':
      return a.metadata.attached_to_event_id
        ? `${who} reserved a room for "${a.metadata.title}" and attached it to an existing event`
        : `${who} reserved a room for "${a.metadata.title}"`
    case 'room_reservation.cancelled':
      return `${who} cancelled a room reservation`
    case 'room_reservation.reactivated':
      return `${who} reactivated a room reservation`
    case 'room_reservation.updated': {
      const to = a.metadata.to as { title?: string } | undefined
      return `${who} updated a room reservation${to?.title ? ` (${to.title})` : ''}`
    }
    case 'room_reservation.deleted':
      return `${who} deleted a room reservation for "${a.metadata.title}"`
    case 'conference_room.created':
      return `${who} added a conference room (${a.metadata.name})`
    case 'conference_room.updated':
      return a.metadata.is_active === false
        ? `${who} deactivated a conference room (${a.metadata.name})`
        : `${who} updated a conference room (${a.metadata.name})`
    default:
      return `${who} — ${a.action}`
  }
}