'use client'

import React, { useEffect, useState } from 'react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useJournalStore } from '@/store/useJournalStore'
import { createClient } from '@/utils/supabase/client'
import { Account } from '@/types/journal'
import { User, Wallet } from 'lucide-react'

export const Header = () => {
  const { selectedAccountId, setSelectedAccountId, preferredCurrency, setPreferredCurrency } = useJournalStore()
  const [accounts, setAccounts] = useState<Pick<Account, 'id' | 'name' | 'broker'>[]>([])
  const [userName, setUserName] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const fetchUserDataAndAccounts = async () => {
      // Fetch current profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader')
        if (user.user_metadata?.default_currency) {
          setPreferredCurrency(user.user_metadata.default_currency)
        }
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
  }, [supabase, setPreferredCurrency])

  return (
    <header
      style={{
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-app)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        marginLeft: '260px', // space for fixed Sidebar
      }}
    >
      {/* Account Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Wallet size={16} style={{ color: 'var(--text-secondary)' }} />
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-input, 4px)',
            fontSize: '13.5px',
            fontWeight: 500,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            width: '180px',
            outline: 'none',
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
        <select
          value={preferredCurrency}
          onChange={async (e) => {
            const val = e.target.value
            setPreferredCurrency(val)
            try {
              await supabase.auth.updateUser({
                data: { default_currency: val }
              })
            } catch (err) {
              console.error('Failed to update user profile default_currency:', err)
            }
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-input, 4px)',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="INR">INR (₹)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
        </select>

        <ThemeToggle />
        
        {/* User Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-input, 4px)',
              backgroundColor: 'var(--bg-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <User size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>
              {userName}
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Premium Account
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
