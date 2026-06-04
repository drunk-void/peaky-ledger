'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getAccounts, createAccount, getTrades } from '@/utils/supabase/queries'
import { createClient } from '@/utils/supabase/client'
import { Account, BrokerType } from '@/types/journal'
import { Settings, Plus, Download, Trash, User, Wallet } from 'lucide-react'
import Papa from 'papaparse'

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profile, setProfile] = useState<any>({ display_name: '', default_currency: 'INR' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)

  // Account form
  const [accName, setAccName] = useState('')
  const [accBroker, setAccBroker] = useState<BrokerType>('manual')
  const [accBalance, setAccBalance] = useState(100000)
  const [accCurrency, setAccCurrency] = useState('INR')

  const supabase = createClient()

  const loadData = async () => {
    setLoading(true)
    try {
      const activeAccounts = await getAccounts()
      setAccounts(activeAccounts)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setProfile({
          display_name: user.user_metadata?.full_name || '',
          default_currency: user.user_metadata?.default_currency || 'INR',
          email: user.email,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.display_name,
          default_currency: profile.default_currency,
        }
      })
      if (error) throw error
      alert('Profile updated successfully!')
    } catch (err: any) {
      alert(`Error updating profile: ${err.message}`)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accName.trim()) return
    setCreatingAccount(true)
    try {
      await createAccount({
        name: accName,
        broker: accBroker,
        account_id: accBroker === 'manual' ? 'MANUAL' : '',
        starting_balance: accBalance,
        currency: accCurrency,
        is_active: true,
      })
      setAccName('')
      setAccBalance(100000)
      loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingAccount(false)
    }
  }

  const handleExportTrades = async () => {
    try {
      const trades = await getTrades()
      if (trades.length === 0) {
        alert('No trades available to export')
        return
      }

      // Convert trades JSON array to CSV format
      const csv = Papa.unparse(trades.map((t) => ({
        Id: t.id,
        Symbol: t.symbol,
        AssetClass: t.asset_class,
        Side: t.side,
        Quantity: t.quantity,
        EntryPrice: t.entry_price,
        ExitPrice: t.exit_price || 'Open',
        EntryTime: t.entry_time,
        ExitTime: t.exit_time || 'Open',
        GrossPnL: t.gross_pnl || 0,
        Fees: t.fees,
        NetPnL: t.net_pnl || 0,
        Currency: t.currency,
        Setup: t.setup || '',
        Notes: t.notes || '',
        Satisfaction: t.satisfaction || '',
        PlanAdherence: t.plan_adherence || '',
        Emotion: t.emotion || '',
      })))

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.setAttribute('download', `peaky_ledger_trades_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading ledger settings...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Configure user profile preferences, trading accounts, and export data
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Profile Settings */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <User size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Profile Settings</h3>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label>Email Address</label>
              <input type="text" value={profile.email || ''} disabled style={{ backgroundColor: 'var(--bg-surface-hover)' }} />
            </div>
            
            <Input
              id="display_name"
              label="Display Name"
              value={profile.display_name}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              required
            />

            <Select
              id="default_currency"
              label="Preferred Currency"
              value={profile.default_currency}
              onChange={(e) => setProfile({ ...profile, default_currency: e.target.value })}
              options={[
                { value: 'INR', label: 'INR (₹)' },
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' }
              ]}
            />

            <Button type="submit" variant="primary" loading={savingProfile} style={{ marginTop: '8px' }}>
              Save Profile Changes
            </Button>
          </form>
        </Card>

        {/* Manage Accounts */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Wallet size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Trading Accounts</h3>
          </div>

          {/* Accounts list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {accounts.map((acc) => (
              <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.broker.toUpperCase()} • ₹{acc.starting_balance.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Add Trading Account</h4>
            
            <Input
              id="accName"
              placeholder="e.g. Fyers F&O"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                id="accBroker"
                value={accBroker}
                onChange={(e) => setAccBroker(e.target.value as BrokerType)}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'fyers', label: 'Fyers' }
                ]}
              />
              <Input
                id="accBalance"
                type="number"
                value={accBalance}
                onChange={(e) => setAccBalance(Number(e.target.value))}
                required
              />
            </div>

            <Button type="submit" variant="secondary" loading={creatingAccount}>
              <Plus size={14} />
              <span>Create Account</span>
            </Button>
          </form>
        </Card>

        {/* Data Management */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifySelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Settings size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Data Portability</h3>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Export all recorded trades, setups, and notes as a unified CSV spreadsheet for backup or external spreadsheet analysis.
          </p>

          <Button type="button" variant="primary" onClick={handleExportTrades} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Download size={16} />
            <span>Export Trade Ledger (CSV)</span>
          </Button>
        </Card>

      </div>
    </div>
  )
}
