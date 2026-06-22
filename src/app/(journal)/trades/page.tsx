'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Filter,
  TrendingUp,
  Download,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { getTrades, createTrade, updateTrade, deleteTrade, deleteTrades, getAccounts, getTags, createTag, createAccount, getCommissionRules } from '@/utils/supabase/queries'
import { Trade, Account, Tag, AssetClass, TradeSide, TradeEmotion, CommissionRule } from '@/types/journal'
import { calculateCommission } from '@/utils/commission'
import { useCurrency } from '@/utils/useCurrency'
import { format } from 'date-fns'
import ScreenshotUploader from '@/components/ui/ScreenshotUploader'
import { createClient } from '@/utils/supabase/client'
import { AgGridReact } from 'ag-grid-react'
import { themeQuartz, AllCommunityModule, ModuleRegistry, ColDef } from 'ag-grid-community'

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const peakyTheme = themeQuartz.withParams({
  accentColor: '#2383E2',
  backgroundColor: 'var(--bg-surface)',
  foregroundColor: 'var(--text-primary)',
  borderColor: 'var(--border-color)',
  headerBackgroundColor: 'var(--bg-surface)',
  oddRowBackgroundColor: 'rgba(0,0,0, 0.02)',
  rowBorder: '1px solid var(--border-color)',
  headerFontSize: 12,
});


