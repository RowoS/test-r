'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { deleteEvent } from '@/lib/calendar-actions';
import { canEditEvent } from '@/lib/calendar-permissions';
import type { Database } from '@/lib/supabase/types';
import type { getEvents } from '@/lib/calendar-actions';

type CalendarEvent = Awaited<ReturnType<typeof getEvents>>[number];
type Role = Database['public']['Enums']['roles'];

interface Props {
  event: CalendarEvent;
  currentUserId: string;
  currentUserRole: Role;
  currentUserDepartment: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  maintenance: 'Scheduled Maintenance',
  outage: 'System Outage',
  site_visit: 'On-site Support Visit',
  staff_availability: 'Staff Availability',
  other: 'Other',
};

export function EventDetail({
  event,
  currentUserId,
  currentUserRole,
  currentUserDepartment,
  onClose,
  onEdit,
  onDeleted,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canEditEvent(
    { id: currentUserId, role: currentUserRole, department: currentUserDepartment },
    { owner_id: event.owner_id, owner: { department: event.owner.department } }
  );

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{event.title}</h3>
            <span className="text-xs text-gray-500">{EVENT_TYPE_LABELS[event.event_type]}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">When</dt>
            <dd>
              {format(new Date(event.starts_at), 'MMM d, h:mm a')} –{' '}
              {format(new Date(event.ends_at), 'MMM d, h:mm a')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Owner</dt>
            <dd>{event.owner.full_name}{event.owner.department ? ` · ${event.owner.department}` : ''}</dd>
          </div>
          {event.ticket && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Linked ticket</dt>
              <dd>
                <Link href={`/tickets/${event.ticket.id}`} className="text-blue-600 hover:underline">
                  {event.ticket.ticket_number}
                </Link>
              </dd>
            </div>
          )}
          {event.description && (
            <div>
              <dt className="mb-1 text-gray-500">Description</dt>
              <dd className="whitespace-pre-wrap">{event.description}</dd>
            </div>
          )}
        </dl>

        {canEdit && (
          <div className="flex justify-end gap-2 border-t pt-3">
            {confirmingDelete ? (
              <>
                <span className="mr-auto self-center text-xs text-red-600">Delete this event?</span>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded px-3 py-1.5 text-sm"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Confirm'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  onClick={onEdit}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}