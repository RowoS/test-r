import type { getEvents } from '@/lib/calendar-actions';

type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];

export const HOUR_HEIGHT = 48; // px per hour
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
}

function getTimeOffset(date: Date, day: Date): number {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const minutesFromDayStart = (date.getTime() - dayStart.getTime()) / 60000;
  return (minutesFromDayStart / 60) * HOUR_HEIGHT;
}

/**
 * Lays out one day's events, assigning overlapping events to side-by-side
 * lanes (greedy interval coloring). Events spanning midnight are clamped
 * to the visible day — the portion outside it is simply not drawn here.
 */
export function layoutDayEvents(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const sorted = [...events].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const lanesEnd: number[] = [];
  const laneOf = new Map<string, number>();

  for (const event of sorted) {
    const start = Math.max(new Date(event.starts_at).getTime(), dayStart.getTime());
    let placed = false;
    for (let lane = 0; lane < lanesEnd.length; lane++) {
      if (lanesEnd[lane] <= start) {
        lanesEnd[lane] = new Date(event.ends_at).getTime();
        laneOf.set(event.id, lane);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanesEnd.push(new Date(event.ends_at).getTime());
      laneOf.set(event.id, lanesEnd.length - 1);
    }
  }

  // Flat lane count for the whole day, not per overlap cluster — a single
  // early overlap widens every event's lane count for the rest of the day.
  // Deliberate simplification for this event volume; revisit if a day
  // regularly sees 4+ concurrent events.
  const laneCount = Math.max(lanesEnd.length, 1);

  return sorted.map((event) => {
    const clampedStart = new Date(Math.max(new Date(event.starts_at).getTime(), dayStart.getTime()));
    const clampedEnd = new Date(Math.min(new Date(event.ends_at).getTime(), dayEnd.getTime()));
    const top = getTimeOffset(clampedStart, day);
    const height = Math.max(getTimeOffset(clampedEnd, day) - top, 20); // 20px floor for visibility

    return { event, top, height, lane: laneOf.get(event.id) ?? 0, laneCount };
  });
}