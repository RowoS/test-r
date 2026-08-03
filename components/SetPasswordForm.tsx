'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPassword } from '@/lib/auth-actions'

export function SetPasswordForm({ expectedEmail }: { expectedEmail: string }) {
  const router = useRouter()
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await setPassword({ password, confirmPassword, expectedEmail })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(result.redirectTo)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Set password & continue'}
      </button>
    </form>
  )
}