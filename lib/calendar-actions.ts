'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type EventType = Database['public']['Enums']['event_type'];

export interface EventFilters {
  from: string;        // ISO date, inclusive
  to: string;           // ISO date, exclusive
  eventTypes?: EventType[];
  ownerId?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  eventType: EventType;
  ticketId?: string | null;
  startsAt: string;
  endsAt: string;
}

function assertValidRange(startsAt: string, endsAt: string) {
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new Error('End time must be after start time.');
  }
}

export async function getEvents(filters: EventFilters) {
  const supabase = await createClient();

  let query = supabase
    .from('events')
    .select('*, owner:profiles!owner_id(id, full_name, department), ticket:tickets(id, ticket_number, title)')
    .lt('starts_at', filters.to)
    .gt('ends_at', filters.from)
    .order('starts_at', { ascending: true });

  if (filters.eventTypes?.length) {
    query = query.in('event_type', filters.eventTypes);
  }
  if (filters.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load events: ${error.message}`);
  return data;
}

export async function createEvent(input: CreateEventInput) {
  assertValidRange(input.startsAt, input.endsAt);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_type: input.eventType,
      ticket_id: input.ticketId ?? null,
      owner_id: user.id, // enforced again by RLS with check
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);
  revalidatePath('/calendar');
  return data;
}

export async function updateEvent(id: string, input: Partial<CreateEventInput>) {
  if (input.startsAt && input.endsAt) {
    assertValidRange(input.startsAt, input.endsAt);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update({
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description?.trim() || null }),
      ...(input.eventType !== undefined && { event_type: input.eventType }),
      ...(input.ticketId !== undefined && { ticket_id: input.ticketId }),
      ...(input.startsAt !== undefined && { starts_at: input.startsAt }),
      ...(input.endsAt !== undefined && { ends_at: input.endsAt }),
    })
    .eq('id', id)
    .select()
    .single();

  // RLS silently returns 0 rows rather than a permission error
  if (error) throw new Error(`Failed to update event: ${error.message}`);
  if (!data) throw new Error('Event not found or you do not have permission to edit it.');

  revalidatePath('/calendar');
  return data;
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('events')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete event: ${error.message}`);
  if (count === 0) throw new Error('Event not found or you do not have permission to delete it.');

  revalidatePath('/calendar');
}

export async function getEventOwners() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, department')
    .order('full_name');

  if (error) throw new Error(`Failed to load owners: ${error.message}`);
  return data;
}