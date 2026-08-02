// lib/calendar-permissions.ts
import type { Database } from '@/lib/supabase/types';

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'role' | 'department'>;
type EventRow = { owner_id: string; owner: { department: string | null } };

/**
 * UX-only mirror of the can_edit_event() RLS function.
 * NOT a security boundary — the update/delete server actions still hit
 * RLS, which is the actual enforcement point. This only decides whether
 * to render the edit/delete buttons.
 */
export function canEditEvent(caller: Profile, event: EventRow): boolean {
  if (caller.role === 'admin') return true;
  if (caller.role === 'manager') return caller.department === event.owner.department;
  if (caller.role === 'agent') return caller.id === event.owner_id;
  return false;
}