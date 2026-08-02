// app/(authenticated)/calendar/components/CalendarMonthView.tsx
'use client';

import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import type { getEvents } from '@/lib/calendar-actions';

type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];

interface Props {
  month: Date;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const EVENT_COLORS: Record<string, string> = {
  maintenance: 'bg-blue-100 text-blue-800 border-blue-300',
  outage: 'bg-red-100 text-red-800 border-red-300',
  site_visit: 'bg-purple-100 text-purple-800 border-purple-300',
  staff_availability: 'bg-green-100 text-green-800 border-green-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function CalendarMonthView({ month, events, onDayClick, onEventClick }: Props) {
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
        <div key={label} className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-500">
          {label}
        </div>
      ))}

      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), day));
        const inMonth = isSameMonth(day, month);

        return (
          <button
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={`min-h-24 bg-white p-1.5 text-left align-top hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
              inMonth ? '' : 'bg-gray-50 text-gray-400'
            }`}
          >
            <span className="text-xs font-medium">{format(day, 'd')}</span>
            <div className="mt-1 space-y-0.5">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                  className={`truncate rounded border px-1 py-0.5 text-[11px] ${EVENT_COLORS[event.event_type] ?? EVENT_COLORS.other}`}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <span className="block text-[10px] text-gray-500">+{dayEvents.length - 3} more</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}