'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelReservation, type RoomReservationWithRoom } from '@/lib/room-actions';

type Props = {
  reservations: RoomReservationWithRoom[];
};

export function MyReservationsList({ reservations }: Props) {
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (reservations.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming reservations.</p>;
  }

  function handleCancel(id: string) {
    setError(null);
    startTransition(async () => {
      const { error: cancelError } = await cancelReservation(id);
      if (cancelError) {
        setError(cancelError);
        return;
      }
      setCancelledIds((prev) => new Set(prev).add(id));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {reservations
        .filter((r) => !cancelledIds.has(r.id))
        .map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {r.conference_rooms.name}
                {' · '}
                {new Date(r.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                {' – '}
                {new Date(r.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleCancel(r.id)}>
              Cancel
            </Button>
          </div>
        ))}
    </div>
  );
}