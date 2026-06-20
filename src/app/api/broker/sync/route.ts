import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { FyersAdapter } from '@/utils/broker/adapter'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const fromDate = searchParams.get('fromDate') || '2025-01-01'
    const toDate = searchParams.get('toDate') || '2025-12-31'
    const segmentType = searchParams.get('segmentType') || undefined
    const exchangeType = searchParams.get('exchangeType') || undefined

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Get broker credentials from broker_connections
    const { data: connection, error: connError } = await supabase
      .from('broker_connections')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (connError) {
      console.error('Error fetching broker connection from DB:', connError)
      return NextResponse.json({ error: `Broker connection fetch failed: ${connError.message}` }, { status: 400 })
    }

    if (!connection || !connection.access_token) {
      return NextResponse.json({ error: 'No active broker connection found. Please authorize first.' }, { status: 400 })
    }

    // Decrypt the token for usage
    const { decrypt } = await import('@/utils/encryption')
    const decryptedToken = decrypt(connection.access_token)

    // 2. Fetch trades from Fyers
    const adapter = new FyersAdapter()
    const rawTrades = await adapter.fetchTrades(
      decryptedToken,
      process.env.FYERS_APP_ID || '',
      { fromDate, toDate, segmentType, exchangeType }
    )

    let syncedCount = 0

    // 3. Save trades with deduplication based on external_trade_id
    if (rawTrades.length > 0) {
      const tradesToInsert = rawTrades.map(t => ({
        ...t,
        account_id: accountId,
        user_id: connection.user_id,
      }))

      const { error: insertError } = await supabase
        .from('trades')
        .upsert(tradesToInsert, { 
          onConflict: 'account_id,external_trade_id', 
          ignoreDuplicates: true 
        })

      if (insertError) {
        console.error('Failed to upsert trades:', insertError)
      } else {
        // NOTE: Since we ignore duplicates, the exact number of NEW inserted rows 
        // isn't returned directly unless we omit ignoreDuplicates.
        // We'll return the total fetched length for now.
        syncedCount = rawTrades.length
      }
    }

    // Update last sync time
    await supabase
      .from('broker_connections')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'connected' })
      .eq('account_id', accountId)

    return NextResponse.json({ success: true, syncedCount })
  } catch (err: unknown) {
    console.error('Sync API Route Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 })
  }
}
