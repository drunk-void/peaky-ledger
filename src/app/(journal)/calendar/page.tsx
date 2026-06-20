'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { getTrades, getDiaryEntry } from '@/utils/supabase/queries'
import { Trade, DiaryEntry } from '@/types/journal'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  getDay 
} from 'date-fns'
import { ChevronLeft, ChevronRight, BookOpen, Calendar as CalendarIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { useCurrency } from '@/utils/useCurrency'

export default function CalendarPage() {
  const { formatAmount, rates, preferredCurrency } = useCurrency()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedDayDiary, setSelectedDayDiary] = useState<DiaryEntry | null>(null)

  // Fetch trades for the past 12 months
  useEffect(() => {
    const fetchYearTrades = async () => {
      try {
        const fromDateStr = format(startOfMonth(subMonths(currentMonth, 11)), 'yyyy-MM-dd')
        const toDateStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
        
        const fetched = await getTrades({
          fromDate: fromDateStr,
          toDate: toDateStr,
        })
        setTrades(fetched)
      } catch (err) {
        console.error(err)
      }
    }

    fetchYearTrades()
  }, [currentMonth])

  // Update selected day diary
  useEffect(() => {
    if (!selectedDate) return

    const fetchDiary = async () => {
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const diary = await getDiaryEntry(dateStr)
        setSelectedDayDiary(diary)
      } catch (err) {
        console.error(err)
      }
    }
    fetchDiary()
  }, [selectedDate])

  const convertedTrades = trades.map((t) => {
    const rate = rates[(t.currency || 'INR').toUpperCase()] !== undefined ? rates[(t.currency || 'INR').toUpperCase()] : 1
    return {
      ...t,
      net_pnl: t.net_pnl !== null ? t.net_pnl * rate : null,
      currency: preferredCurrency
    }
  })

  const selectedDayTrades = selectedDate
    ? convertedTrades.filter((t) => t.entry_time && isSameDay(new Date(t.entry_time), selectedDate))
    : []

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)

  // Construct 12-month calendar heatmap
  const yearStart = subMonths(currentMonth, 11)
  const startInterval = startOfMonth(yearStart)
  const endInterval = endOfMonth(currentMonth)
  const allDays = eachDayOfInterval({ start: startInterval, end: endInterval })

  // Find max daily win/loss in the 12-month period for scaling
  let maxDayWin = 0
  let maxDayLoss = 0
  
  const dailyTotals: { [key: string]: number } = {}
  convertedTrades.forEach((t) => {
    if (!t.entry_time) return
    const dateStr = format(new Date(t.entry_time), 'yyyy-MM-dd')
    dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + (t.net_pnl || 0)
  })
  
  Object.values(dailyTotals).forEach((val) => {
    if (val > maxDayWin) maxDayWin = val
    if (val < maxDayLoss) maxDayLoss = val
  })

  // Group days into weeks (Sunday to Saturday columns)
  const weeks: (Date | null)[][] = []
  let currentWeek: (Date | null)[] = Array(7).fill(null)
  
  allDays.forEach((day) => {
    const dayOfWeek = getDay(day)
    currentWeek[dayOfWeek] = day
    if (dayOfWeek === 6 || day === allDays[allDays.length - 1]) {
      weeks.push(currentWeek)
      currentWeek = Array(7).fill(null)
    }
  })

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Calendar</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Monitor your consistency, wins, and losses on a monthly roadmap
        </p>
      </div>

      {/* Heatmap Card */}
      <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Consistency Heatmap (Past 12 Months)</h3>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', backgroundColor: 'var(--danger)', opacity: 0.8, borderRadius: '2px' }} /> Loss</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', backgroundColor: 'var(--border-color)', opacity: 0.15, borderRadius: '2px' }} /> No Trades</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', backgroundColor: 'var(--success)', opacity: 0.8, borderRadius: '2px' }} /> Win</span>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', gap: '3px', padding: '4px 0', minWidth: '700px' }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {week.map((day, dayIdx) => {
                  if (!day) return <div key={dayIdx} style={{ width: '11px', height: '11px', backgroundColor: 'transparent' }} />
                  
                  const dayTrades = convertedTrades.filter((t) => t.entry_time && isSameDay(new Date(t.entry_time), day))
                  const dayNetPnL = dayTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0)
                  const isTradeDay = dayTrades.length > 0
                  
                  let cellBg = 'var(--border-color)'
                  let cellOpacity = 0.15
                  if (isTradeDay) {
                    if (dayNetPnL > 0) {
                      cellBg = 'var(--success)'
                      cellOpacity = maxDayWin > 0 ? 0.3 + (dayNetPnL / maxDayWin) * 0.7 : 0.6
                    } else if (dayNetPnL < 0) {
                      cellBg = 'var(--danger)'
                      cellOpacity = maxDayLoss < 0 ? 0.3 + (dayNetPnL / maxDayLoss) * 0.7 : 0.6
                    } else {
                      cellBg = 'var(--text-muted)'
                      cellOpacity = 0.5
                    }
                  }

                  const titleText = `${format(day, 'dd MMM yyyy')}: ${
                    isTradeDay 
                      ? `${dayNetPnL >= 0 ? '+' : ''}${formatAmount(dayNetPnL, preferredCurrency)} (${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''})` 
                      : 'No trades'
                  }`

                  return (
                    <button
                      key={day.toISOString()}
                      title={titleText}
                      onClick={() => setSelectedDate(day)}
                      style={{
                        width: '11px',
                        height: '11px',
                        backgroundColor: cellBg,
                        opacity: cellOpacity,
                        borderRadius: '2px',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.zIndex = '10'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
        
        {/* Calendar Core Grid */}
        <Card style={{ padding: '24px' }}>
          {/* Month Navigator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handlePrevMonth} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={handleNextMonth} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 600, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', minHeight: '320px' }}>
            {/* Pad preceding empty days */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} style={{ border: '1px solid transparent' }} />
            ))}

            {/* Render actual days */}
            {daysInMonth.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayTrades = convertedTrades.filter((t) => t.entry_time && isSameDay(new Date(t.entry_time), day))
              
              // Calculate day P&L
              const dayNetPnL = dayTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0)
              const isTradeDay = dayTrades.length > 0
              const isProfit = dayNetPnL >= 0

              let bgStyle = 'var(--bg-surface)'
              if (isTradeDay) {
                bgStyle = isProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
              }

              const isSelected = selectedDate && isSameDay(day, selectedDate)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  style={{
                    backgroundColor: bgStyle,
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    minHeight: '70px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {format(day, 'd')}
                  </span>
                  
                  {isTradeDay && (
                    <span className="font-mono" style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: isProfit ? 'var(--success)' : 'var(--danger)',
                      alignSelf: 'stretch',
                      textAlign: 'right'
                    }}>
                      {isProfit ? '+' : ''}{formatAmount(dayNetPnL, preferredCurrency)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Selected Day Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <CalendarIcon size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'}
              </h3>
            </div>

            {selectedDayTrades.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                No trades logged on this day.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                {selectedDayTrades.map((t) => {
                  const isProfit = (t.net_pnl ?? 0) >= 0
                  return (
                    <div 
                      key={t.id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.display_symbol || t.symbol}</span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.side}</span>
                      </div>
                      <span className="font-mono" style={{ fontWeight: 700, color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
                        {isProfit ? '+' : ''}{formatAmount(Number(t.net_pnl), t.currency)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Day Diary Snapshot */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BookOpen size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Mindset & Reflections</h3>
            </div>

            {selectedDayDiary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedDayDiary.mood && <Badge variant="primary">Mood: {selectedDayDiary.mood}</Badge>}
                  {selectedDayDiary.day_rating && <Badge variant="success">Rating: {selectedDayDiary.day_rating}/5</Badge>}
                </div>
                <div 
                  style={{ fontSize: '13px', color: 'var(--text-secondary)', maxHeight: '120px', overflow: 'hidden' }}
                  dangerouslySetInnerHTML={{ __html: selectedDayDiary.content || '' }}
                />
                <Link href={`/diary?date=${format(selectedDate || new Date(), 'yyyy-MM-dd')}`} style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', marginTop: '8px', display: 'inline-block' }}>
                  Edit Diary Entry →
                </Link>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>
                  No journal notes recorded for this date.
                </p>
                <Link href="/diary" style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                  Write entry now →
                </Link>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}
