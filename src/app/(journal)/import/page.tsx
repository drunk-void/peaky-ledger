'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getAccounts } from '@/utils/supabase/queries'
import { Account } from '@/types/journal'
import { Database, RefreshCw, Upload, CheckCircle2, AlertTriangle, Key } from 'lucide-react'
import Papa from 'papaparse'
import { createTrade } from '@/utils/supabase/queries'

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

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
      const response = await fetch(`/api/broker/sync?accountId=${selectedAccountId}&fromDate=2025-01-01&toDate=2025-12-31`)
      const resData = await response.json()
      
      if (response.ok) {
        setSyncMessage(`Successfully synced ${resData.syncedCount} new trades! 🎉`)
      } else {
        setSyncMessage(`Sync failed: ${resData.message || 'Check broker connection'}`)
      }
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message || 'API unreachable'}`)
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
          const rows = results.data as any[]
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
        } catch (err: any) {
          setImportMessage(`Import error: ${err.message}`)
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
            <label>Select Target Trading Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{ padding: '8px 12px' }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.broker})</option>
              ))}
            </select>
          </div>

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
