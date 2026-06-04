'use client'

import React from 'react'
import { useJournalStore } from '@/store/useJournalStore'
import { subDays, format, startOfYear, startOfMonth } from 'date-fns'
import { Calendar } from 'lucide-react'

export const DateRangeFilter = () => {
  const { dateRange, setDateRange } = useJournalStore()

  const handlePresetChange = (preset: string) => {
    const today = new Date()
    let from = today

    switch (preset) {
      case 'today':
        from = today
        break
      case '7d':
        from = subDays(today, 7)
        break
      case '30d':
        from = subDays(today, 30)
        break
      case '90d':
        from = subDays(today, 90)
        break
      case 'ytd':
        from = startOfYear(today)
        break
      case 'mtd':
        from = startOfMonth(today)
        break
      default:
        return
    }

    setDateRange({
      from: format(from, 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd'),
    })
  }

  return (
    <div
      className="glassmorphism"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '12px',
        border: '1px solid var(--border-color)',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
        <Calendar size={16} />
        <span style={{ fontWeight: 500 }}>Timeframe:</span>
      </div>

      {/* Preset selections */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {[
          { label: '7D', value: '7d' },
          { label: '30D', value: '30d' },
          { label: '90D', value: '90d' },
          { label: 'MTD', value: 'mtd' },
          { label: 'YTD', value: 'ytd' },
        ].map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
            className="btn-ghost"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ borderLeft: '1px solid var(--border-color)', height: '16px' }} />

      {/* Custom range input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '2px',
            fontSize: '12px',
            fontWeight: 500,
            width: '115px',
          }}
        />
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '2px',
            fontSize: '12px',
            fontWeight: 500,
            width: '115px',
          }}
        />
      </div>
    </div>
  )
}
