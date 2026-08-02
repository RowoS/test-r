'use client';

import type { Database } from '@/lib/supabase/types';

type EventType = Database['public']['Enums']['event_type'];
type Owner = { id: string; full_name: string; department: string | null };

interface Props {
  selectedTypes?: EventType[];
  selectedOwnerId?: string;
  owners: Owner[];
  onChange: (next: { eventTypes?: string[]; ownerId?: string }) => void;
}

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'outage', label: 'Outage' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'staff_availability', label: 'Staff Availability' },
  { value: 'other', label: 'Other' },
];

export function CalendarFilters({ selectedTypes, selectedOwnerId, owners, onChange }: Props) {
  const activeTypes = selectedTypes ?? [];

  function toggleType(type: EventType) {
    const next = activeTypes.includes(type)
      ? activeTypes.filter((t) => t !== type)
      : [...activeTypes, type];
    onChange({ eventTypes: next, ownerId: selectedOwnerId });
  }

  function clearAll() {
    onChange({ eventTypes: [], ownerId: undefined });
  }

  const hasActiveFilters = activeTypes.length > 0 || !!selectedOwnerId;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {EVENT_TYPE_OPTIONS.map(({ value, label }) => {
          const active = activeTypes.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleType(value)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <select
        value={selectedOwnerId ?? ''}
        onChange={(e) => onChange({ eventTypes: activeTypes, ownerId: e.target.value || undefined })}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600"
      >
        <option value="">All owners</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.full_name}{owner.department ? ` (${owner.department})` : ''}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto text-xs text-gray-500 underline hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}