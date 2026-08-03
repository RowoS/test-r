'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ConferenceRoom } from '@/lib/room-actions';

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

// RLS (conference_rooms_manage_admin) is the real gate here; these
// actions just surface a clean error if a non-admin somehow calls them.
export async function createConferenceRoom(input: {
  name: string;
  location?: string;
  capacity: number;
}): Promise<ActionResult<ConferenceRoom>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conference_rooms')
    .insert({ name: input.name, location: input.location ?? null, capacity: input.capacity })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath('/admin/rooms');
  return { data, error: null };
}

export async function updateConferenceRoom(
  roomId: string,
  input: Partial<{ name: string; location: string | null; capacity: number; is_active: boolean }>,
): Promise<ActionResult<ConferenceRoom>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conference_rooms')
    .update(input)
    .eq('id', roomId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath('/admin/rooms');
  return { data, error: null };
}

/**
 * Rooms are deactivated rather than hard-deleted, since past
 * reservations still reference the room_id and should stay meaningful
 * in reporting/history.
 */
export async function deactivateConferenceRoom(roomId: string): Promise<ActionResult<true>> {
  const supabase = await createClient();

  const { error } = await supabase.from('conference_rooms').update({ is_active: false }).eq('id', roomId);

  if (error) return { data: null, error: error.message };

  revalidatePath('/admin/rooms');
  return { data: true, error: null };
}