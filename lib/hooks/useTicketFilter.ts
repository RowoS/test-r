import { useState, useMemo } from 'react'

export type TicketStatusFilter = 
  | 'all' 
  | 'pending_confirmation' 
  | 'open' 
  | 'in_progress' 
  | 'on_hold' 
  | 'resolved' 
  | 'closed' 
  | 'reopened' 
  | 'cancelled'

export function useTicketFilter<T extends { status: string }>(initialTickets: T[]) {
  const [activeFilter, setActiveFilter] = useState<TicketStatusFilter>('all')

  const filteredTickets = useMemo(() => {
    if (activeFilter === 'all') return initialTickets
    return initialTickets.filter((ticket) => ticket.status === activeFilter)
  }, [initialTickets, activeFilter])

  return {
    activeFilter,
    setActiveFilter,
    filteredTickets
  }
}