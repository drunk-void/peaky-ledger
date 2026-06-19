import crypto from 'crypto'
import { Trade } from '@/types/journal'

export interface BrokerAdapter {
  getAuthUrl(accountId?: string): string
  exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiry: Date }>
  fetchTrades(
    accessToken: string,
    appId: string,
    params: {
      fromDate: string
      toDate: string
      symbol?: string
    }
  ): Promise<Partial<Trade>[]>
}

export class FyersAdapter implements BrokerAdapter {
  private appId: string
  private redirectUri: string

  constructor() {
    this.appId = process.env.FYERS_APP_ID || ''
    this.redirectUri = process.env.FYERS_REDIRECT_URI || ''
  }

  getAuthUrl(accountId?: string): string {
    // If accountId is provided, pass it in the state parameter.
    // Otherwise use a default state.
    const state = accountId ? `accountId=${accountId}` : 'fyers-auth-state'
    return `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${this.appId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiry: Date }> {
    const appSecret = process.env.FYERS_APP_SECRET || ''
    
    // In Fyers v3, we need to create SHA256 of appId + appSecret and send it
    const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        appIdHash: this.hashAppIdSecret(this.appId, appSecret),
      }),
    })

    const data = await response.json()
    if (data.s !== 'ok') {
      throw new Error(data.message || 'Failed to exchange auth code')
    }

    // Usually expires in 24 hours (86400 seconds)
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    return {
      accessToken: data.access_token,
      expiry,
    }
  }

  async fetchTrades(
    accessToken: string,
    appId: string,
    params: {
      fromDate: string
      toDate: string
      symbol?: string
    }
  ): Promise<Partial<Trade>[]> {
    // Call the Trade History endpoint
    // Endpoint: /api/v3/trade-history?exchange_type=0&from_date=2025-04-01&to_date=2025-12-22&page_no=1&page_size=10&segment_type=0&symbol=NSE:SUZLON-A-EQ
    // Note: exchange_type and segment_type are query parameters. We default them to equity/FO segments (0 or 1).
    const symbolParam = params.symbol ? `&symbol=${encodeURIComponent(params.symbol)}` : ''
    
    const url = `https://api-t1.fyers.in/api/v3/trade-history?exchange_type=0&from_date=${params.fromDate}&to_date=${params.toDate}&page_no=1&page_size=100&segment_type=0${symbolParam}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `${appId}:${accessToken}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`Fyers API returned HTTP ${response.status}:`, text)
      throw new Error(`Fyers API returned HTTP ${response.status}: ${text || response.statusText}`)
    }

    let resData: { s: string; message?: string; data?: FyersTradeRecord[] }
    try {
      resData = await response.json()
    } catch {
      const text = await response.text()
      console.error(`Failed to parse Fyers API response as JSON:`, text)
      throw new Error(`Invalid JSON response from Fyers API: ${text.substring(0, 100)}`)
    }

    if (resData.s !== 'ok') {
      console.error(`Fyers API error response:`, resData)
      throw new Error(resData.message || `Fyers API error: status ${resData.s}`)
    }

    const rawTrades = resData.data || []
    
    // Map Fyers trade fields to our standard Trade type
    return rawTrades.map((t) => {
      const side: 'LONG' | 'SHORT' = t.side === 1 ? 'LONG' : 'SHORT'
      
      return {
        external_trade_id: t.tradeNumber,
        symbol: t.symbol,
        display_symbol: t.description || t.symbol.split(':').pop() || t.symbol,
        asset_class: this.mapSegmentToAssetClass(t.segment),
        exchange: this.mapExchange(t.exchange),
        side,
        quantity: Number(t.traded_qty),
        entry_price: Number(t.trade_price),
        entry_time: this.parseDateTime(t.orderDateTime),
        gross_pnl: null, // calculated when pairing
        net_pnl: null,
        fees: 0, // calculated from Fyers fee models or provided
        currency: 'INR',
        status: 'CLOSED', // individual trade reports represent executed trades
        source: 'fyers_api',
      }
    })
  }

  private hashAppIdSecret(appId: string, secret: string): string {
    // SHA256 of appId + ":" + secret
    return crypto.createHash('sha256').update(`${appId}:${secret}`).digest('hex')
  }

  private mapSegmentToAssetClass(segment: number): 'equity' | 'futures' | 'options' | 'forex' {
    // Fyers segment IDs: 10 = Equity, 11 = FO, 12 = Currency, etc.
    if (segment === 11) return 'futures'
    if (segment === 12) return 'forex'
    return 'equity'
  }

  private mapExchange(exchange: number): string {
    if (exchange === 10) return 'NSE'
    if (exchange === 11) return 'MCX'
    if (exchange === 12) return 'BSE'
    return 'NSE'
  }

  private parseDateTime(dateTimeStr: string): string {
    // Format: "13-Jun-2025 20:05:38" -> standard ISO string
    // Let's replace month abbreviations and build a clean date
    return new Date(dateTimeStr).toISOString()
  }
}

interface FyersTradeRecord {
  tradeNumber: string
  symbol: string
  description?: string
  segment: number
  exchange: number
  side: number
  traded_qty: number | string
  trade_price: number | string
  orderDateTime: string
}
