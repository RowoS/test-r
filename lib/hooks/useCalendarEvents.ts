'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { getEvents, type EventFilters } from '@/lib/calendar-actions';

export function useCalendarEvents(incomingFilters: EventFilters) {
  // 1. Extract the string to a simple variable (satisfies exhaustive-deps)
  const filterString = JSON.stringify(incomingFilters);

  // 2. Memoize the object. React will return the exact same object reference 
  // on every render, ONLY rebuilding it if the underlying string changes.
  // (satisfies "no refs during render" and "no cascading renders")
  const stableFilters = useMemo(() => JSON.parse(filterString), [filterString]);

  const [events, setEvents] = useState<Awaited<ReturnType<typeof getEvents>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        // 3. Use the stable object reference
        setEvents(await getEvents(stableFilters));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calendar events.');
      }
    });
  }, [stableFilters]); // Linter accepts this because it's a standard variable

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, isLoading: isPending, error, refresh };
}