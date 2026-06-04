import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { FyersAdapter } from '@/utils/broker/adapter'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('auth_code') || searchParams.get('code')
    const state = searchParams.get('state')
    
    // In case Fyers returns an error
    const error = searchParams.get('error')
    if (error) {
      return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(error)}`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/import?error=Missing+auth+code', request.url))
    }

    // Extract accountId from state if present
    let accountId = null
    if (state && state.startsWith('accountId=')) {
      accountId = state.replace('accountId=', '')
    }

    if (!accountId) {
      return NextResponse.redirect(new URL('/import?error=Missing+accountId+in+state', request.url))
    }

    // Exchange code for token
    const adapter = new FyersAdapter()
    const { accessToken } = await adapter.exchangeCodeForToken(code)

    const supabase = await createClient()

    // Get the user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // If not authenticated, we could just rely on the existing account to have the user_id
    // But it's safer to just fetch it if we can.
    if (userError || !user) {
      return NextResponse.redirect(new URL('/import?error=Not+authenticated', request.url))
    }

    // Upsert broker connection
    const { error: upsertError } = await supabase
      .from('broker_connections')
      .upsert({
        account_id: accountId,
        user_id: user.id,
        access_token: accessToken,
        broker: 'fyers',
        sync_status: 'connected',
        last_sync_at: new Date().toISOString()
      }, { onConflict: 'account_id' })

    if (upsertError) {
      throw upsertError
    }

    // Redirect to import page with success flag
    return NextResponse.redirect(new URL('/import?success=Broker+connected', request.url))

  } catch (err: any) {
    console.error('Broker callback error:', err)
    return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(err.message || 'Callback failed')}`, request.url))
  }
}
