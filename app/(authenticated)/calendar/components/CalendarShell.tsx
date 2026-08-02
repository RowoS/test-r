// app/(authenticated)/calendar/components/CalendarShell.tsx
'use client';

import { useState } from 'react';
import {
  addDays, addMonths, addWeeks, endOfWeek,
  format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks,
} from 'date-fns';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { useCalendarFilters } from '@/lib/hooks/useCalendarFilters';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { CalendarFilters } from './CalendarFilters';
import { EventForm } from './EventForm';
import { EventDetail } from './EventDetail';
import type { Database } from '@/lib/supabase/types';
import type { getEvents } from '@/lib/calendar-actions';

type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];
type ViewMode = 'month' | 'week' | 'day';
type ComposerState =
  | { mode: 'closed' }
  | { mode: 'create'; prefillDate?: Date }
  | { mode: 'edit'; event: CalendarEvent };

interface Props {
  currentUserId: string;
  currentUserRole: Database['public']['Enums']['roles'];
  currentUserDepartment: string | null;
  owners: { id: string; full_name: string; department: string | null }[];
}

function getRange(view: ViewMode, anchor: Date) {
  if (view === 'month') {
    return { from: startOfMonth(anchor), to: startOfMonth(addMonths(anchor, 1)) };
  }
  if (view === 'week') {
    return { from: startOfWeek(anchor), to: addWeeks(startOfWeek(anchor), 1) };
  }
  return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
}

function navigate(view: ViewMode, anchor: Date, direction: 1 | -1) {
  if (view === 'month') return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  if (view === 'week') return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1);
}

function headerLabel(view: ViewMode, anchor: Date) {
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'week') {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return format(anchor, 'MMMM d, yyyy');
}

export function CalendarShell({ currentUserId, currentUserRole, currentUserDepartment, owners }: Props) {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [composer, setComposer] = useState<ComposerState>({ mode: 'closed' });
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const { eventTypes, ownerId, setFilters } = useCalendarFilters();

  const { from, to } = getRange(view, anchor);
  const { events, isLoading, error, refresh } = useCalendarEvents({
    from: from.toISOString(),
    to: to.toISOString(),
    eventTypes,
    ownerId,
  });

  function handleSlotClick(dateTime: Date) {
    setComposer({ mode: 'create', prefillDate: dateTime });
  }

  function handleEventClick(event: CalendarEvent) {
    setDetailEvent(event);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor((a) => navigate(view, a, -1))} aria-label="Previous">
            ‹
          </button>
          <h2 className="text-lg font-semibold">{headerLabel(view, anchor)}</h2>
          <button onClick={() => setAnchor((a) => navigate(view, a, 1))} aria-label="Next">
            ›
          </button>
          <button onClick={() => setAnchor(new Date())} className="ml-1 text-xs text-blue-600 hover:underline">
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 text-xs">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 capitalize first:rounded-l-md last:rounded-r-md ${
                  view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={() => setComposer({ mode: 'create' })}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Event
          </button>
        </div>
      </div>

      <CalendarFilters
        selectedTypes={eventTypes}
        selectedOwnerId={ownerId}
        owners={owners}
        onChange={setFilters}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {view === 'month' && (
        <CalendarMonthView
          month={anchor}
          events={events}
          onDayClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'week' && (
        <CalendarWeekView
          weekOf={anchor}
          events={events}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'day' && (
        <CalendarDayView
          day={anchor}
          events={events}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      )}

      {composer.mode !== 'closed' && (
        <EventForm
          mode={composer.mode}
          initialDate={composer.mode === 'create' ? composer.prefillDate : undefined}
          event={composer.mode === 'edit' ? composer.event : undefined}
          onClose={() => setComposer({ mode: 'closed' })}
          onSaved={() => {
            setComposer({ mode: 'closed' });
            refresh();
          }}
        />
      )}

      {detailEvent && (
        <EventDetail
          event={detailEvent}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserDepartment={currentUserDepartment}
          onClose={() => setDetailEvent(null)}
          onEdit={() => {
            setComposer({ mode: 'edit', event: detailEvent });
            setDetailEvent(null);
          }}
          onDeleted={() => {
            setDetailEvent(null);
            refresh();
          }}
        />
      )}

      {isLoading && <p className="text-xs text-gray-400">Refreshing…</p>}
    </div>
  );
}