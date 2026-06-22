import crypto from 'crypto'
import { Trade, CommissionRule } from '@/types/journal'
import { TradeEngine, ExecutionLeg } from './tradeEngine'
import { parseBrokerSymbol } from './symbolParser'

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
      segmentType?: string
      exchangeType?: string
    },
    commissionRules?: CommissionRule[]
  ): Promise<Partial<Trade>[]>
  fetchRealisedPnL?(
    accessToken: string,
    appId: string,
    params: { fromDate: string; toDate: string; segmentType?: string; exchangeType?: string }
  ): Promise<Partial<Trade>[]>
  fetchPositions?(
    accessToken: string,
    appId: string
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
        grant_type: 'authorization_code',
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
      segmentType?: string
      exchangeType?: string
    },
    commissionRules: CommissionRule[] = []
  ): Promise<Partial<Trade>[]> {
    const symbolParam = params.symbol ? `&symbol=${encodeURIComponent(params.symbol)}` : ''
    const segmentType = params.segmentType || '0'
    const exchangeType = params.exchangeType || '0'
    const statusParam = '&status=1'
    
    let allTrades: FyersTradeRecord[] = []
    let pageNo = 1
    const pageSize = 100
    let hasMore = true

    while (hasMore) {
      const url = `https://api-t1.fyers.in/api/v3/trade-history?exchange_type=${exchangeType}&from_date=${params.fromDate}&to_date=${params.toDate}&page_no=${pageNo}&page_size=${pageSize}&segment_type=${segmentType}${symbolParam}${statusParam}`

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
      allTrades = allTrades.concat(rawTrades)

      if (rawTrades.length < pageSize) {
        hasMore = false
      } else {
        pageNo++
      }
    }

    const executionLegs: ExecutionLeg[] = allTrades.map((t) => {
      const side: 'LONG' | 'SHORT' = t.side === 1 ? 'LONG' : 'SHORT'
      
      const parsed = parseBrokerSymbol(t.symbol)
      const displaySymbol = (parsed.isDerivative || parsed.series) ? parsed.formattedString : (t.description || parsed.formattedString)
      
      return {
        id: t.tradeNumber,
        symbol: t.symbol,
        display_symbol: displaySymbol,
        asset_class: parsed.optionType ? 'options' : (parsed.isDerivative ? 'futures' : this.mapSegmentToAssetClass(t.segment)),
        exchange: this.mapExchange(t.exchange),
        side,
        quantity: Number(t.traded_qty),
        price: Number(t.trade_price),
        timestamp: this.parseDateTime(t.orderDateTime),
      }
    })

    // Process chronological executions through the generic TradeEngine
    // Note: Fyers API usually returns trades in chronological order, but we sort to be safe
    executionLegs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return TradeEngine.processExecutions(executionLegs, commissionRules)
  }

  async fetchRealisedPnL(
    accessToken: string,
    appId: string,
    params: {
      fromDate: string
      toDate: string
      segmentType?: string
      exchangeType?: string
    }
  ): Promise<Partial<Trade>[]> {
    const segmentType = params.segmentType || '0'
    const exchangeType = params.exchangeType || '0'
    
    let allPnL: FyersPnLRecord[] = []
    let pageNo = 1
    const pageSize = 100
    let hasMore = true

    while (hasMore) {
      const url = `https://api-t1.fyers.in/api/v3/realised-pnl-history?exchange_type=${exchangeType}&from_date=${params.fromDate}&to_date=${params.toDate}&page_no=${pageNo}&page_size=${pageSize}&segment_type=${segmentType}`

      const response = await fetch(url, { headers: { 'Authorization': `${appId}:${accessToken}` } })
      if (!response.ok) throw new Error(`Fyers API returned HTTP ${response.status}`)
      
      const resData = await response.json() as { s: string; message?: string; data?: FyersPnLRecord[] }
      if (resData.s !== 'ok') throw new Error(resData.message || 'Fyers API error')

      const raw = resData.data || []
      allPnL = allPnL.concat(raw)

      if (raw.length < pageSize) {
        hasMore = false
      } else {
        pageNo++
      }
    }

    return allPnL.filter(t => !!t.symbol).map((t) => {
      const qty = Number(t.qty || t.quantity || t.traded_qty || 0)
      const entryPrice = Number(t.buy_avg || t.buy_price || t.entry_price || 0)
      const exitPrice = Number(t.sell_avg || t.sell_price || t.exit_price || 0)
      const pnl = Number(t.realized_profit || t.pnl || t.net_pnl || 0)
      
      const side = 'LONG' 
      
      const parsed = parseBrokerSymbol(t.symbol)
      const displaySymbol = (parsed.isDerivative || parsed.series) ? parsed.formattedString : (t.description || parsed.formattedString)

      return {
        external_trade_id: t.id || t.tradeNumber || `${t.symbol}_pnl_${t.entry_date || params.fromDate}`,
        symbol: t.symbol,
        display_symbol: displaySymbol,
        asset_class: parsed.optionType ? 'options' : (parsed.isDerivative ? 'futures' : this.mapSegmentToAssetClass(t.segment || 10)),
        exchange: this.mapExchange(t.exchange || 10),
        side,
        quantity: qty,
        entry_price: entryPrice,
        exit_price: exitPrice,
        entry_time: t.entry_date ? new Date(t.entry_date).toISOString() : new Date(`${params.fromDate}T00:00:00Z`).toISOString(),
        exit_time: t.exit_date ? new Date(t.exit_date).toISOString() : new Date(`${params.toDate}T23:59:59Z`).toISOString(),
        net_pnl: pnl,
        gross_pnl: pnl,
        status: 'CLOSED',
        source: 'fyers_api',
      }
    })
  }

  async fetchPositions(
    accessToken: string,
    appId: string
  ): Promise<Partial<Trade>[]> {
    const url = `https://api-t1.fyers.in/api/v3/positions`

    const response = await fetch(url, { headers: { 'Authorization': `${appId}:${accessToken}` } })
    if (!response.ok) throw new Error(`Fyers API returned HTTP ${response.status}`)
    
    const resData = await response.json() as { s: string; message?: string; netPositions?: FyersPositionRecord[]; data?: FyersPositionRecord[] }
    if (resData.s !== 'ok') throw new Error(resData.message || 'Fyers API error')

    const rawPositions = resData.netPositions || resData.data || []

    return rawPositions.filter((p: FyersPositionRecord) => !!p.symbol).map((p: FyersPositionRecord) => {
      const netQty = Number(p.netQty || 0)
      const isClosed = netQty === 0
      
      const qty = isClosed ? Number(p.buyQty || p.sellQty || Math.abs(netQty) || 1) : Math.abs(netQty)
      const entryPrice = Number(p.buyAvg || p.avgPrice || 0)
      const exitPrice = isClosed ? Number(p.sellAvg || p.ltp || 0) : null
      const pnl = Number(p.realized_profit || p.pl || 0)
      
      const side = (p.side === 1 || netQty > 0) ? 'LONG' : 'SHORT'
      
      const parsed = parseBrokerSymbol(p.symbol)
      const displaySymbol = (parsed.isDerivative || parsed.series) ? parsed.formattedString : (parsed.formattedString)

      return {
        external_trade_id: p.id || p.positionId || `${p.symbol}_pos_${new Date().toISOString().split('T')[0]}`,
        symbol: p.symbol,
        display_symbol: displaySymbol,
        asset_class: parsed.optionType ? 'options' : (parsed.isDerivative ? 'futures' : this.mapSegmentToAssetClass(p.segment || 10)),
        exchange: this.mapExchange(p.exchange || 10),
        side,
        quantity: qty,
        entry_price: entryPrice,
        exit_price: exitPrice,
        entry_time: new Date().toISOString(),
        net_pnl: pnl,
        gross_pnl: pnl,
        status: isClosed ? 'CLOSED' : 'OPEN',
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

interface FyersPnLRecord {
  id?: string
  tradeNumber?: string
  qty?: number | string
  quantity?: number | string
  traded_qty?: number | string
  buy_avg?: number | string
  buy_price?: number | string
  entry_price?: number | string
  sell_avg?: number | string
  sell_price?: number | string
  exit_price?: number | string
  realized_profit?: number | string
  pnl?: number | string
  net_pnl?: number | string
  symbol: string
  description?: string
  segment?: number
  exchange?: number
  entry_date?: string
  exit_date?: string
}

interface FyersPositionRecord {
  id?: string
  positionId?: string
  symbol: string
  segment?: number
  exchange?: number
  netQty?: number
  buyQty?: number
  sellQty?: number
  buyAvg?: number
  sellAvg?: number
  avgPrice?: number
  ltp?: number
  realized_profit?: number
  pl?: number
  side?: number
}
