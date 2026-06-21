'use client'

import React, { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'

type ThemeType = 'classic-light' | 'classic-dark' | 'cyber-light' | 'cyber-dark'

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<ThemeType>('classic-dark')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const activeTheme = (document.documentElement.getAttribute('data-theme') as ThemeType) || 'classic-dark'
      setTimeout(() => {
        setTheme(activeTheme)
      }, 0)
    }
  }, [])

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = e.target.value as ThemeType
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    localStorage.setItem('peaky-theme', nextTheme)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      <Palette size={16} style={{ color: 'var(--text-secondary)' }} />
      <select
        value={theme}
        onChange={handleThemeChange}
        style={{
          padding: '6px 10px',
          borderRadius: 'var(--radius-input, 4px)',
          fontSize: '13px',
          fontWeight: 500,
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          width: '135px',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '12px',
          paddingRight: '24px',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
      >
        <option value="classic-light">Notion Light</option>
        <option value="classic-dark">Notion Dark</option>
        <option value="cyber-light">Cyber Light</option>
        <option value="cyber-dark">Cyber Dark</option>
      </select>
    </div>
  )
}
