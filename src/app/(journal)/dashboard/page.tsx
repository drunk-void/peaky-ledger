'use client'

import React, { useEffect, useState } from 'react'
import { DateRangeFilter } from '@/components/layout/DateRangeFilter'
import { Card } from '@/components/ui/Card'
import { useJournalStore } from '@/store/useJournalStore'
import { getTrades, getAccounts } from '@/utils/supabase/queries'
import { calculateMetrics } from '@/utils/metrics'
import { Trade, Account } from '@/types/journal'
import { useCurrency } from '@/utils/useCurrency'
import { formatCurrency } from '@/utils/currency'
import { 
  TrendingUp, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign, 
  Activity, 
  Sparkles,
  ExternalLink
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'

export default function DashboardPage() {
  const { dateRange, selectedAccountId } = useJournalStore()
  const [closedTrades, setClosedTrades] = useState<Trade[]>([])
  const [openPositions, setOpenPositions] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const activeAccounts = await getAccounts()
        setAccounts(activeAccounts)

        // Query closed trades in the date range
        const closedTradesPromise = getTrades({
          accountId: selectedAccountId,
          fromDate: dateRange.from,
          toDate: dateRange.to,
          status: 'CLOSED',
        })

        // Query all open positions (no date range constraint)
        const openPositionsPromise = getTrades({
          accountId: selectedAccountId,
          status: 'OPEN',
        })

        const [fetchedClosed, fetchedOpen] = await Promise.all([
          closedTradesPromise,
          openPositionsPromise
        ])

        setClosedTrades(fetchedClosed)
        setOpenPositions(fetchedOpen)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [dateRange, selectedAccountId])

  const { preferredCurrency, currencySymbol, rates } = useCurrency()

  // Get active account starting balance
  const activeAccount = accounts.find((a) => a.id === selectedAccountId)
  const startingBalanceRaw = activeAccount ? Number(activeAccount.starting_balance) : 100000
  const startingBalanceCurrency = activeAccount ? activeAccount.currency : 'INR'
  const startingBalanceRate = rates[startingBalanceCurrency.toUpperCase()] !== undefined ? rates[startingBalanceCurrency.toUpperCase()] : 1
  const startingBalance = startingBalanceRaw * startingBalanceRate

  // Convert closed trades to preferred currency before calculating metrics
  const convertedClosedTrades = closedTrades.map((t) => {
    const rate = rates[(t.currency || 'INR').toUpperCase()] !== undefined ? rates[(t.currency || 'INR').toUpperCase()] : 1
    return {
      ...t,
      entry_price: t.entry_price * rate,
      exit_price: t.exit_price !== null ? t.exit_price * rate : null,
      gross_pnl: t.gross_pnl !== null ? t.gross_pnl * rate : null,
      fees: t.fees * rate,
      net_pnl: t.net_pnl !== null ? t.net_pnl * rate : null,
    }
  })

  // Convert open positions to preferred currency
  const convertedOpenPositions = openPositions.map((t) => {
    const rate = rates[(t.currency || 'INR').toUpperCase()] !== undefined ? rates[(t.currency || 'INR').toUpperCase()] : 1
    return {
      ...t,
      entry_price: t.entry_price * rate,
      exit_price: null,
      gross_pnl: null,
      fees: t.fees * rate,
      net_pnl: null,
    }
  })

  const metrics = calculateMetrics(convertedClosedTrades, startingBalance)

  const stats = [
    { 
      name: 'Net P&L', 
      value: formatCurrency(metrics.netPnL, preferredCurrency), 
      change: `Gross: ${formatCurrency(metrics.grossPnL, preferredCurrency)}`, 
      isPositive: metrics.netPnL >= 0, 
      icon: DollarSign 
    },
    { 
      name: 'Win Rate', 
      value: `${metrics.winRate.toFixed(1)}%`, 
      change: `${metrics.winningTrades} W - ${metrics.losingTrades} L`, 
      isPositive: metrics.winRate >= 50, 
      icon: Percent 
    },
    { 
      name: 'Profit Factor', 
      value: metrics.profitFactor === 999 ? '∞' : metrics.profitFactor.toFixed(2), 
      change: `Expectancy: ${formatCurrency(metrics.expectancy, preferredCurrency)}`, 
      isPositive: metrics.profitFactor >= 1.5, 
      icon: TrendingUp 
    },
    { 
      name: 'Total Trades', 
      value: metrics.totalTrades.toString(), 
      change: `Fees paid: ${formatCurrency(metrics.fees, preferredCurrency)}`, 
      isPositive: true, 
      icon: Activity 
    },
  ]

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading dashboard performance data...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Title & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Dashboard</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Performance insight based on {metrics.totalTrades} trades
          </p>
        </div>
        <DateRangeFilter />
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card 
              key={i} 
              hoverable 
              className="glow-hover" 
              style={{ 
                position: 'relative', 
                overflow: 'hidden',
                borderLeft: stat.name === 'Net P&L' 
                  ? `4px solid ${stat.isPositive ? 'var(--success)' : 'var(--danger)'}` 
                  : undefined
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {stat.name}
                </span>
                <div
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 className="font-mono" style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
                  {stat.value}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '13px' }}>
                  <span style={{ color: stat.isPositive ? 'var(--success)' : 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    {stat.isPositive ? <ArrowUpRight size={14} style={{ marginRight: '2px' }} /> : <ArrowDownRight size={14} style={{ marginRight: '2px' }} />}
                    {stat.change}
                  </span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', minHeight: '380px' }}>
        {/* Equity Curve */}
        <Card style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Equity Curve (Balance)</h3>
          <div style={{ flex: 1, minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tick={{ fontFamily: 'var(--font-mono)' }} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={11} 
                  tickLine={false} 
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                  tick={{ fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(v) => `${currencySymbol}${(v/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Daily P&L */}
        <Card style={{ display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Daily Net P&L</h3>
          <div style={{ flex: 1, minHeight: '280px' }}>
            {metrics.dailyPnL.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No daily data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.dailyPnL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={(v) => v.slice(5)} tick={{ fontFamily: 'var(--font-mono)' }} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} tick={{ fontFamily: 'var(--font-mono)' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  />
                  <Bar dataKey="pnl">
                    {metrics.dailyPnL.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} 
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Active Open Positions */}
      <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Active Open Positions</h3>
          </div>
          <a
            href="/trades?status=OPEN"
            style={{
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color var(--transition-fast)'
            }}
          >
            <span>Manage in Trade Log</span>
            <ExternalLink size={14} />
          </a>
        </div>

        {convertedOpenPositions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            No active open positions. Create one in the Trade Log.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', margin: '0 -24px -24px' }}>
            <table style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Symbol</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Side</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Qty</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Entry Price</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Est. Cost</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>Entry Date</th>
                </tr>
              </thead>
              <tbody>
                {convertedOpenPositions.map((pos) => {
                  const estCost = pos.quantity * pos.entry_price
                  return (
                    <tr key={pos.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', padding: '12px 24px' }}>
                        {pos.display_symbol || pos.symbol}
                        <div style={{ display: 'inline-block', marginLeft: '8px' }}>
                          <Badge variant="secondary" style={{ fontSize: '10px' }}>{pos.asset_class}</Badge>
                        </div>
                      </td>
                      <td style={{ padding: '12px 24px' }}>
                        <Badge variant={pos.side === 'LONG' ? 'success' : 'danger'}>
                          {pos.side}
                        </Badge>
                      </td>
                      <td className="font-mono" style={{ padding: '12px 24px' }}>{pos.quantity}</td>
                      <td className="font-mono" style={{ padding: '12px 24px' }}>
                        {formatCurrency(pos.entry_price, preferredCurrency)}
                      </td>
                      <td className="font-mono" style={{ padding: '12px 24px' }}>
                        {formatCurrency(estCost, preferredCurrency)}
                      </td>
                      <td className="font-mono" style={{ fontSize: '13px', padding: '12px 24px' }}>
                        {new Date(pos.entry_time).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Advanced Performance Stats */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Advanced Performance Metrics</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVERAGE WIN</span>
            <span className="font-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(metrics.avgWin, preferredCurrency)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVERAGE LOSS</span>
            <span className="font-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>
              {formatCurrency(metrics.avgLoss, preferredCurrency)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MAX WINNING TRADE</span>
            <span className="font-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(metrics.maxWin, preferredCurrency)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MAX LOSING TRADE</span>
            <span className="font-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>
              {formatCurrency(metrics.maxLoss, preferredCurrency)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
