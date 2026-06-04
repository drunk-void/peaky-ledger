import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { FyersAdapter } from '@/utils/broker/adapter'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const fromDate = searchParams.get('fromDate') || '2025-01-01'
    const toDate = searchParams.get('toDate') || '2025-12-31'

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

    if (connError || !connection || !connection.access_token) {
      return NextResponse.json({ error: 'No active broker connection found. Please authorize first.' }, { status: 400 })
    }

    // 2. Fetch trades from Fyers
    const adapter = new FyersAdapter()
    const rawTrades = await adapter.fetchTrades(
      connection.access_token,
      process.env.FYERS_APP_ID || '',
      { fromDate, toDate }
    )

    let syncedCount = 0

    // 3. Save trades with deduplication based on external_trade_id
    for (const t of rawTrades) {
      // Check if trade already exists
      const { data: existing } = await supabase
        .from('trades')
        .select('id')
        .eq('external_trade_id', t.external_trade_id)
        .maybeSingle()

      if (existing) continue

      // Save new trade
      const { error: insertError } = await supabase
        .from('trades')
        .insert({
          ...t,
          account_id: accountId,
          user_id: connection.user_id,
        })

      if (!insertError) {
        syncedCount++
      }
    }

    // Update last sync time
    await supabase
      .from('broker_connections')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'connected' })
      .eq('account_id', accountId)

    return NextResponse.json({ success: true, syncedCount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 })
  }
}
