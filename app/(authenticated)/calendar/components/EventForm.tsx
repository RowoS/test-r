'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createEvent, updateEvent, type CreateEventInput } from '@/lib/calendar-actions';
import { searchTickets } from '@/lib/ticket-actions';
import type { Database } from '@/lib/supabase/types';
import type { getEvents } from '@/lib/calendar-actions';

type EventType = Database['public']['Enums']['event_type'];
type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];
type TicketOption = { id: string; ticket_number: string; title: string };

interface Props {
  mode: 'create' | 'edit';
  initialDate?: Date;
  event?: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
}

const EVENT_TYPES: EventType[] = ['maintenance', 'outage', 'site_visit', 'staff_availability', 'other'];

function toLocalInputValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function EventForm({ mode, initialDate, event, onClose, onSaved }: Props) {
  const baseDate = event ? new Date(event.starts_at) : (initialDate ?? new Date());
  const baseEnd = event ? new Date(event.ends_at) : new Date(baseDate.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? 'other');
  const [startsAt, setStartsAt] = useState(toLocalInputValue(baseDate));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(baseEnd));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticket link
  const [selectedTicket, setSelectedTicket] = useState<TicketOption | null>(
    event?.ticket ? { id: event.ticket.id, ticket_number: event.ticket.ticket_number, title: event.ticket.title } : null
  );
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketResults, setTicketResults] = useState<TicketOption[]>([]);
  const [isSearchingTickets, setIsSearchingTickets] = useState(false);

  useEffect(() => {
    const query = ticketQuery.trim();
    if (!query) return; // Do nothing here if empty

    const handle = setTimeout(() => {
      searchTickets(query)
        .then(setTicketResults)
        .catch(() => setTicketResults([]))
        .finally(() => setIsSearchingTickets(false));
    }, 300);
    
    return () => clearTimeout(handle);
  }, [ticketQuery]);

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
      ticketId: selectedTicket?.id ?? null,
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

        <div className="mb-3 text-sm">
          <span className="mb-1 block">Linked ticket (optional)</span>

          {selectedTicket ? (
            <div className="flex items-center justify-between rounded border bg-gray-50 px-2 py-1.5">
              <span className="truncate">
                <span className="font-medium">{selectedTicket.ticket_number}</span>
                {' — '}
                <span className="text-gray-600">{selectedTicket.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="ml-2 shrink-0 text-xs text-gray-400 hover:text-gray-600"
                aria-label="Remove linked ticket"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
            <input
              value={ticketQuery}
              onChange={(e) => {
                const value = e.target.value;
                setTicketQuery(value);
                
                if (!value.trim()) {
                  setTicketResults([]);
                  setIsSearchingTickets(false);
                } else {
                  setIsSearchingTickets(true);
                }
              }}
              placeholder="Search by ticket number or title…"
              className="w-full rounded border px-2 py-1"
            />
              {ticketQuery.trim() && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
                  {isSearchingTickets ? (
                    <li className="px-2 py-1.5 text-gray-400">Searching…</li>
                  ) : ticketResults.length === 0 ? (
                    <li className="px-2 py-1.5 text-gray-400">No matching tickets.</li>
                  ) : (
                    ticketResults.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTicket(t);
                            setTicketQuery('');
                            setTicketResults([]);
                          }}
                          className="block w-full px-2 py-1.5 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium">{t.ticket_number}</span>
                          {' — '}
                          <span className="text-gray-600">{t.title}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
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