export default function TradesPage() {
  const { formatAmount } = useCurrency()
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    fetchUser()
  }, [])
  
  // Filtering states
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [selectedAssetClass, setSelectedAssetClass] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedSide, setSelectedSide] = useState('ALL')
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([])

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  
  // Form states
  const [formAccountId, setFormAccountId] = useState('')
  const [formSymbol, setFormSymbol] = useState('')
  const [formAssetClass, setFormAssetClass] = useState<AssetClass>('equity')
  const [formSide, setFormSide] = useState<TradeSide>('LONG')
  const [formQuantity, setFormQuantity] = useState(1)
  const [formEntryPrice, setFormEntryPrice] = useState(0)
  const [formExitPrice, setFormExitPrice] = useState<number | ''>('')
  const [formEntryTime, setFormEntryTime] = useState('')
  const [formExitTime, setFormExitTime] = useState('')
  const [formFees, setFormFees] = useState(0)
  const [formSetup, setFormSetup] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formEmotion, setFormEmotion] = useState<TradeEmotion | ''>('')
  const [formSatisfaction, setFormSatisfaction] = useState<number | ''>('')
  const [formAdherence, setFormAdherence] = useState<number | ''>('')
  const [formSelectedTags, setFormSelectedTags] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  
  // Commission System states
  const [feesAutoCalculated, setFeesAutoCalculated] = useState(true)
  const [activeRules, setActiveRules] = useState<CommissionRule[]>([])
  
  // Loading & error states
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  // Fetch commission rules when formAccountId changes
  useEffect(() => {
    if (formAccountId) {
      const fetchRules = async () => {
        try {
          const rules = await getCommissionRules(formAccountId)
          setActiveRules(rules)
        } catch (e) {
          console.error(e)
        }
      }
      fetchRules()
    }
  }, [formAccountId])

  // Recalculate auto-commission when parameters change
  useEffect(() => {
    if (feesAutoCalculated) {
      const calcFees = calculateCommission(activeRules, {
        entry_price: formEntryPrice,
        exit_price: formExitPrice === '' ? null : Number(formExitPrice),
        quantity: formQuantity,
        asset_class: formAssetClass,
      })
      Promise.resolve().then(() => {
        setFormFees(calcFees)
      })
    }
  }, [feesAutoCalculated, activeRules, formEntryPrice, formExitPrice, formQuantity, formAssetClass])

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const activeAccounts = await getAccounts()
      setAccounts(activeAccounts)
      if (activeAccounts.length > 0) {
        setFormAccountId(activeAccounts[0].id)
      } else {
        // Create a default manual account if none exists
        const newAcc = await createAccount({
          name: 'Manual Account',
          broker: 'manual',
          account_id: 'MANUAL',
          starting_balance: 100000,
          currency: 'INR',
          is_active: true,
        })
        setAccounts([newAcc])
        setFormAccountId(newAcc.id)
      }

      const activeTags = await getTags()
      setTags(activeTags)

      const filters = {
        accountId: selectedAccount,
        assetClass: selectedAssetClass,
        status: selectedStatus,
        side: selectedSide,
      }
      const fetchedTrades = await getTrades(filters)
      setTrades(fetchedTrades)
      setSelectedTradeIds([])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedAccount, selectedAssetClass, selectedStatus, selectedSide])

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData()
    })
  }, [fetchData])

  const handleOpenAddModal = () => {
    // Reset Form
    setFormSymbol('')
    setFormAssetClass('equity')
    setFormSide('LONG')
    setFormQuantity(1)
    setFormEntryPrice(0)
    setFormExitPrice('')
    setFormEntryTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    setFormExitTime('')
    setFormFees(0)
    setFeesAutoCalculated(true)
    setFormSetup('')
    setFormNotes('')
    setFormEmotion('')
    setFormSatisfaction('')
    setFormAdherence('')
    setFormSelectedTags([])
    setIsAddModalOpen(true)
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      const created = await createTag({
        name: newTagName.trim(),
        group_name: 'Setups',
        color: '#6366f1'
      })
      setTags([...tags, created])
      setFormSelectedTags([...formSelectedTags, created.id])
      setNewTagName('')
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitLoading(true)
    try {
      const exitTimeVal = formExitTime ? new Date(formExitTime).toISOString() : null
      const exitPriceVal = formExitPrice === '' ? null : Number(formExitPrice)

      await createTrade({
        account_id: formAccountId,
        symbol: formSymbol,
        display_symbol: formSymbol.split(':').pop() || formSymbol,
        asset_class: formAssetClass,
        side: formSide,
        quantity: Number(formQuantity),
        entry_price: Number(formEntryPrice),
        exit_price: exitPriceVal,
        entry_time: new Date(formEntryTime).toISOString(),
        exit_time: exitTimeVal,
        status: exitPriceVal ? 'CLOSED' : 'OPEN',
        gross_pnl: null,
        fees: Number(formFees),
        fees_auto_calculated: feesAutoCalculated,
        net_pnl: null,
        currency: 'INR',
        strike_price: null,
        option_type: null,
        expiry_date: null,
        contract_multiplier: 1,
        setup: formSetup || null,
        notes: formNotes || null,
        satisfaction: formSatisfaction ? Number(formSatisfaction) : null,
        plan_adherence: formAdherence ? Number(formAdherence) : null,
        emotion: (formEmotion as TradeEmotion) || null,
        mfe_price: null,
        mae_price: null,
        r_multiple: null,
        duration_minutes: null,
        source: 'manual',
        external_trade_id: null,
        exchange: null,
      }, formSelectedTags)

      setIsAddModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleOpenEditModal = (trade: Trade) => {
    setSelectedTrade(trade)
    setFormAccountId(trade.account_id)
    setFormSymbol(trade.symbol)
    setFormAssetClass(trade.asset_class)
    setFormSide(trade.side)
    setFormQuantity(trade.quantity)
    setFormEntryPrice(trade.entry_price)
    setFormExitPrice(trade.exit_price ?? '')
    setFormEntryTime(format(new Date(trade.entry_time), "yyyy-MM-dd'T'HH:mm"))
    setFormExitTime(trade.exit_time ? format(new Date(trade.exit_time), "yyyy-MM-dd'T'HH:mm") : '')
    setFormFees(trade.fees)
    setFeesAutoCalculated(trade.fees_auto_calculated ?? false)
    setFormSetup(trade.setup ?? '')
    setFormNotes(trade.notes ?? '')
    setFormEmotion(trade.emotion ?? '')
    setFormSatisfaction(trade.satisfaction ?? '')
    setFormAdherence(trade.plan_adherence ?? '')
    setFormSelectedTags(trade.tags?.map((t) => t.id) || [])
    setIsEditModalOpen(true)
  }

  const handleEditTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrade) return
    setSubmitLoading(true)
    try {
      const exitTimeVal = formExitTime ? new Date(formExitTime).toISOString() : null
      const exitPriceVal = formExitPrice === '' ? null : Number(formExitPrice)

      let grossPnL = null
      let netPnL = null
      if (exitPriceVal) {
        const direction = formSide === 'LONG' ? 1 : -1
        grossPnL = (exitPriceVal - formEntryPrice) * formQuantity * direction
        netPnL = grossPnL - formFees
      }

      await updateTrade(selectedTrade.id, {
        account_id: formAccountId,
        symbol: formSymbol,
        display_symbol: formSymbol.split(':').pop() || formSymbol,
        asset_class: formAssetClass,
        side: formSide,
        quantity: Number(formQuantity),
        entry_price: Number(formEntryPrice),
        exit_price: exitPriceVal,
        entry_time: new Date(formEntryTime).toISOString(),
        exit_time: exitTimeVal,
        status: exitPriceVal ? 'CLOSED' : 'OPEN',
        gross_pnl: grossPnL,
        fees: Number(formFees),
        fees_auto_calculated: feesAutoCalculated,
        net_pnl: netPnL,
        setup: formSetup || null,
        notes: formNotes || null,
        satisfaction: formSatisfaction ? Number(formSatisfaction) : null,
        plan_adherence: formAdherence ? Number(formAdherence) : null,
        emotion: (formEmotion as TradeEmotion) || null,
      }, formSelectedTags)

      setIsEditModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteTrade = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) return
    try {
      await deleteTrade(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTradeIds.length === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedTradeIds.length} selected trade(s)?`)) return
    try {
      await deleteTrades(selectedTradeIds)
      setSelectedTradeIds([])
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExportCsv = () => {
    if (trades.length === 0) return
    
    const headers = [
      'Symbol',
      'Side',
      'Quantity',
      'EntryPrice',
      'ExitPrice',
      'EntryTime',
      'ExitTime',
      'NetPnL',
      'Fees',
      'AssetClass',
      'Setup',
      'Notes'
    ]
    
    const csvRows = trades.map((t) => [
      t.symbol,
      t.side,
      t.quantity,
      t.entry_price,
      t.exit_price ?? '',
      t.entry_time,
      t.exit_time ?? '',
      t.net_pnl ?? '',
      t.fees,
      t.asset_class,
      t.setup ?? '',
      (t.notes ?? '').replace(/"/g, '""')
    ])
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map((row) => row.map((val) => `"${val}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `peaky_ledger_trades_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // AG Grid setup
  const onSelectionChanged = useCallback((event: any) => {
    const selectedRows = event.api.getSelectedRows();
    setSelectedTradeIds(selectedRows.map((r: Trade) => r.id));
  }, []);

  const colDefs: ColDef<Trade>[] = React.useMemo(() => [
    {
      headerName: '',
      field: 'id',
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true,
    },
    {
      headerName: 'Symbol',
      field: 'symbol',
      filter: 'agTextColumnFilter',
      minWidth: 280,
      flex: 1,
      cellRenderer: (params: any) => {
        const trade = params.data
        if (!trade) return null;
        return (
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', paddingTop: '10px' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {trade.display_symbol || trade.symbol}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <Badge variant="secondary" style={{ fontSize: '10px' }}>{trade.asset_class}</Badge>
              {trade.tags?.map((t: any) => (
                <span 
                  key={t.id} 
                  style={{ 
                    fontSize: '10px', 
                    backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                    color: 'var(--primary)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 500
                  }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )
      }
    },
    {
      headerName: 'Side',
      field: 'side',
      filter: 'agTextColumnFilter',
      width: 100,
      cellRenderer: (params: any) => {
        const side = params.value
        if (!side) return null;
        return <Badge variant={side === 'LONG' ? 'primary' : 'danger'}>{side}</Badge>
      }
    },
    {
      headerName: 'Qty',
      field: 'quantity',
      filter: 'agNumberColumnFilter',
      width: 100,
      cellRenderer: (params: any) => <span className="font-mono">{params.value}</span>
    },
    {
      headerName: 'Entry Price',
      field: 'entry_price',
      filter: 'agNumberColumnFilter',
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <span className="font-mono">{formatAmount(Number(params.value), params.data.currency)}</span>
      }
    },
    {
      headerName: 'Exit Price',
      field: 'exit_price',
      filter: 'agNumberColumnFilter',
      width: 120,
      cellRenderer: (params: any) => {
        const val = params.value
        return <span className="font-mono">{val ? formatAmount(Number(val), params.data.currency) : '—'}</span>
      }
    },
    {
      headerName: 'Net P&L',
      field: 'net_pnl',
      filter: 'agNumberColumnFilter',
      width: 120,
      cellRenderer: (params: any) => {
        const trade = params.data
        if (!trade) return null;
        const isProfit = (trade.net_pnl ?? 0) >= 0
        return (
          <span className="font-mono" style={{ fontWeight: 600, color: trade.exit_price ? (isProfit ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
            {trade.exit_price ? `${isProfit ? '+' : ''}${formatAmount(Number(trade.net_pnl), trade.currency)}` : 'Open'}
          </span>
        )
      }
    },
    {
      headerName: 'Setup',
      field: 'setup',
      filter: 'agTextColumnFilter',
      width: 120,
      cellRenderer: (params: any) => <span style={{ fontSize: '13px' }}>{params.value || '—'}</span>
    },
    {
      headerName: 'Date',
      field: 'entry_time',
      filter: 'agDateColumnFilter',
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        return <span className="font-mono" style={{ fontSize: '13px' }}>{format(new Date(params.value), 'dd MMM yy')}</span>
      }
    },
    {
      headerName: 'Actions',
      width: 100,
      pinned: 'right',
      suppressMenu: true,
      cellRenderer: (params: any) => {
        const trade = params.data
        if (!trade) return null;
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', gap: '8px' }}>
              <button
                onClick={() => handleOpenEditModal(trade)}
                className="btn btn-ghost"
                style={{ padding: '6px', minWidth: 'auto', color: 'var(--text-secondary)' }}
              >
                <Edit3 size={15} />
              </button>
              <button
                onClick={() => handleDeleteTrade(trade.id)}
                className="btn btn-ghost"
                style={{ padding: '6px', minWidth: 'auto', color: 'var(--danger)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )
      }
    }
  ], [tags, accounts, formatAmount])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Trade Log</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Enter and manage all your trade entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {selectedTradeIds.length > 0 && (
            <Button variant="danger" onClick={handleBulkDelete} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={16} />
              <span>Delete {selectedTradeIds.length} Selected</span>
            </Button>
          )}
          <Button variant="secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={trades.length === 0}>
            <Download size={16} />
            <span>Export CSV</span>
          </Button>
          <Button variant="primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            <span>Add Trade</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: '16px 24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Filter size={16} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Filters:</span>
        </div>

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
        >
          <option value="all">All Accounts</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>{acc.name}</option>
          ))}
        </select>

        <select
          value={selectedAssetClass}
          onChange={(e) => setSelectedAssetClass(e.target.value)}
          style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
        >
          <option value="ALL">All Assets</option>
          <option value="equity">Equity</option>
          <option value="futures">Futures</option>
          <option value="options">Options</option>
          <option value="forex">Forex</option>
        </select>

        <select
          value={selectedSide}
          onChange={(e) => setSelectedSide(e.target.value)}
          style={{ width: '120px', padding: '6px 12px', fontSize: '13px' }}
        >
          <option value="ALL">All Sides</option>
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ width: '120px', padding: '6px 12px', fontSize: '13px' }}
        >
          <option value="ALL">All Status</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
      </Card>

      {/* Trades Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading trades...</div>
      ) : trades.length === 0 ? (
        <Card style={{ padding: '60px 24px', textAlign: 'center' }}>
          <TrendingUp size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', strokeWidth: 1.5 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No Trades Found</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Adjust your filters or add your first manual trade.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '100%', height: 'calc(100vh - 280px)' }}>
            <AgGridReact
              rowData={trades}
              columnDefs={colDefs}
              theme={peakyTheme}
              rowSelection="multiple"
              onSelectionChanged={onSelectionChanged}
              pagination={true}
              paginationPageSize={20}
              paginationPageSizeSelector={[10, 20, 50, 100]}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              rowHeight={64}
            />
          </div>
        </Card>
      )}

      {/* Add / Edit Modals */}
      <Modal isOpen={isAddModalOpen || isEditModalOpen} onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} title={isAddModalOpen ? 'Add New Trade' : 'Edit Trade'}>
        <form onSubmit={isAddModalOpen ? handleAddTradeSubmit : handleEditTradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Select
              id="formAccountId"
              label="Trading Account"
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
              options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
            />
            <Input
              id="formSymbol"
              label="Symbol (e.g., NSE:SBIN)"
              value={formSymbol}
              onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
              placeholder="NSE:SBIN"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Select
              id="formAssetClass"
              label="Asset Class"
              value={formAssetClass}
              onChange={(e) => setFormAssetClass(e.target.value as AssetClass)}
              options={[
                { value: 'equity', label: 'Equity (Stocks)' },
                { value: 'futures', label: 'Futures (F&O)' },
                { value: 'options', label: 'Options' },
                { value: 'forex', label: 'Forex' }
              ]}
            />
            <Select
              id="formSide"
              label="Direction"
              value={formSide}
              onChange={(e) => setFormSide(e.target.value as TradeSide)}
              options={[
                { value: 'LONG', label: 'Long (Buy)' },
                { value: 'SHORT', label: 'Short (Sell)' }
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Input
              id="formQuantity"
              label="Quantity"
              type="number"
              value={formQuantity}
              onChange={(e) => setFormQuantity(Number(e.target.value))}
              required
              min="0.0001"
              step="any"
            />
            <Input
              id="formEntryPrice"
              label="Entry Price"
              type="number"
              value={formEntryPrice}
              onChange={(e) => setFormEntryPrice(Number(e.target.value))}
              required
              min="0.0001"
              step="any"
            />
            <Input
              id="formExitPrice"
              label="Exit Price (Optional)"
              type="number"
              value={formExitPrice}
              onChange={(e) => setFormExitPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Open"
              step="any"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              id="formEntryTime"
              label="Entry Date & Time"
              type="datetime-local"
              value={formEntryTime}
              onChange={(e) => setFormEntryTime(e.target.value)}
              required
            />
            <Input
              id="formExitTime"
              label="Exit Date & Time"
              type="datetime-local"
              value={formExitTime}
              onChange={(e) => setFormExitTime(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Input
                id="formFees"
                label="Brokerage & Fees"
                type="number"
                value={formFees}
                onChange={(e) => {
                  setFormFees(Number(e.target.value))
                  setFeesAutoCalculated(false)
                }}
                min="0"
                step="any"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '-8px', padding: '0 4px' }}>
                {feesAutoCalculated ? (
                  <span style={{ color: 'var(--success)' }}>✓ Auto-calculated</span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>⚠ Manual override active</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const next = !feesAutoCalculated
                    setFeesAutoCalculated(next)
                    if (next) {
                      const calcFees = calculateCommission(activeRules, {
                        entry_price: formEntryPrice,
                        exit_price: formExitPrice === '' ? null : Number(formExitPrice),
                        quantity: formQuantity,
                        asset_class: formAssetClass,
                      })
                      setFormFees(calcFees)
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    fontSize: '11px'
                  }}
                >
                  {feesAutoCalculated ? 'Manual Override' : 'Reset to Auto'}
                </button>
              </div>
            </div>
            <Input
              id="formSetup"
              label="Setup Name"
              value={formSetup}
              onChange={(e) => setFormSetup(e.target.value)}
              placeholder="e.g. Breakout, Support Bounce"
            />
          </div>

          {/* Emotions & Psychology */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Select
              id="formEmotion"
              label="Emotion"
              value={formEmotion}
              onChange={(e) => setFormEmotion(e.target.value as TradeEmotion)}
              options={[
                { value: '', label: 'Select mood' },
                { value: 'calm', label: 'Calm' },
                { value: 'fomo', label: 'FOMO' },
                { value: 'revenge', label: 'Revenge' },
                { value: 'hesitation', label: 'Hesitation' },
                { value: 'greed', label: 'Greed' },
                { value: 'fear', label: 'Fear' }
              ]}
            />
            <Select
              id="formSatisfaction"
              label="Satisfaction (1-5)"
              value={formSatisfaction}
              onChange={(e) => setFormSatisfaction(Number(e.target.value))}
              options={[
                { value: '', label: 'Select' },
                { value: '5', label: '5 - Excellent' },
                { value: '4', label: '4 - Good' },
                { value: '3', label: '3 - Average' },
                { value: '2', label: '2 - Poor' },
                { value: '1', label: '1 - Horrible' }
              ]}
            />
            <Select
              id="formAdherence"
              label="Plan Adherence (1-5)"
              value={formAdherence}
              onChange={(e) => setFormAdherence(Number(e.target.value))}
              options={[
                { value: '', label: 'Select' },
                { value: '5', label: '5 - Perfect' },
                { value: '4', label: '4 - Minor deviation' },
                { value: '3', label: '3 - Improvising' },
                { value: '2', label: '2 - Chasing' },
                { value: '1', label: '1 - Complete breakdown' }
              ]}
            />
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {tags.map((t) => {
                const isSelected = formSelectedTags.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setFormSelectedTags(
                        isSelected
                          ? formSelectedTags.filter((id) => id !== t.id)
                          : [...formSelectedTags, t.id]
                      )
                    }}
                    style={{
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              />
              <Button type="button" onClick={handleCreateTag} style={{ padding: '6px 12px' }}>
                Create Tag
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor="formNotes">Trade Notes / Reflections</label>
            <textarea
              id="formNotes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="What went well? What rules were followed?"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {isEditModalOpen && selectedTrade && userId && (
            <ScreenshotUploader tradeId={selectedTrade.id} userId={userId} />
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitLoading}>
              Save Trade
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
