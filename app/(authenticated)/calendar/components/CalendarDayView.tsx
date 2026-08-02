'use client';

import { useEffect, useRef } from 'react';
import { format, isToday } from 'date-fns';
import { HOUR_HEIGHT, GRID_START_HOUR, GRID_END_HOUR, layoutDayEvents } from '@/lib/calendar-time-grid';
import type { getEvents } from '@/lib/calendar-actions';

type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];

interface Props {
  day: Date;
  events: CalendarEvent[];
  onSlotClick: (dateTime: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const EVENT_COLORS: Record<string, string> = {
  maintenance: 'bg-blue-100 text-blue-800 border-blue-300',
  outage: 'bg-red-100 text-red-800 border-red-300',
  site_visit: 'bg-purple-100 text-purple-800 border-purple-300',
  staff_availability: 'bg-green-100 text-green-800 border-green-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);

export function CalendarDayView({ day, events, onSlotClick, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const positioned = layoutDayEvents(events, day);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_HEIGHT });
  }, [day]);

  return (
    <div className="flex flex-col rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 py-2 text-center">
        <div className="text-xs text-gray-500">{format(day, 'EEEE')}</div>
        <div className={`text-sm font-medium ${isToday(day) ? 'text-blue-600' : ''}`}>
          {format(day, 'MMMM d, yyyy')}
        </div>
      </div>

      <div ref={scrollRef} className="max-h-150 overflow-y-auto">
        <div className="grid grid-cols-[60px_1fr]">
          <div className="relative" style={{ height: HOUR_HEIGHT * HOURS.length }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {format(new Date(2000, 0, 1, hour), 'h a')}
              </div>
            ))}
          </div>

          <div className="relative border-l border-gray-200" style={{ height: HOUR_HEIGHT * HOURS.length }}>
            {HOURS.map((hour) => (
              <button
                key={hour}
                onClick={() => {
                  const slot = new Date(day);
                  slot.setHours(hour, 0, 0, 0);
                  onSlotClick(slot);
                }}
                className="absolute inset-x-0 border-t border-gray-100 hover:bg-blue-50"
                style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                aria-label={`Create event at ${format(new Date(2000, 0, 1, hour), 'h a')}`}
              />
            ))}

            {positioned.map(({ event, top, height, lane, laneCount }) => (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className={`absolute overflow-hidden rounded border px-2 py-1 text-xs leading-tight ${EVENT_COLORS[event.event_type] ?? EVENT_COLORS.other}`}
                style={{ top, height, left: `${(lane / laneCount) * 100}%`, width: `${100 / laneCount}%` }}
              >
                <div className="truncate font-medium">{event.title}</div>
                <div className="truncate text-[11px] opacity-75">
                  {format(new Date(event.starts_at), 'h:mm a')} – {format(new Date(event.ends_at), 'h:mm a')} · {event.owner.full_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}