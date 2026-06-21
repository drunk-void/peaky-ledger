'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getAccounts, createAccount, getTrades, getCommissionRules, createCommissionRule, deleteCommissionRule, archiveAccount, restoreAccount, deleteAccount, getArchivedAccounts } from '@/utils/supabase/queries'
import { createClient } from '@/utils/supabase/client'
import { Account, BrokerType, CommissionRule, CommissionCalcType } from '@/types/journal'
import { Settings, Plus, Download, User, Wallet, Trash2, Archive, RotateCcw, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useCurrency } from '@/utils/useCurrency'
import { formatCurrency } from '@/utils/currency'
import { useJournalStore } from '@/store/useJournalStore'
import Papa from 'papaparse'

interface ProfileState {
  display_name: string
  default_currency: string
  email?: string
}

export default function SettingsPage() {
  const { preferredCurrency } = useCurrency()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([])
  const [profile, setProfile] = useState<ProfileState>({ display_name: '', default_currency: 'INR' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)

  // Password / Security state
  const [hasPassword, setHasPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Commission Rules state
  const [selectedRuleAccountId, setSelectedRuleAccountId] = useState('')
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [ruleLabel, setRuleLabel] = useState('')
  const [ruleCalcType, setRuleCalcType] = useState<CommissionCalcType>('percent_of_turnover')
  const [ruleValue, setRuleValue] = useState(0)
  const [ruleAppliesTo, setRuleAppliesTo] = useState<string[]>([])
  const [loadingRules, setLoadingRules] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)

  // Account form
  const [accName, setAccName] = useState('')
  const [accBroker, setAccBroker] = useState<BrokerType>('manual')
  const [accBalance, setAccBalance] = useState(100000)
  const [accCurrency, setAccCurrency] = useState('INR')

  const supabase = createClient()

  const loadRules = React.useCallback(async (accountId: string) => {
    if (!accountId) return
    setLoadingRules(true)
    try {
      const activeRules = await getCommissionRules(accountId)
      setRules(activeRules)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRules(false)
    }
  }, [])

  useEffect(() => {
    if (selectedRuleAccountId) {
      Promise.resolve().then(() => {
        loadRules(selectedRuleAccountId)
      })
    }
  }, [selectedRuleAccountId, loadRules])

  const loadData = React.useCallback(async () => {
    try {
      const activeAccounts = await getAccounts()
      setAccounts(activeAccounts)
      if (activeAccounts.length > 0) {
        setSelectedRuleAccountId((prev) => prev || activeAccounts[0].id)
      }

      const archived = await getArchivedAccounts()
      setArchivedAccounts(archived)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setProfile({
          display_name: user.user_metadata?.full_name || '',
          default_currency: user.user_metadata?.default_currency || 'INR',
          email: user.email,
        })
        setHasPassword(user.app_metadata?.providers?.includes('email') || false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData()
    })
  }, [loadData])

  const handleArchiveAccount = async (id: string) => {
    if (!confirm('Are you sure you want to archive this account? You can restore it later.')) return
    try {
      await archiveAccount(id)
      loadData()
    } catch (err) {
      console.error(err)
      alert('Failed to archive account.')
    }
  }

  const handleRestoreAccount = async (id: string) => {
    try {
      await restoreAccount(id)
      loadData()
    } catch (err) {
      console.error(err)
      alert('Failed to restore account.')
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this account? This action CANNOT be undone.')) return
    try {
      await deleteAccount(id)
      loadData()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Delete failed'
      alert(errMsg)
    }
  }

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleLabel.trim() || !selectedRuleAccountId) return
    setCreatingRule(true)
    try {
      await createCommissionRule({
        account_id: selectedRuleAccountId,
        label: ruleLabel,
        calc_type: ruleCalcType,
        value: ruleValue,
        applies_to: ruleAppliesTo,
        is_active: true,
      })
      setRuleLabel('')
      setRuleValue(0)
      setRuleAppliesTo([])
      loadRules(selectedRuleAccountId)
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingRule(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    try {
      await deleteCommissionRule(id)
      loadRules(selectedRuleAccountId)
    } catch (err) {
      console.error(err)
    }
  }

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
      
      // Update state in journal store
      useJournalStore.getState().setPreferredCurrency(profile.default_currency)
      
      alert('Profile updated successfully!')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Error updating profile: ${errMsg}`)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.')
      setSavingPassword(false)
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match.')
      setSavingPassword(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      if (error) throw error

      setPasswordSuccess(hasPassword ? 'Password updated successfully!' : 'Password created successfully!')
      setNewPassword('')
      setConfirmNewPassword('')
      
      // Reload user data to update the hasPassword status
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setHasPassword(user.app_metadata?.providers?.includes('email') || false)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setPasswordError(`Error saving password: ${errMsg}`)
    } finally {
      setSavingPassword(false)
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Export failed: ${errMsg}`)
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

        {/* Security Settings */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Lock size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
              {hasPassword ? 'Change Password' : 'Create Password'}
            </h3>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {hasPassword
              ? 'Change the password used to sign in to your email account.'
              : 'You currently sign in via Google OAuth. Set a password to enable logging in directly with your email.'}
          </p>

          {passwordError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '10px 12px',
                color: 'var(--danger)',
                fontSize: '12px',
              }}
            >
              <AlertCircle size={14} />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                padding: '10px 12px',
                color: 'var(--success)',
                fontSize: '12px',
              }}
            >
              <CheckCircle2 size={14} />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              id="new_password"
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Input
              id="confirm_new_password"
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Button type="submit" variant="primary" loading={savingPassword} style={{ marginTop: '8px' }}>
              {hasPassword ? 'Update Password' : 'Set Password'}
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
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.broker.toUpperCase()} • {formatCurrency(acc.starting_balance, acc.currency)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleArchiveAccount(acc.id)}
                    title="Archive Account"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    title="Delete Account"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Archived Accounts List */}
          {archivedAccounts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Archived Accounts</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                {archivedAccounts.map((acc) => (
                  <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px', opacity: 0.6 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{acc.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.broker.toUpperCase()} • {formatCurrency(acc.starting_balance, acc.currency)}</div>
                    </div>
                    <button
                      onClick={() => handleRestoreAccount(acc.id)}
                      title="Restore Account"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Add Trading Account</h4>
            
            <Input
              id="accName"
              placeholder="e.g. Fyers F&O"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
              <Select
                id="accCurrency"
                value={accCurrency}
                onChange={(e) => setAccCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'INR' },
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' }
                ]}
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

        {/* Commission Rules */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Settings size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Commission Rules</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Select Trading Account</label>
            <select
              value={selectedRuleAccountId}
              onChange={(e) => setSelectedRuleAccountId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.broker})
                </option>
              ))}
            </select>
          </div>

          {/* Existing Rules List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {loadingRules ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading rules...</div>
            ) : rules.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No rules set for this account.</div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{rule.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {rule.calc_type === 'percent_of_turnover' ? `${rule.value}% of Turnover` : rule.calc_type === 'flat_per_trade' ? `${formatCurrency(rule.value, preferredCurrency)} Flat` : `${formatCurrency(rule.value, preferredCurrency)}/unit`}
                      {rule.applies_to.length > 0 && ` • Applies to: ${rule.applies_to.join(', ')}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAddRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Add Commission Rule</h4>
            
            <Input
              id="ruleLabel"
              placeholder="e.g. Brokerage / GST"
              value={ruleLabel}
              onChange={(e) => setRuleLabel(e.target.value)}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                id="ruleCalcType"
                value={ruleCalcType}
                onChange={(e) => setRuleCalcType(e.target.value as CommissionCalcType)}
                options={[
                  { value: 'percent_of_turnover', label: '% Turnover' },
                  { value: 'flat_per_trade', label: 'Flat Fee' },
                  { value: 'per_unit', label: 'Per Unit' }
                ]}
              />
              <Input
                id="ruleValue"
                type="number"
                step="0.000001"
                value={ruleValue}
                onChange={(e) => setRuleValue(Number(e.target.value))}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Applies To (Asset Classes)</span>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {['equity', 'futures', 'options', 'forex'].map((ac) => (
                  <label key={ac} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ruleAppliesTo.includes(ac)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRuleAppliesTo([...ruleAppliesTo, ac])
                        } else {
                          setRuleAppliesTo(ruleAppliesTo.filter((x) => x !== ac))
                        }
                      }}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{ac}</span>
                  </label>
                ))}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>*Leave unchecked to apply to all asset classes.</span>
            </div>

            <Button type="submit" variant="secondary" loading={creatingRule}>
              <Plus size={14} />
              <span>Add Rule</span>
            </Button>
          </form>
        </Card>

      </div>
    </div>
  )
}
