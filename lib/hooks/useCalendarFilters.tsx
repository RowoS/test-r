// lib/hooks/useCalendarFilters.ts
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { EventFilters } from '@/lib/calendar-actions';

export function useCalendarFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const eventTypes = searchParams.get('types')?.split(',').filter(Boolean) as EventFilters['eventTypes'];
  const ownerId = searchParams.get('owner') ?? undefined;

  const setFilters = (next: { eventTypes?: string[]; ownerId?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.eventTypes?.length) params.set('types', next.eventTypes.join(','));
    else params.delete('types');
    if (next.ownerId) params.set('owner', next.ownerId);
    else params.delete('owner');
    router.replace(`${pathname}?${params.toString()}`);
  };

  return { eventTypes, ownerId, setFilters };
}