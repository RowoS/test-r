'use client'

import { useState, useTransition } from 'react'
import { getActivityLog } from '@/lib/activity-actions'
import { describeActivity, ACTIVITY_ACTIONS } from '@/lib/activity-format'
import type { ActivityLogRow } from '@/lib/activity-types'

const PAGE_SIZE = 25

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'ticket', label: 'Tickets' },
  { value: 'sla', label: 'SLAs' },
  { value: 'room_reservation', label: 'Room Reservations' },
  { value: 'conference_room', label: 'Conference Rooms' },
]

// Action options depend on entity type. Filtering the dropdown to only
// actions that can actually occur on the selected entity avoids a dead
// combination like entityType=sla + action=room_reservation.created,
// which would just silently return zero rows.
function actionsFor(entityType: string) {
  if (!entityType) return ACTIVITY_ACTIONS
  return ACTIVITY_ACTIONS.filter((a) => a.value.startsWith(`${entityType}.`))
}

export function ActivityLogView({ initialLogs }: { initialLogs: ActivityLogRow[] }) {
  const [logs, setLogs] = useState<ActivityLogRow[]>(initialLogs)
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [hasMore, setHasMore] = useState(initialLogs.length === PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchWith = (entityType: string, action: string) => {
    setError(null)
    startTransition(async () => {
      try {
        const data = await getActivityLog({
          entityType: entityType || undefined,
          action: action || undefined,
          limit: PAGE_SIZE,
        })
        setLogs(data)
        setHasMore(data.length === PAGE_SIZE)
      } catch {
        setError("Couldn't load activity for that filter.")
      }
    })
  }

  const applyEntityType = (entityType: string) => {
    setEntityTypeFilter(entityType)
    // Reset action filter if it no longer applies to the new entity type
    // — e.g. switching from "Tickets" to "SLAs" while "Ticket Assigned"
    // was selected would otherwise produce a query that never matches.
    const nextAction = actionsFor(entityType).some((a) => a.value === actionFilter)
      ? actionFilter
      : ''
    setActionFilter(nextAction)
    fetchWith(entityType, nextAction)
  }

  const applyAction = (action: string) => {
    setActionFilter(action)
    fetchWith(entityTypeFilter, action)
  }

  const loadMore = () => {
    const last = logs.at(-1)
    if (!last) return

    startTransition(async () => {
      try {
        const data = await getActivityLog({
          entityType: entityTypeFilter || undefined,
          action: actionFilter || undefined,
          limit: PAGE_SIZE,
          before: last.createdAt,
        })
        setLogs((prev) => [...prev, ...data])
        setHasMore(data.length === PAGE_SIZE)
      } catch {
        setError("Couldn't load more activity.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="entity-filter" className="text-sm text-gray-600">Entity:</label>
          <select
            id="entity-filter"
            value={entityTypeFilter}
            onChange={(e) => applyEntityType(e.target.value)}
            disabled={isPending}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white disabled:opacity-50"
          >
            <option value="">All Entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="action-filter" className="text-sm text-gray-600">Action:</label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => applyAction(e.target.value)}
            disabled={isPending}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white disabled:opacity-50"
          >
            <option value="">All Actions</option>
            {actionsFor(entityTypeFilter).map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {logs.length === 0 && !isPending ? (
          <p className="text-sm text-gray-400 p-4">No activity found.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {logs.map((log) => (
              <li key={log.id} className="p-4">
                <p className="text-sm text-gray-900">{describeActivity(log)}</p>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isPending}
          className="self-center text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}