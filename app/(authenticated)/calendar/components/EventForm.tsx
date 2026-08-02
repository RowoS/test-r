'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { createEvent, updateEvent, type CreateEventInput } from '@/lib/calendar-actions';
import type { Database } from '@/lib/supabase/types';
import type { getEvents } from '@/lib/calendar-actions';

type EventType = Database['public']['Enums']['event_type'];
type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];

interface Props {
  mode: 'create' | 'edit';
  initialDate?: Date;      // from day-click prefill; undefined = button-triggered, defaults to now
  event?: CalendarEvent;   // present in edit mode
  onClose: () => void;
  onSaved: () => void;
}

const EVENT_TYPES: EventType[] = ['maintenance', 'outage', 'site_visit', 'staff_availability', 'other'];

function toLocalInputValue(date: Date) {
  // datetime-local expects "YYYY-MM-DDTHH:mm" in local time, not UTC
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function EventForm({ mode, initialDate, event, onClose, onSaved }: Props) {
  const baseDate = event ? new Date(event.starts_at) : (initialDate ?? new Date());
  const baseEnd = event ? new Date(event.ends_at) : new Date(baseDate.getTime() + 60 * 60 * 1000); // +1hr default

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? 'other');
  const [startsAt, setStartsAt] = useState(toLocalInputValue(baseDate));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(baseEnd));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const payload: CreateEventInput = {
      title,
      description,
      eventType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };

    setIsSubmitting(true);
    try {
      if (mode === 'edit' && event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
<form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
      >
        <h3 className="mb-3 text-base font-semibold">{mode === 'edit' ? 'Edit Event' : 'New Event'}</h3>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <label className="mb-2 block text-sm">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            required
          />
        </label>

        <label className="mb-2 block text-sm">
          Type
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </label>

<div className="mb-2 grid grid-cols-2 gap-4">
          <label className="text-sm">
            Starts
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            Ends
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
        </div>

        <label className="mb-3 block text-sm">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            rows={2}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}