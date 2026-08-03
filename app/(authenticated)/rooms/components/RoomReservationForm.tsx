'use client';

import { format } from 'date-fns';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createReservation,
  listAttachableEvents,
  listRoomReservations,
  type AttachableEvent,
  type ConferenceRoom,
  type RoomReservationWithRoom,
} from '@/lib/room-actions';

type Props = {
  rooms: ConferenceRoom[];
};

function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function RoomReservationForm({ rooms }: Props) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [existing, setExisting] = useState<RoomReservationWithRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [attachableEvents, setAttachableEvents] = useState<AttachableEvent[]>([]);
  const [attachToEventId, setAttachToEventId] = useState<string>('');

  // Room-less events (e.g. left behind by a cancelled reservation) that
  // this new reservation could attach to instead of creating a fresh
  // calendar entry. Loaded once on mount; good enough for a picker that
  // doesn't need to be perfectly live.
  useEffect(() => {
    listAttachableEvents().then(({ data }) => {
      if (data) setAttachableEvents(data);
    });
  }, []);

  function handleAttachSelection(eventId: string) {
    setAttachToEventId(eventId);
    if (!eventId) return;

    const event = attachableEvents.find((e) => e.id === eventId);
    if (!event) return;

    // Prefill from the event, but everything stays editable — the
    // organizer might want a different time or title for the room
    // booking than the original event had.
    setTitle(event.title);
    setStartsAt(toLocalInputValue(new Date(event.starts_at)));
    setEndsAt(toLocalInputValue(new Date(event.ends_at)));
    refreshAvailability(roomId, toLocalInputValue(new Date(event.starts_at)));
  }

  // Best-effort, UI-only conflict preview for the chosen room and day.
  // The database's EXCLUDE constraint is what actually prevents a
  // double booking on submit — this just gives earlier feedback so the
  // person doesn't fill out the whole form before finding out the slot
  // is taken.
  async function refreshAvailability(nextRoomId: string, nextStartsAt: string) {
    if (!nextRoomId || !nextStartsAt) {
      setExisting([]);
      return;
    }
    const day = new Date(nextStartsAt);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();

    const { data } = await listRoomReservations(nextRoomId, dayStart, dayEnd);
    setExisting(data ?? []);
  }

  function overlapsExisting(): boolean {
    if (!startsAt || !endsAt) return false;
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    return existing.some((r) => {
      const rStart = new Date(r.starts_at).getTime();
      const rEnd = new Date(r.ends_at).getTime();
      return start < rEnd && end > rStart;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!roomId || !title || !startsAt || !endsAt) {
      setError('Fill in a room, title, and start/end time.');
      return;
    }

    startTransition(async () => {
      const { data, error: submitError } = await createReservation({
        roomId,
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        attachToEventId: attachToEventId || undefined,
      });

      if (submitError) {
        setError(submitError);
        return;
      }

      setSuccess(
        attachToEventId
          ? `Reserved. The room has been attached to "${data?.title}" on the calendar.`
          : `Reserved. "${data?.title}" has been added to the calendar.`,
      );
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setExisting([]);
      setAttachToEventId('');
      listAttachableEvents().then(({ data: refreshed }) => {
        if (refreshed) setAttachableEvents(refreshed);
      });
    });
  }

  const conflictWarning = overlapsExisting();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border p-4">
      {attachableEvents.length > 0 && (
        <div className="grid gap-1">
          <label htmlFor="attach_event" className="text-sm font-medium">
            Attach to an existing event (optional)
          </label>
          <select
            id="attach_event"
            className="rounded-md border px-3 py-2 text-sm"
            value={attachToEventId}
            onChange={(e) => handleAttachSelection(e.target.value)}
          >
            <option value="">Create a new calendar event</option>
            {attachableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {new Date(event.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </option>
            ))}
          </select>
          {attachToEventId && (
            <p className="text-xs text-muted-foreground">
              This reservation will attach to that event instead of creating a new calendar entry.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-1">
        <label htmlFor="room" className="text-sm font-medium">
          Room
        </label>
        <select
          id="room"
          className="rounded-md border px-3 py-2 text-sm"
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            refreshAvailability(e.target.value, startsAt);
          }}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} {room.location ? `— ${room.location}` : ''} (seats {room.capacity})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title / purpose
        </label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly sync" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="starts_at" className="text-sm font-medium">
            Start
          </label>
          <Input
            id="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => {
              setStartsAt(e.target.value);
              refreshAvailability(roomId, e.target.value);
            }}
            min={toLocalInputValue(new Date())}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="ends_at" className="text-sm font-medium">
            End
          </label>
          <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      {existing.length > 0 && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Already booked that day:</p>
          <ul className="mt-1 list-inside list-disc">
            {existing.map((r) => (
              <li key={r.id}>
                {new Date(r.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(r.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}: {r.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflictWarning && (
        <p className="text-sm text-amber-600">
          Heads up — that overlaps an existing reservation. You can still try to submit, but it will be rejected.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Reserving…' : 'Reserve room'}
      </Button>
    </form>
  );
}