'use client'

import React, { useEffect, useState } from 'react'
import { DateRangeFilter } from '@/components/layout/DateRangeFilter'
import { Card } from '@/components/ui/Card'
import { useJournalStore } from '@/store/useJournalStore'
import { getTrades, getAccounts } from '@/utils/supabase/queries'
import { calculateMetrics } from '@/utils/metrics'
import { Trade, Account } from '@/types/journal'
import { 
  TrendingUp, 
  Percent, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign, 
  Activity, 
  Sparkles,
  Layers
} from 'lucide-react'
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
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const activeAccounts = await getAccounts()
        setAccounts(activeAccounts)

        const fetchedTrades = await getTrades({
          accountId: selectedAccountId,
          fromDate: dateRange.from,
          toDate: dateRange.to,
        })
        setTrades(fetchedTrades)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [dateRange, selectedAccountId])

  // Get active account starting balance
  const activeAccount = accounts.find((a) => a.id === selectedAccountId)
  const startingBalance = activeAccount ? Number(activeAccount.starting_balance) : 100000

  const metrics = calculateMetrics(trades, startingBalance)

  const stats = [
    { 
      name: 'Net P&L', 
      value: `₹${metrics.netPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      change: `Gross: ₹${metrics.grossPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
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
      change: `Expectancy: ₹${metrics.expectancy.toFixed(0)}`, 
      isPositive: metrics.profitFactor >= 1.5, 
      icon: TrendingUp 
    },
    { 
      name: 'Total Trades', 
      value: metrics.totalTrades.toString(), 
      change: `Fees paid: ₹${metrics.fees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
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
            <Card key={i} hoverable className="glow-hover" style={{ position: 'relative', overflow: 'hidden' }}>
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
                <h3 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
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
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                  tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
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
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
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

      {/* Advanced Performance Stats */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Advanced Performance Metrics</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVERAGE WIN</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
              ₹{metrics.avgWin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVERAGE LOSS</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>
              ₹{metrics.avgLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MAX WINNING TRADE</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
              ₹{metrics.maxWin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MAX LOSING TRADE</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)' }}>
              ₹{metrics.maxLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
