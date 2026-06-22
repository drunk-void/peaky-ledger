'use client'

import React, { useState, useRef, useEffect } from 'react'
import { RefreshCw, Settings, AlertCircle } from 'lucide-react'
import { useJournalStore } from '@/store/useJournalStore'
import { Button } from '@/components/ui/Button'

interface QuickSyncButtonProps {
  onSyncComplete?: () => void
}

export const QuickSyncButton: React.FC<QuickSyncButtonProps> = ({ onSyncComplete }) => {
  const { selectedAccountId } = useJournalStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [updateFees, setUpdateFees] = useState(false)
  const [overrideManual, setOverrideManual] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const popoverRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSync = async () => {
    if (!selectedAccountId || selectedAccountId === 'all') {
      setError('Please select a specific account to sync.')
      return
    }

    setIsSyncing(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        syncMode: 'quick-sync',
        updateFees: updateFees.toString(),
        overrideManualFees: overrideManual.toString()
      })

      const res = await fetch(`/api/broker/sync?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync')
      }

      setIsOpen(false)
      if (onSyncComplete) {
        onSyncComplete()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  // If "Update fees" is unchecked, override manual must be false
  const handleUpdateFeesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUpdateFees(checked)
    if (!checked) setOverrideManual(false)
  }

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <Button 
        onClick={() => setIsOpen(!isOpen)} 
        disabled={isSyncing}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
        {isSyncing ? 'Syncing...' : 'Quick Sync'}
      </Button>

      {isOpen && (
        <div 
          className="glassmorphism animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Settings size={16} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Sync Options</h4>
          </div>
          
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Fetches order history since your last trade and today's intraday orders.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={updateFees}
                onChange={handleUpdateFeesChange}
                style={{ marginTop: '2px' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                Recalculate fees for existing trades based on current rules
              </span>
            </label>

            <label style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '8px', 
              cursor: updateFees ? 'pointer' : 'not-allowed',
              opacity: updateFees ? 1 : 0.5 
            }}>
              <input 
                type="checkbox" 
                checked={overrideManual}
                onChange={(e) => setOverrideManual(e.target.checked)}
                disabled={!updateFees}
                style={{ marginTop: '2px' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                Overwrite manual fee adjustments
              </span>
            </label>
          </div>

          {error && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '6px', 
              color: 'var(--danger)', 
              fontSize: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '8px',
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setIsOpen(false)} style={{ padding: '6px 12px', fontSize: '13px' }}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={isSyncing} style={{ padding: '6px 12px', fontSize: '13px' }}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  )
}
