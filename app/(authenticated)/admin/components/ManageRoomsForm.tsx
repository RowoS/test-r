'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createConferenceRoom, deactivateConferenceRoom, updateConferenceRoom } from '@/lib/room-admin-actions';
import type { ConferenceRoom } from '@/lib/room-actions';

type Props = {
  rooms: ConferenceRoom[];
};

export function ManageRoomsForm({ rooms }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedCapacity = Number(capacity);
    if (!name || !parsedCapacity || parsedCapacity <= 0) {
      setError('Give the room a name and a capacity greater than zero.');
      return;
    }

    startTransition(async () => {
      const { error: createError } = await createConferenceRoom({
        name,
        location: location || undefined,
        capacity: parsedCapacity,
      });
      if (createError) {
        setError(createError);
        return;
      }
      setName('');
      setLocation('');
      setCapacity('');
    });
  }

  function handleToggleActive(room: ConferenceRoom) {
    startTransition(async () => {
      if (room.is_active) {
        await deactivateConferenceRoom(room.id);
      } else {
        await updateConferenceRoom(room.id, { is_active: true });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Add a room</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input placeholder="Name (e.g. Redwood)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input placeholder="Capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isPending} className="self-start">
          Add room
        </Button>
      </form>

      <div className="flex flex-col divide-y rounded-lg border">
        {rooms.map((room) => (
          <div key={room.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">
                {room.name} {!room.is_active && <span className="text-muted-foreground">(inactive)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {room.location ? `${room.location} · ` : ''}Seats {room.capacity}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleToggleActive(room)}>
              {room.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}