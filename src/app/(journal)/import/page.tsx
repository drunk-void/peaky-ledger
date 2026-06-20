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
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [isMapping, setIsMapping] = useState(false)
  const [mappings, setMappings] = useState<Record<string, string>>({
    symbol: '',
    side: '',
    quantity: '',
    entryPrice: '',
    exitPrice: '',
    entryTime: '',
    exitTime: '',
    fees: '',
    setup: '',
    notes: '',
  })

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

  // Helper for finding fuzzy mapping matches
  const findFuzzyMatch = (headers: string[], field: string): string => {
    const f = field.toLowerCase()
    const match = headers.find(h => {
      const hl = h.toLowerCase()
      return hl === f || 
             hl.replace(/[^a-z0-9]/g, '') === f ||
             hl.includes(f) || 
             (f === 'symbol' && hl.includes('ticker')) ||
             (f === 'quantity' && (hl.includes('qty') || hl.includes('size') || hl.includes('shares') || hl.includes('volume'))) ||
             (f === 'entryprice' && (hl.includes('entry') || hl.includes('buy')) && hl.includes('price')) ||
             (f === 'exitprice' && (hl.includes('exit') || hl.includes('sell')) && hl.includes('price')) ||
             (f === 'entrytime' && (hl.includes('entry') || hl.includes('execution') || hl.includes('buy')) && (hl.includes('time') || hl.includes('date'))) ||
             (f === 'exittime' && (hl.includes('exit') || hl.includes('sell')) && (hl.includes('time') || hl.includes('date')))
    })
    return match || ''
  }

  // Handle CSV Import & mapping prep
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setCsvFile(file)
      setImportMessage('')
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || []
          setCsvHeaders(headers)
          setCsvRows(results.data as Record<string, string>[])
          
          // Pre-populate fuzzy matches
          setMappings({
            symbol: findFuzzyMatch(headers, 'symbol') || findFuzzyMatch(headers, 'ticker') || '',
            side: findFuzzyMatch(headers, 'side') || findFuzzyMatch(headers, 'action') || findFuzzyMatch(headers, 'direction') || findFuzzyMatch(headers, 'type') || '',
            quantity: findFuzzyMatch(headers, 'quantity') || findFuzzyMatch(headers, 'qty') || findFuzzyMatch(headers, 'size') || findFuzzyMatch(headers, 'shares') || '',
            entryPrice: findFuzzyMatch(headers, 'entryprice') || findFuzzyMatch(headers, 'price') || findFuzzyMatch(headers, 'buyprice') || '',
            exitPrice: findFuzzyMatch(headers, 'exitprice') || findFuzzyMatch(headers, 'sellprice') || '',
            entryTime: findFuzzyMatch(headers, 'entrytime') || findFuzzyMatch(headers, 'date') || findFuzzyMatch(headers, 'time') || '',
            exitTime: findFuzzyMatch(headers, 'exittime') || '',
            fees: findFuzzyMatch(headers, 'fees') || findFuzzyMatch(headers, 'commission') || findFuzzyMatch(headers, 'brokerage') || '',
            setup: findFuzzyMatch(headers, 'setup') || findFuzzyMatch(headers, 'strategy') || '',
            notes: findFuzzyMatch(headers, 'notes') || findFuzzyMatch(headers, 'comment') || '',
          })
          setIsMapping(true)
        },
        error: (error) => {
          setImportMessage(`Parsing error: ${error.message}`)
        }
      })
    }
  }

  const handleCsvImport = async () => {
    if (csvRows.length === 0 || !selectedAccountId) return
    setImporting(true)
    setImportMessage('')

    // Validate required mappings
    if (!mappings.symbol || !mappings.side || !mappings.quantity || !mappings.entryPrice || !mappings.entryTime) {
      setImportMessage('Error: Please map all required fields (Symbol, Side, Qty, Entry Price, Entry Date).')
      setImporting(false)
      return
    }

    try {
      let count = 0
      for (const row of csvRows) {
        const symbol = row[mappings.symbol]
        const sideVal = row[mappings.side]
        const quantity = row[mappings.quantity]
        const entryPrice = row[mappings.entryPrice]
        const entryTime = row[mappings.entryTime]

        if (!symbol || !sideVal || !quantity || !entryPrice || !entryTime) {
          continue
        }

        const exitPriceVal = mappings.exitPrice && row[mappings.exitPrice] ? Number(row[mappings.exitPrice]) : null
        const feesVal = mappings.fees && row[mappings.fees] ? Number(row[mappings.fees]) : 0
        const setupVal = mappings.setup && row[mappings.setup] ? row[mappings.setup] : null
        const notesVal = mappings.notes && row[mappings.notes] ? row[mappings.notes] : null
        const exitTimeVal = mappings.exitTime && row[mappings.exitTime] ? row[mappings.exitTime] : null

        // Normalise side
        let normalizedSide: 'LONG' | 'SHORT' = 'LONG'
        const sideLower = sideVal.toLowerCase()
        if (sideLower.includes('short') || sideLower.includes('sell') || sideLower.startsWith('s') || sideLower === '0') {
          normalizedSide = 'SHORT'
        }

        await createTrade({
          account_id: selectedAccountId,
          symbol: symbol.toUpperCase(),
          display_symbol: symbol.split(':').pop()?.toUpperCase() || symbol.toUpperCase(),
          asset_class: 'equity',
          side: normalizedSide,
          quantity: Number(quantity),
          entry_price: Number(entryPrice),
          exit_price: exitPriceVal,
          entry_time: new Date(entryTime).toISOString(),
          exit_time: exitTimeVal ? new Date(exitTimeVal).toISOString() : null,
          status: exitPriceVal ? 'CLOSED' : 'OPEN',
          gross_pnl: null,
          fees: Number(feesVal),
          net_pnl: null,
          currency: 'INR',
          strike_price: null,
          option_type: null,
          expiry_date: null,
          contract_multiplier: 1,
          setup: setupVal,
          notes: notesVal,
          satisfaction: null,
          plan_adherence: null,
          emotion: null,
          mfe_price: null,
          mae_price: null,
          r_multiple: null,
          duration_minutes: null,
          source: 'csv_import',
          external_trade_id: null,
          exchange: null,
        })
        count++
      }

      setImportMessage(`Successfully imported ${count} trades! 📊`)
      setIsMapping(false)
      setCsvFile(null)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown import error'
      setImportMessage(`Import error: ${errMsg}`)
    } finally {
      setImporting(false)
    }
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
                <option value="positions">Today's Positions</option>
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
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Universal CSV Import</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Map and import from ANY broker's ledger CSV</p>
            </div>
          </div>

          {isMapping ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Map CSV Columns to Trade Fields
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Symbol *</label>
                  <select
                    value={mappings.symbol}
                    onChange={(e) => setMappings({ ...mappings, symbol: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Side (Direction) *</label>
                  <select
                    value={mappings.side}
                    onChange={(e) => setMappings({ ...mappings, side: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Quantity *</label>
                  <select
                    value={mappings.quantity}
                    onChange={(e) => setMappings({ ...mappings, quantity: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Entry Price *</label>
                  <select
                    value={mappings.entryPrice}
                    onChange={(e) => setMappings({ ...mappings, entryPrice: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Exit Price</label>
                  <select
                    value={mappings.exitPrice}
                    onChange={(e) => setMappings({ ...mappings, exitPrice: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Entry Date & Time *</label>
                  <select
                    value={mappings.entryTime}
                    onChange={(e) => setMappings({ ...mappings, entryTime: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Exit Date & Time</label>
                  <select
                    value={mappings.exitTime}
                    onChange={(e) => setMappings({ ...mappings, exitTime: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Fees / Commission</label>
                  <select
                    value={mappings.fees}
                    onChange={(e) => setMappings({ ...mappings, fees: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Setup</label>
                  <select
                    value={mappings.setup}
                    onChange={(e) => setMappings({ ...mappings, setup: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Notes</label>
                  <select
                    value={mappings.notes}
                    onChange={(e) => setMappings({ ...mappings, notes: e.target.value })}
                    style={{ padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Button variant="secondary" onClick={() => { setIsMapping(false); setCsvFile(null); }} style={{ flex: 1 }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCsvImport} loading={importing} style={{ flex: 2 }}>
                  Import ({csvRows.length} trades)
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Upload any ledger CSV. On the next step you'll map columns like <strong>Symbol, Side, Quantity, EntryPrice</strong> to import your data correctly.
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
            </>
          )}

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
