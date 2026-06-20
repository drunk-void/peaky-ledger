'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getAccounts } from '@/utils/supabase/queries'
import { Account } from '@/types/journal'
import { Database, RefreshCw, Upload, CheckCircle2, AlertTriangle, Key } from 'lucide-react'
import Papa from 'papaparse'
import { createTrade } from '@/utils/supabase/queries'

function ImportPageContent() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [segmentType, setSegmentType] = useState('0')
  const [exchangeType, setExchangeType] = useState('0')
  const [syncMode, setSyncMode] = useState('trades')

  useEffect(() => {
    const fetchAccounts = async () => {
      const active = await getAccounts()
      setAccounts(active)
      if (active.length > 0) {
        setSelectedAccountId(active[0].id)
      }
    }
    fetchAccounts()
  }, [])

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    if (error) {
      setTimeout(() => setSyncMessage(error), 0)
    } else if (success) {
      setTimeout(() => setSyncMessage(success + ' 🎉'), 0)
    }
  }, [searchParams])

  // Sync Fyers API
  const handleFyersConnect = () => {
    // In a real flow, this redirects to the Fyers OAuth page
    // For demonstration and full-stack delivery, we redirect to our api which generates the fyers url
    window.location.href = `/api/broker/connect?accountId=${selectedAccountId}`
  }

  const handleSyncTrades = async () => {
    if (!selectedAccountId) return
    setSyncing(true)
    setSyncMessage('')

    try {
      const response = await fetch(`/api/broker/sync?accountId=${selectedAccountId}&fromDate=${fromDate}&toDate=${toDate}&segmentType=${segmentType}&exchangeType=${exchangeType}&syncMode=${syncMode}`)
      const resData = await response.json()
      
      if (response.ok) {
        setSyncMessage(`Successfully synced ${resData.syncedCount} new trades! 🎉`)
        const active = await getAccounts()
        setAccounts(active)
      } else {
        setSyncMessage(`Sync failed: ${resData.error || resData.message || 'Check broker connection'}`)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'API unreachable'
      setSyncMessage(`Sync error: ${errMsg}`)
    } finally {
      setSyncing(false)
    }
  }

  // Handle CSV Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleCsvImport = () => {
    if (!csvFile || !selectedAccountId) return
    setImporting(true)
    setImportMessage('')

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[]
          let count = 0

          for (const row of rows) {
            // Required CSV Format: Symbol, Side, Quantity, EntryPrice, ExitPrice, EntryTime, ExitTime, Fees
            if (!row.Symbol || !row.Side || !row.Quantity || !row.EntryPrice || !row.EntryTime) {
              continue
            }

            const exitPriceVal = row.ExitPrice ? Number(row.ExitPrice) : null

            await createTrade({
              account_id: selectedAccountId,
              symbol: row.Symbol,
              display_symbol: row.Symbol.split(':').pop() || row.Symbol,
              asset_class: 'equity',
              side: row.Side.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
              quantity: Number(row.Quantity),
              entry_price: Number(row.EntryPrice),
              exit_price: exitPriceVal,
              entry_time: new Date(row.EntryTime).toISOString(),
              exit_time: row.ExitTime ? new Date(row.ExitTime).toISOString() : null,
              status: exitPriceVal ? 'CLOSED' : 'OPEN',
              gross_pnl: null,
              fees: row.Fees ? Number(row.Fees) : 0,
              net_pnl: null,
              currency: 'INR',
              strike_price: null,
              option_type: null,
              expiry_date: null,
              contract_multiplier: 1,
              setup: row.Setup || null,
              notes: row.Notes || null,
              satisfaction: null,
              plan_adherence: null,
              emotion: null,
              mfe_price: null,
              mae_price: null,
              r_multiple: null,
              duration_minutes: null,
              source: 'csv_import',
              external_trade_id: row.TradeId || null,
              exchange: null,
            })
            count++
          }

          setImportMessage(`Successfully imported ${count} trades! 📊`)
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown import error'
          setImportMessage(`Import error: ${errMsg}`)
        } finally {
          setImporting(false)
          setCsvFile(null)
        }
      },
      error: (error) => {
        setImportMessage(`Parsing error: ${error.message}`)
        setImporting(false)
      }
    })
  }

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId)
  const connection = selectedAccount?.broker_connections?.[0]
  const syncStatus = connection?.sync_status || 'disconnected'
  const lastSyncAt = connection?.last_sync_at

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          color: 'var(--success, #10b981)',
          label: 'Connected',
          icon: <CheckCircle2 size={14} style={{ color: 'var(--success, #10b981)' }} />
        }
      case 'expired':
        return {
          color: '#f59e0b',
          label: 'Session Expired',
          icon: <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
        }
      case 'error':
        return {
          color: 'var(--danger, #ef4444)',
          label: 'Sync Error',
          icon: <AlertTriangle size={14} style={{ color: 'var(--danger, #ef4444)' }} />
        }
      default:
        return {
          color: 'var(--text-muted, #9ca3af)',
          label: 'Not Connected',
          icon: <Database size={14} style={{ color: 'var(--text-muted, #9ca3af)' }} />
        }
    }
  }

  const statusConfig = getStatusConfig(syncStatus)

  const formatLastSync = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Sync & Import</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Automatically sync your trades from Fyers or import them via CSV
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Fyers Connection */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', padding: '10px', borderRadius: '8px' }}>
              <Key size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Broker API Connection</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fyers API Integration v3</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>Select Target Trading Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.broker})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Sync Mode</label>
              <select value={syncMode} onChange={(e) => setSyncMode(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                <option value="trades">Trade Fills History</option>
                <option value="pnl">Realised P&L History</option>
                <option value="positions">Today&apos;s Positions</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Segment Type</label>
              <select value={segmentType} onChange={(e) => setSegmentType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                <option value="0">All Segments (0)</option>
                <option value="10">Equity (10)</option>
                <option value="11">F&O (11)</option>
                <option value="12">Currency (12)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Exchange</label>
              <select value={exchangeType} onChange={(e) => setExchangeType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                <option value="0">All Exchanges (0)</option>
                <option value="10">NSE (10)</option>
                <option value="12">BSE (12)</option>
                <option value="11">MCX (11)</option>
              </select>
            </div>
          </div>

          {selectedAccount && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 12px', 
              backgroundColor: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.02))', 
              borderRadius: '6px', 
              border: '1px solid var(--border-color, rgba(0, 0, 0, 0.05))',
              fontSize: '13px',
              marginTop: '-4px'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontWeight: 600, 
                color: statusConfig.color 
              }}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
              {lastSyncAt && (
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 'auto' }}>
                  Synced: {formatLastSync(lastSyncAt)}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="primary" onClick={handleFyersConnect} style={{ flex: 1 }}>
              Authorize Fyers
            </Button>
            <Button variant="secondary" onClick={handleSyncTrades} loading={syncing} style={{ flex: 1 }}>
              <RefreshCw size={16} />
              <span>Sync Trades</span>
            </Button>
          </div>

          {syncMessage && (
            <div style={{ fontSize: '14px', fontWeight: 600, color: syncMessage.includes('Successfully') ? 'var(--success)' : 'var(--danger)', marginTop: '8px' }}>
              {syncMessage}
            </div>
          )}
        </Card>

        {/* CSV Import */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '10px', borderRadius: '8px' }}>
              <Upload size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>CSV Trade Import</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Import from generic ledger sheets</p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Upload a CSV containing your trade ledger. Columns required:
            <code style={{ display: 'block', backgroundColor: 'var(--bg-surface-hover)', padding: '6px 10px', borderRadius: '4px', marginTop: '6px', fontSize: '11px' }}>
              Symbol, Side, Quantity, EntryPrice, ExitPrice, EntryTime, ExitTime, Fees, Setup, Notes
            </code>
          </p>

          <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {csvFile ? csvFile.name : 'Click to select CSV file'}
              </div>
            </label>
          </div>

          <Button variant="primary" onClick={handleCsvImport} loading={importing} disabled={!csvFile} style={{ width: '100%' }}>
            Process Import
          </Button>

          {importMessage && (
            <div style={{ fontSize: '14px', fontWeight: 600, color: importMessage.includes('Successfully') ? 'var(--success)' : 'var(--danger)', marginTop: '8px' }}>
              {importMessage}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ImportPageContent />
    </Suspense>
  )
}
