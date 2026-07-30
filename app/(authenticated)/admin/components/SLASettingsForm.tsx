'use client'

import { useState, useTransition } from 'react'
import { upsertSla, type SlaPriority, type SlaRow } from '@/lib/sla-actions'

const PRIORITIES: { value: SlaPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

// Staff think in hours, the schema stores minutes — convert at the
// UI boundary only, so the stored unit never has to change to match
// whatever the form happens to display.
const minutesToHours = (minutes: number) => (minutes / 60).toString()

interface SlaSettingsFormProps {
  initialSlas: SlaRow[]
}

export function SlaSettingsForm({ initialSlas }: SlaSettingsFormProps) {
  const byPriority = new Map(initialSlas.map((s) => [s.priority, s]))

  return (
    <div className="flex flex-col space-y-4">
      {PRIORITIES.map((p) => (
        <SlaRowEditor key={p.value} priority={p.value} label={p.label} existing={byPriority.get(p.value) ?? null} />
      ))}
    </div>
  )
}

function SlaRowEditor({
  priority,
  label,
  existing,
}: {
  priority: SlaPriority
  label: string
  existing: SlaRow | null
}) {
  const [firstResponseHours, setFirstResponseHours] = useState(
    existing ? minutesToHours(existing.first_response_minutes) : ''
  )
  const [resolutionHours, setResolutionHours] = useState(
    existing ? minutesToHours(existing.resolution_minutes) : ''
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setError(null)
    setSaved(false)

    const firstResponseMinutes = Math.round(parseFloat(firstResponseHours) * 60)
    const resolutionMinutes = Math.round(parseFloat(resolutionHours) * 60)

    if (Number.isNaN(firstResponseMinutes) || Number.isNaN(resolutionMinutes)) {
      setError('Enter valid numbers for both fields.')
      return
    }

    startTransition(async () => {
      try {
        await upsertSla({
          priority,
          name: `${label} Priority SLA`,
          first_response_minutes: firstResponseMinutes,
          resolution_minutes: resolutionMinutes,
        })
        setSaved(true)
      } catch (err: any) {
        setError(err.message || 'Failed to save SLA.')
      }
    })
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-end gap-4">
      <div className="w-24">
        <span className="text-xs font-medium text-gray-500 uppercase">Priority</span>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
      </div>

      <div className="flex flex-col space-y-1 flex-1">
        <label className="text-xs font-medium text-gray-500 uppercase">First Response (hours)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={firstResponseHours}
          onChange={(e) => setFirstResponseHours(e.target.value)}
          disabled={isPending}
          className="border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col space-y-1 flex-1">
        <label className="text-xs font-medium text-gray-500 uppercase">Resolution (hours)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={resolutionHours}
          onChange={(e) => setResolutionHours(e.target.value)}
          disabled={isPending}
          className="border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col items-end space-y-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !firstResponseHours || !resolutionHours}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
        {saved && !isPending && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}