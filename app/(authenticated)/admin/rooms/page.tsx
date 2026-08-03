import { createClient } from '@/lib/supabase/server';
import { ManageRoomsForm } from '../components/ManageRoomsForm';
import type { ConferenceRoom } from '@/lib/room-actions';

export default async function AdminRoomsPage() {
  const supabase = await createClient();

  const { data: rooms, error } = await supabase
    .from('conference_rooms')
    .select('id, name, location, capacity, is_active')
    .order('name')
    .returns<ConferenceRoom[]>();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Manage conference rooms</h1>
        <p className="text-sm text-muted-foreground">Add rooms and set their capacity, or retire ones no longer available.</p>
      </div>

      {error ? <p className="text-sm text-red-600">Could not load rooms: {error.message}</p> : <ManageRoomsForm rooms={rooms ?? []} />}
    </div>
  );
}