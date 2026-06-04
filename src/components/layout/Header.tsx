'use client'

import React, { useEffect, useState } from 'react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useJournalStore } from '@/store/useJournalStore'
import { createClient } from '@/utils/supabase/client'
import { User, Wallet } from 'lucide-react'

export const Header = () => {
  const { selectedAccountId, setSelectedAccountId } = useJournalStore()
  const [accounts, setAccounts] = useState<any[]>([])
  const [userName, setUserName] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const fetchUserDataAndAccounts = async () => {
      // Fetch current profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader')
      }

      // Fetch accounts
      const { data } = await supabase
        .from('accounts')
        .select('id, name, broker')
        .eq('is_active', true)
      
      if (data) {
        setAccounts(data)
      }
    }

    fetchUserDataAndAccounts()
  }, [supabase])

  return (
    <header
      className="glassmorphism"
      style={{
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        marginLeft: '260px', // space for fixed Sidebar
      }}
    >
      {/* Account Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Wallet size={18} style={{ color: 'var(--text-secondary)' }} />
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            width: '200px',
          }}
        >
          <option value="all">All Accounts</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.broker})
            </option>
          ))}
        </select>
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <ThemeToggle />
        
        {/* User Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <User size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {userName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Premium Account
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
