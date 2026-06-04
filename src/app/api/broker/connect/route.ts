import { NextResponse } from 'next/server'
import { FyersAdapter } from '@/utils/broker/adapter'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const adapter = new FyersAdapter()
    const authUrl = adapter.getAuthUrl()

    // Redirect to Fyers OAuth Page
    return NextResponse.redirect(authUrl)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to connect broker' }, { status: 500 })
  }
}
