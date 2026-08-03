import { listConferenceRooms, listMyReservations } from '@/lib/room-actions';
import { RoomReservationForm } from './components/RoomReservationForm';
import { MyReservationsList } from './components/MyReservationsList';

export default async function RoomsPage() {
  const [{ data: rooms, error: roomsError }, { data: myReservations, error: reservationsError }] =
    await Promise.all([listConferenceRooms(), listMyReservations()]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Conference rooms</h1>
        <p className="text-sm text-muted-foreground">
          Reserve a room for a meeting. Booking a room automatically adds it to the shared calendar.
        </p>
      </div>

      {roomsError ? (
        <p className="text-sm text-red-600">Could not load rooms: {roomsError}</p>
      ) : (
        <RoomReservationForm rooms={rooms ?? []} />
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold">Your upcoming reservations</h2>
        {reservationsError ? (
          <p className="text-sm text-red-600">Could not load reservations: {reservationsError}</p>
        ) : (
          <MyReservationsList reservations={myReservations ?? []} />
        )}
      </div>
    </div>
  );
}