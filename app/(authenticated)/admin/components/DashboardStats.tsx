'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  YAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
  XAxis,
} from 'recharts'
import {
  getTicketsOpenedOverTime,
  type DashboardCounts,
  type RecentTicket,
  type CategoryBreakdown,
  type OpenedBucket,
  type OpenedPeriod,
  type RecentActivity,
  type AgentWorkload
} from '@/lib/dashboard-actions'
import { describeActivity } from '@/lib/activity-format'

interface DashboardStatsProps {
  role: 'admin' | 'agent' | 'manager'  
  counts: DashboardCounts | null
  recentTickets: RecentTicket[] | null
  byCategory: CategoryBreakdown[] | null
  initialOpened: OpenedBucket[] | null
  recentActivity: RecentActivity[] | null
  agentWorkload: AgentWorkload[] | null
}

export function DashboardStats({
  role,
  counts,
  recentTickets,
  byCategory,
  initialOpened,
  recentActivity,
  agentWorkload
}: DashboardStatsProps) {
  return (
    <div className="flex flex-col gap-6">
      <CountCards counts={counts} />
      <OpenedOverTime initial={initialOpened} />
      <div className={`grid grid-cols-1 ${role === 'manager' ? '' : 'md:grid-cols-2'} gap-6`}>
        <CategoryBreakdownList byCategory={byCategory} />
        {role !== 'manager' && <RecentTicketsList tickets={recentTickets} />}
      </div>
      {role === 'admin' && <AgentWorkloadChart data={agentWorkload}/>}
      {role === 'admin' && <RecentActivityList activity={recentActivity} />}
    </div>
  )
}

function RecentActivityList({ activity }: { activity: RecentActivity[] | null }) {
  if (!activity) {
    return <ErrorState label="activity log" />
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h2>
      {activity.length === 0 ? (
        <p className="text-sm text-gray-400">No activity yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {activity.map((a) => (
            <li key={a.id} className="py-2">
              <p className="text-sm text-gray-900">{describeActivity(a)}</p>
              <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ErrorState({ label }: { label: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-lg p-4">
      <p className="text-sm text-red-600">Couldn&apos;t load {label}.</p>
    </div>
  )
}

function CountCards({ counts }: { counts: DashboardCounts | null }) {
  if (!counts) {
    return <ErrorState label="ticket counts" />
  }

  const cards = [
    { label: 'Open', value: counts.openCount, tone: 'default' as const },
    { label: 'In Progress', value: counts.inProgressCount, tone: 'default' as const },
    { label: 'Approaching SLA', value: counts.approachingSlaCount, tone: 'warning' as const },
    { label: 'SLA Breached', value: counts.breachedSlaCount, tone: 'danger' as const },
  ]

  const toneClasses = {
    default: 'text-gray-900',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase">{c.label}</p>
          <p className={`text-3xl font-bold mt-1 ${toneClasses[c.tone]}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function OpenedOverTime({ initial }: { initial: OpenedBucket[] | null }) {
  const [period, setPeriod] = useState<OpenedPeriod>('week')
  const [buckets, setBuckets] = useState<OpenedBucket[] | null>(initial)
  const [isPending, startTransition] = useTransition()
  const [fetchFailed, setFetchFailed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handlePeriodChange = (next: OpenedPeriod) => {
    setPeriod(next)
    setFetchFailed(false)
    startTransition(async () => {
      try {
        const data = await getTicketsOpenedOverTime(next)
        setBuckets(data)
      } catch {
        setFetchFailed(true)
      }
    })
  }

  const initialLoadFailed = initial === null
  const data = buckets ?? []

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Tickets Opened</h2>
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              disabled={isPending || initialLoadFailed}
              className={`px-2 py-1 text-xs rounded-md capitalize ${
                period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              } disabled:opacity-50`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {initialLoadFailed ? (
        <ErrorState label="ticket volume" />
      ) : (
        <>
          {fetchFailed && (
            <p className="text-xs text-red-600 mb-2">Couldn&apos;t refresh — showing last loaded data.</p>
          )}
          {isPending ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-gray-400">No tickets in this range.</p>
          ) : (
            <div className="h-48 w-full mt-4">
              {!isMounted ? (
                <div className="w-full h-full bg-gray-50 animate-pulse rounded-md" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <XAxis 
                      dataKey="bucket" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      minTickGap={20}
                      dy={10}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                      itemStyle={{ color: '#111827', fontSize: '0.875rem' }}
                      labelStyle={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#2563eb', strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CategoryBreakdownList({ byCategory }: { byCategory: CategoryBreakdown[] | null }) {
  if (!byCategory) {
    return <ErrorState label="category breakdown" />
  }

  const max = Math.max(1, ...byCategory.map((c) => c.ticketCount))

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Tickets by Category</h2>
      {byCategory.length === 0 ? (
        <p className="text-sm text-gray-400">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {byCategory.map((c) => (
            <li key={c.categoryId} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-28 truncate">{c.categoryName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(c.ticketCount / max) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-6 text-right">{c.ticketCount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecentTicketsList({ tickets }: { tickets: RecentTicket[] | null }) {
  if (!tickets) {
    return <ErrorState label="recent tickets" />
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Recently Opened</h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-gray-400">No tickets yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {tickets.map((t) => (
            <li key={t.id} className="py-2">
              <a href={`/tickets/${t.id}`} className="text-sm text-gray-900 hover:text-blue-600 truncate block">
                {t.ticketNumber} — {t.title}
              </a>
              <span className="text-xs text-gray-400">{t.status} · {t.priority}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AgentWorkloadChart({ data }: { data: AgentWorkload[] | null }) {
  if (!data) {
    return <ErrorState label="agent workload" />
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Agent Workload</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400">No agents yet.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="agentName"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                interval={0}
                angle={-20}
               textAnchor="end"
                height={50}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: '0.5rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                itemStyle={{ fontSize: '0.875rem' }}
                labelStyle={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="inProgressCount" name="In Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closedCount" name="Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}