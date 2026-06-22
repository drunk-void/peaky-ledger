import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { FyersAdapter } from '@/utils/broker/adapter'
import { Trade, CommissionRule } from '@/types/journal'
import { calculateCommission } from '@/utils/commission'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const fromDate = searchParams.get('fromDate') || '2025-01-01'
    const toDate = searchParams.get('toDate') || '2025-12-31'
    const segmentType = searchParams.get('segmentType') || undefined
    const exchangeType = searchParams.get('exchangeType') || undefined
    const syncMode = searchParams.get('syncMode') || 'trades'
    const updateFeesParam = searchParams.get('updateFees') === 'true'
    const overrideManualFees = searchParams.get('overrideManualFees') === 'true'

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

    // Fetch Commission Rules for this account
    const { data: commissionRules } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('account_id', accountId)

    // 2. Fetch data from Fyers
    const adapter = new FyersAdapter()
    let rawTrades: Partial<Trade>[] = []

    if (syncMode === 'pnl' && adapter.fetchRealisedPnL) {
      rawTrades = await adapter.fetchRealisedPnL(
        decryptedToken,
        process.env.FYERS_APP_ID || '',
        { fromDate, toDate, segmentType, exchangeType }
      )
    } else if (syncMode === 'positions' && adapter.fetchPositions) {
      rawTrades = await adapter.fetchPositions(
        decryptedToken,
        process.env.FYERS_APP_ID || ''
      )
    } else if (syncMode === 'quick-sync') {
      let qsFromDate = '2025-01-01'
      const { data: latestTrade } = await supabase
        .from('trades')
        .select('entry_time')
        .eq('account_id', accountId)
        .order('entry_time', { ascending: false })
        .limit(1)
        .single()
      
      if (latestTrade && latestTrade.entry_time) {
        qsFromDate = new Date(latestTrade.entry_time).toISOString().split('T')[0]
      }
      const qsToDate = new Date().toISOString().split('T')[0]

      if (adapter.fetchQuickSync) {
        rawTrades = await adapter.fetchQuickSync(
          decryptedToken,
          process.env.FYERS_APP_ID || '',
          { fromDate: qsFromDate, toDate: qsToDate },
          commissionRules || []
        )
      }
    } else if (syncMode === 'todays-orders' && adapter.fetchTodaysOrders) {
      rawTrades = await adapter.fetchTodaysOrders(
        decryptedToken,
        process.env.FYERS_APP_ID || '',
        commissionRules || []
      )
    } else if (syncMode === 'order-history' && adapter.fetchOrderHistory) {
      rawTrades = await adapter.fetchOrderHistory(
        decryptedToken,
        process.env.FYERS_APP_ID || '',
        { fromDate, toDate, segmentType, exchangeType },
        commissionRules || []
      )
    } else {
      rawTrades = await adapter.fetchTrades(
        decryptedToken,
        process.env.FYERS_APP_ID || '',
        { fromDate, toDate, segmentType, exchangeType },
        commissionRules || []
      )
    }

    let syncedCount = 0

    // 3. Save trades with deduplication and Smart Merger
    if (rawTrades.length > 0) {
      const externalTradeIds = rawTrades.map(t => t.external_trade_id!).filter(Boolean)
      
      const { data: existingTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('account_id', accountId)
        .in('external_trade_id', externalTradeIds)

      const existingMap = new Map((existingTrades || []).map(t => [t.external_trade_id, t]))

      const tradesToInsert = rawTrades.map(incoming => {
        const existing = incoming.external_trade_id ? existingMap.get(incoming.external_trade_id) : null
        
        let finalFees = incoming.fees || 0
        let finalFeesAuto = incoming.fees_auto_calculated || false
        let finalGross = incoming.gross_pnl ?? null
        let finalNet = incoming.net_pnl ?? null

        // If fees not auto-calculated yet (e.g. from PnL sync), compute them
        if (!finalFeesAuto && commissionRules && commissionRules.length > 0) {
          try {
            finalFees = calculateCommission(commissionRules, {
              entry_price: incoming.entry_price || 0,
              exit_price: incoming.exit_price || null,
              quantity: incoming.quantity || 0,
              asset_class: incoming.asset_class || 'equity',
              number_of_orders: incoming.number_of_orders
            })
            finalFeesAuto = true
            finalNet = finalGross !== null ? finalGross - finalFees : null
          } catch(e) {
            console.error('Commission calculation failed in sync route:', e)
          }
        }

        if (existing) {
          if (updateFeesParam) {
            // User requested to update existing fees
            if (existing.fees_auto_calculated === false && !overrideManualFees) {
              // Preserve manual fee
              finalFees = existing.fees
              finalFeesAuto = false
            } else {
              // Update fee (use incoming fee)
              finalFees = incoming.fees || 0
              finalFeesAuto = true
            }
          } else {
            // Default behavior: Don't update fees on existing trades, keep what's in DB
            // (Unless it was fully manual, which we always preserve, but here we preserve all)
            finalFees = existing.fees
            finalFeesAuto = existing.fees_auto_calculated
          }

          // Always recalculate net based on the chosen fee and incoming gross
          finalNet = finalGross !== null ? finalGross - finalFees : null

          return {
            ...incoming,
            id: existing.id,
            setup: existing.setup,
            notes: existing.notes,
            satisfaction: existing.satisfaction,
            plan_adherence: existing.plan_adherence,
            emotion: existing.emotion,
            fees: finalFees,
            fees_auto_calculated: finalFeesAuto,
            net_pnl: finalNet,
            gross_pnl: finalGross,
            number_of_orders: incoming.number_of_orders,
            account_id: accountId,
            user_id: connection.user_id,
          }
        } else {
          return {
            ...incoming,
            fees: finalFees,
            fees_auto_calculated: finalFeesAuto,
            net_pnl: finalNet,
            gross_pnl: finalGross,
            number_of_orders: incoming.number_of_orders,
            account_id: accountId,
            user_id: connection.user_id,
          }
        }
      })

      const { error: insertError } = await supabase
        .from('trades')
        .upsert(tradesToInsert, { 
          onConflict: 'account_id,external_trade_id',
          ignoreDuplicates: false // Set to false so OPEN trades can be updated to CLOSED
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
