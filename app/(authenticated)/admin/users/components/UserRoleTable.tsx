'use client'

import { useState, useTransition } from 'react'
import { updateUserRole, type AdminUserRow } from '@/lib/invite-actions'
import type { Database } from '@/lib/supabase/types'

type Role = Database['public']['Enums']['roles']
const ROLE_OPTIONS: Role[] = ['agent', 'manager', 'admin']

export function UserRoleTable({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState(initialUsers)

  if (users.length === 0) {
    return <p className="text-sm text-gray-400">No users yet.</p>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Email</th>
            <th className="text-left px-4 py-2">Role</th>
            <th className="text-left px-4 py-2">Department</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onUpdated={(next) =>
                setUsers((prev) => prev.map((row) => (row.id === next.id ? next : row)))
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserRow({
  user,
  onUpdated,
}: {
  user: AdminUserRow
  onUpdated: (user: AdminUserRow) => void
}) {
  const [role, setRole] = useState(user.role)
  const [department, setDepartment] = useState(user.department ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function commit(nextRole: Role, nextDepartment: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateUserRole({
        profileId: user.id,
        role: nextRole,
        department: nextDepartment,
      })
      if (!result.ok) {
        setError(result.error)
        setRole(user.role)
        setDepartment(user.department ?? '')
        return
      }
      onUpdated({ ...user, role: nextRole, department: nextDepartment || null })
    })
  }

  return (
    <tr>
      <td className="px-4 py-2 text-gray-900">{user.fullName ?? '—'}</td>
      <td className="px-4 py-2 text-gray-500">{user.email ?? '—'}</td>
      <td className="px-4 py-2">
        <select
          value={role}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value as Role
            setRole(next)
            commit(next, department)
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs bg-white disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={department}
          disabled={isPending}
          onChange={(e) => setDepartment(e.target.value)}
          onBlur={() => {
            if (department !== (user.department ?? '')) commit(role, department)
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs w-32 disabled:opacity-50"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  )
}