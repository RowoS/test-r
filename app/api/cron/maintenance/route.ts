import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const adminClient = createServiceRoleClient()
  const results = { expired_tickets: 0, purged_history: 0, errors: [] as string[] }

  try {
    const { data: expiredCount, error: expiryError } = await adminClient.rpc('expire_stale_pending_tickets')
    
    if (expiryError) {
      results.errors.push(`Expiry Error: ${expiryError.message}`)
    } else {
      results.expired_tickets = expiredCount || 0
    }

    const { data: purgedCount, error: purgeError } = await adminClient.rpc('purge_status_history_by_age')
    
    if (purgeError) {
      results.errors.push(`Purge Error: ${purgeError.message}`)
    } else {
      results.purged_history = purgedCount || 0
    }

    const status = results.errors.length > 0 ? 207 : 200

    return NextResponse.json(results, { status })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error during maintenance cron', details: error.message },
      { status: 500 }
    )
  }
}