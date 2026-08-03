'use client'

import { useState, useTransition } from 'react'
import { inviteUser, type InviteUserInput } from '@/lib/invite-actions'

const ROLE_OPTIONS: { value: InviteUserInput['role']; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

const initialForm: InviteUserInput = { email: '', fullName: '', role: 'agent', department: '' }

export function InviteUserForm() {
  const [form, setForm] = useState<InviteUserInput>(initialForm)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof InviteUserInput, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange<K extends keyof InviteUserInput>(key: K, value: InviteUserInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    setCreated(null)

    startTransition(async () => {
      const result = await inviteUser(form)
      if (!result.ok) {
        setFormError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setCreated({ email: form.email, tempPassword: result.tempPassword })
      setForm(initialForm)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-900">Create a user</h2>

      {formError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {formError}
        </p>
      )}

      {created && (
        <div className="text-sm bg-green-50 border border-green-100 rounded-md px-3 py-3 flex flex-col gap-2">
          <p className="text-green-800">
            Account created for <strong>{created.email}</strong>. Give them this temporary password —
            it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-white border border-green-200 rounded px-2 py-1 font-mono text-gray-900">
              {created.tempPassword}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(created.tempPassword)}
              className="text-xs px-2 py-1 rounded-md border border-green-200 text-green-700 hover:bg-green-100"
            >
              Copy
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full name" error={fieldErrors.fullName}>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="Jane Cooper"
            required
          />
        </Field>

        <Field label="Email" error={fieldErrors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="jane@company.com"
            required
          />
        </Field>

        <Field label="Role" error={fieldErrors.role}>
          <select
            value={form.role}
            onChange={(e) => handleChange('role', e.target.value as InviteUserInput['role'])}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department" error={fieldErrors.department} hint="Optional">
          <input
            type="text"
            value={form.department}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="IT Operations"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white disabled:opacity-50"
      >
        {isPending ? 'Sending invite…' : 'Send invite'}
      </button>
    </form>
  )
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">
        {label} {hint && <span className="text-gray-400 font-normal">({hint})</span>}
      </span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}