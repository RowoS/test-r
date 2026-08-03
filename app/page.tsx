'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function InviteHandler() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleInvite = async () => {
      // 1. Immediately clear any existing session to prevent overwrites
      await supabase.auth.signOut()

      // 2. Listen for the URL hash to establish the *new* session
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.push('/update-password')
        }
      })

      // 3. Check for URL errors (e.g., expired link)
      if (window.location.hash.includes('error=')) {
        setError("This invite link is invalid or has expired.")
      }

      return () => {
        authListener.subscription.unsubscribe()
      }
    }

    handleInvite()
  }, [router])

  if (error) return <div>{error}</div>
  return <div>Verifying your invite...</div>
}