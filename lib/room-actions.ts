'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ConferenceRoom = {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  is_active: boolean;
};

export type RoomReservation = {
  id: string;
  room_id: string;
  organizer_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomReservationWithRoom = RoomReservation & {
  conference_rooms: Pick<ConferenceRoom, 'id' | 'name' | 'location' | 'capacity'>;
  room_reservation_attendees: { employee_id: string }[];
};

export type AttachableEvent = {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
};

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

// The unique-violation code Postgres raises when an INSERT/UPDATE
// would conflict with the room_reservations_no_overlap EXCLUDE
// constraint. Exclusion-constraint violations surface as 23P01, not
// the 23505 used for plain unique-constraint violations.
const EXCLUSION_VIOLATION = '23P01';

function friendlyReservationError(error: { code?: string; message: string }): string {
  if (error.code === EXCLUSION_VIOLATION) {
    return 'That room is already booked for part of this time range. Pick a different time or room.';
  }
  return error.message;
}

export async function listConferenceRooms(): Promise<ActionResult<ConferenceRoom[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conference_rooms')
    .select('id, name, location, capacity, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Reservations for a single room within a window, ordered by start
 * time — used to render the "already booked" slots in the UI so a
 * conflict is visible before someone even submits the form. The
 * EXCLUDE constraint is still the source of truth; this is purely
 * for a good UX up front.
 */
export async function listRoomReservations(
  roomId: string,
  windowStart: string,
  windowEnd: string,
): Promise<ActionResult<RoomReservationWithRoom[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('room_reservations')
    .select(
      'id, room_id, organizer_id, title, starts_at, ends_at, cancelled_at, cancelled_by, created_at, updated_at, conference_rooms(id, name, location, capacity), room_reservation_attendees(employee_id)',
    )
    .eq('room_id', roomId)
    .is('cancelled_at', null)
    .lt('starts_at', windowEnd)
    .gt('ends_at', windowStart)
    .order('starts_at');

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as RoomReservationWithRoom[], error: null };
}

export async function listMyReservations(): Promise<ActionResult<RoomReservationWithRoom[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('room_reservations')
    .select(
      'id, room_id, organizer_id, title, starts_at, ends_at, cancelled_at, cancelled_by, created_at, updated_at, conference_rooms(id, name, location, capacity), room_reservation_attendees(employee_id)',
    )
    .eq('organizer_id', user.id)
    .is('cancelled_at', null)
    .order('starts_at');

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as RoomReservationWithRoom[], error: null };
}

/**
 * Events that don't currently have a room attached — e.g. one left
 * behind after its reservation was cancelled or deleted (see the
 * migration's SET NULL / unlink behavior). Surfaced so a new
 * reservation can be attached to one of these instead of always
 * spinning up a brand-new calendar entry. RLS on events governs
 * visibility here same as anywhere else events are read; whether a
 * given event can actually be attached to is re-checked server-side
 * by create_room_reservation at submit time.
 */
export async function listAttachableEvents(): Promise<ActionResult<AttachableEvent[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_type, starts_at, ends_at')
    .is('room_reservation_id', null)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');

  if (error) return { data: null, error: error.message };
  return { data: data as AttachableEvent[], error: null };
}

export type CreateReservationInput = {
  roomId: string;
  title: string;
  startsAt: string; // ISO timestamp
  endsAt: string; // ISO timestamp
  attendeeEmployeeIds?: string[];
  /** Attach to an existing room-less event instead of creating a new one. */
  attachToEventId?: string;
};

/**
 * Creates a reservation. The room_reservations_no_overlap EXCLUDE
 * constraint (see migration) is the actual double-booking guard —
 * this action just creates the row and translates a constraint
 * violation into a message the form can show inline. On success, a
 * database trigger (trg_sync_room_reservation_event) creates the
 * matching calendar event automatically — or, if attachToEventId is
 * given, links the reservation to that existing room-less event
 * instead of creating a new one. Either way, the calendar is handled
 * for you here; there's nothing further to sync.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<ActionResult<RoomReservation>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: 'Not signed in.' };

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return { data: null, error: 'End time must be after the start time.' };
  }

  const { data: reservation, error } = await supabase
    .rpc('create_room_reservation', {
      p_room_id: input.roomId,
      p_title: input.title,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_event_id: input.attachToEventId ?? null,
    })
    .single();

  if (error) return { data: null, error: friendlyReservationError(error) };

  if (input.attendeeEmployeeIds?.length) {
    const { error: attendeeError } = await supabase.from('room_reservation_attendees').insert(
      input.attendeeEmployeeIds.map((employeeId) => ({
        reservation_id: reservation.id,
        employee_id: employeeId,
      })),
    );

    // The reservation itself already succeeded and is on the calendar;
    // surface the attendee failure without rolling that back.
    if (attendeeError) {
      revalidatePath('/rooms');
      revalidatePath('/calendar');
      return { data: reservation, error: `Reservation created, but attendees could not be saved: ${attendeeError.message}` };
    }
  }

  revalidatePath('/rooms');
  revalidatePath('/calendar');
  return { data: reservation, error: null };
}

export type UpdateReservationInput = {
  reservationId: string;
  title?: string;
  roomId?: string;
  startsAt?: string;
  endsAt?: string;
};

export async function updateReservation(
  input: UpdateReservationInput,
): Promise<ActionResult<RoomReservation>> {
  const supabase = await createClient();

  const patch: Record<string, string> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.roomId !== undefined) patch.room_id = input.roomId;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;

  const { data, error } = await supabase
    .from('room_reservations')
    .update(patch)
    .eq('id', input.reservationId)
    .select()
    .single();

  if (error) return { data: null, error: friendlyReservationError(error) };

  revalidatePath('/rooms');
  revalidatePath('/calendar');
  return { data, error: null };
}

/**
 * Soft-cancels a reservation. RLS (room_reservations_update_own) only
 * lets the organizer or an admin do this. The sync trigger unlinks the
 * matching calendar event (rather than deleting it) as part of the
 * same statement — the meeting may still happen, just without this
 * room, so it stays on the calendar for the organizer to reassign.
 */
export async function cancelReservation(reservationId: string): Promise<ActionResult<true>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: 'Not signed in.' };

  const { error } = await supabase
    .from('room_reservations')
    .update({ cancelled_at: new Date().toISOString(), cancelled_by: user.id })
    .eq('id', reservationId);

  if (error) return { data: null, error: error.message };

  revalidatePath('/rooms');
  revalidatePath('/calendar');
  return { data: true, error: null };
}