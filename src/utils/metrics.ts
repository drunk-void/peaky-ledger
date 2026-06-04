import { Trade } from '@/types/journal'
import { format } from 'date-fns'

export interface TradingMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  grossPnL: number
  fees: number
  netPnL: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  expectancy: number
  maxWin: number
  maxLoss: number
  equityCurve: { date: string; balance: number }[]
  dailyPnL: { date: string; pnl: number }[]
}

export function calculateMetrics(trades: Trade[], startingBalance: number = 100000): TradingMetrics {
  const closedTrades = trades.filter((t) => t.status === 'CLOSED' && t.net_pnl !== null)
  
  let grossPnL = 0
  let fees = 0
  let netPnL = 0
  let winningTrades = 0
  let losingTrades = 0
  let totalWinAmount = 0
  let totalLossAmount = 0
  let maxWin = 0
  let maxLoss = 0

  closedTrades.forEach((t) => {
    const net = t.net_pnl || 0
    const gross = t.gross_pnl || 0
    const fee = t.fees || 0

    grossPnL += gross
    fees += fee
    netPnL += net

    if (net > 0) {
      winningTrades++
      totalWinAmount += net
      if (net > maxWin) maxWin = net
    } else if (net < 0) {
      losingTrades++
      totalLossAmount += Math.abs(net)
      if (net < maxLoss) maxLoss = net
    }
  })

  const totalTrades = closedTrades.length
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0
  const avgWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0
  const avgLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0
  
  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const expectancy = totalTrades > 0 
    ? ((winningTrades / totalTrades) * avgWin) - ((losingTrades / totalTrades) * avgLoss) 
    : 0

  // Calculate daily P&L
  const dailyMap: Record<string, number> = {}
  closedTrades.forEach((t) => {
    const dateStr = format(new Date(t.entry_time), 'yyyy-MM-dd')
    dailyMap[dateStr] = (dailyMap[dateStr] || 0) + (t.net_pnl || 0)
  })

  const dailyPnL = Object.keys(dailyMap)
    .sort()
    .map((date) => ({
      date,
      pnl: dailyMap[date],
    }))

  // Calculate Equity Curve
  let runningBalance = startingBalance
  const equityCurve = [{ date: 'Start', balance: runningBalance }]
  
  // Sort trades chronologically to build equity curve
  const chronoTrades = [...closedTrades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  )

  chronoTrades.forEach((t) => {
    runningBalance += t.net_pnl || 0
    equityCurve.push({
      date: format(new Date(t.entry_time), 'dd MMM yyyy'),
      balance: runningBalance,
    })
  })

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    grossPnL,
    fees,
    netPnL,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    maxWin,
    maxLoss,
    equityCurve,
    dailyPnL,
  }
}
