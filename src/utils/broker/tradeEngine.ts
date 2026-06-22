import { Trade, AssetClass, TradeSide, CommissionRule } from '@/types/journal'
import { calculateCommission } from '@/utils/commission'

export interface ExecutionLeg {
  id: string
  symbol: string
  display_symbol: string
  asset_class: 'equity' | 'futures' | 'options' | 'forex'
  exchange: string
  side: 'LONG' | 'SHORT'
  quantity: number
  price: number
  timestamp: string // ISO
}

class ActiveTrade {
  entries: ExecutionLeg[] = []
  exits: ExecutionLeg[] = []

  constructor(public symbol: string) {}

  get side(): 'LONG' | 'SHORT' | null {
    if (this.entries.length === 0) return null
    return this.entries[0].side
  }

  get entryQuantity(): number {
    return this.entries.reduce((sum, e) => sum + e.quantity, 0)
  }

  get exitQuantity(): number {
    return this.exits.reduce((sum, e) => sum + e.quantity, 0)
  }

  get netQuantity(): number {
    return this.entryQuantity - this.exitQuantity
  }

  get averageEntryPrice(): number {
    if (this.entryQuantity === 0) return 0
    const totalValue = this.entries.reduce((sum, e) => sum + (e.price * e.quantity), 0)
    return totalValue / this.entryQuantity
  }

  get averageExitPrice(): number {
    if (this.exitQuantity === 0) return 0
    const totalValue = this.exits.reduce((sum, e) => sum + (e.price * e.quantity), 0)
    return totalValue / this.exitQuantity
  }
}

export class TradeEngine {
  /**
   * Transforms an array of chronological execution legs into aggregated Trade objects.
   * Assumes executions are pre-sorted chronologically.
   */
  static processExecutions(executions: ExecutionLeg[], commissionRules: CommissionRule[] = []): Partial<Trade>[] {
    // Group by symbol
    const groups: Record<string, ExecutionLeg[]> = {}
    for (const ex of executions) {
      if (!groups[ex.symbol]) groups[ex.symbol] = []
      groups[ex.symbol].push(ex)
    }

    const aggregatedTrades: Partial<Trade>[] = []

    for (const symbol in groups) {
      const legs = groups[symbol]
      let activeTrade = new ActiveTrade(symbol)

      for (const leg of legs) {
        if (!activeTrade.side || activeTrade.side === leg.side) {
          // Scale In
          activeTrade.entries.push(leg)
        } else {
          // Scale Out
          const legQty = leg.quantity
          const currentOpenQty = activeTrade.netQuantity

          if (legQty <= currentOpenQty) {
            // Full or partial exit, but no reversal
            activeTrade.exits.push(leg)
          } else {
            // Position reversal! (e.g. LONG 100, SELL 150)
            const closingQty = currentOpenQty
            const reversalQty = legQty - currentOpenQty

            // 1. Close the current trade
            if (closingQty > 0) {
              activeTrade.exits.push({
                ...leg,
                quantity: closingQty
              })
            }

            // Flush the closed trade
            aggregatedTrades.push(this.finalizeTrade(activeTrade, 'CLOSED', commissionRules))

            // 2. Start a new trade in opposite direction
            activeTrade = new ActiveTrade(symbol)
            activeTrade.entries.push({
              ...leg,
              quantity: reversalQty,
              id: `${leg.id}_rev` // distinguish the reversed leg ID
            })
            continue // skip the netQuantity check below since we already flushed
          }

          if (activeTrade.netQuantity === 0) {
            // Fully closed
            aggregatedTrades.push(this.finalizeTrade(activeTrade, 'CLOSED', commissionRules))
            activeTrade = new ActiveTrade(symbol)
          }
        }
      }

      // If any active trade remains at the end
      if (activeTrade.entryQuantity > 0) {
        aggregatedTrades.push(this.finalizeTrade(activeTrade, 'OPEN', commissionRules))
      }
    }

    return aggregatedTrades
  }

  private static finalizeTrade(active: ActiveTrade, status: 'CLOSED' | 'OPEN', commissionRules: CommissionRule[] = []): Partial<Trade> {
    const firstEntry = active.entries[0]
    const lastExit = active.exits.length > 0 ? active.exits[active.exits.length - 1] : null

    const entryPrice = active.averageEntryPrice
    const exitPrice = active.exitQuantity > 0 ? active.averageExitPrice : null
    
    // We only book PnL on the closed portion (exitQuantity)
    // If open, gross_pnl can be null, or unrealized (but here we just set to null/0 for closed portion)
    let grossPnl: number | null = null
    if (exitPrice !== null && active.side) {
      const multiplier = active.side === 'LONG' ? 1 : -1
      grossPnl = (exitPrice - entryPrice) * active.exitQuantity * multiplier
    }

    let fees = 0
    let feesAutoCalculated = false

    if (commissionRules.length > 0) {
      try {
        fees = calculateCommission(commissionRules, {
          entry_price: entryPrice,
          exit_price: exitPrice || 0,
          quantity: active.entryQuantity,
          asset_class: firstEntry.asset_class,
        })
        feesAutoCalculated = true
      } catch (e) {
        console.error('Failed to calculate auto commission in TradeEngine:', e)
      }
    }

    return {
      external_trade_id: `trade_${firstEntry.id}`,
      symbol: firstEntry.symbol,
      display_symbol: firstEntry.display_symbol,
      asset_class: firstEntry.asset_class,
      exchange: firstEntry.exchange,
      side: active.side!,
      quantity: active.entryQuantity, // Total entered quantity
      entry_price: entryPrice,
      exit_price: exitPrice,
      entry_time: firstEntry.timestamp,
      exit_time: lastExit ? lastExit.timestamp : null,
      status: status,
      gross_pnl: grossPnl,
      fees: fees,
      fees_auto_calculated: feesAutoCalculated,
      net_pnl: grossPnl !== null ? grossPnl - fees : null,
      source: 'fyers_api',
    }
  }
}
