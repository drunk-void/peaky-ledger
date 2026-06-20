import { createClient } from './client'
import { Trade, Account, Tag, DiaryEntry, PlaybookEntry, CommissionRule } from '@/types/journal'
import { calculateCommission } from '@/utils/commission'

const supabase = createClient()

// Accounts
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select(`
      *,
      broker_connections (
        sync_status,
        last_sync_at
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function createAccount(account: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Account> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accounts')
    .insert([{ ...account, user_id: user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Trades
export interface TradeFilterOptions {
  accountId?: string
  fromDate?: string
  toDate?: string
  status?: string
  assetClass?: string
  side?: string
}

export async function getTrades(filters: TradeFilterOptions = {}): Promise<Trade[]> {
  let query = supabase
    .from('trades')
    .select(`
      *,
      tags:trade_tags(
        tag:tags(*)
      )
    `)
    .order('entry_time', { ascending: false })

  if (filters.accountId && filters.accountId !== 'all') {
    query = query.eq('account_id', filters.accountId)
  }
  if (filters.fromDate) {
    query = query.gte('entry_time', filters.fromDate)
  }
  if (filters.toDate) {
    query = query.lte('entry_time', `${filters.toDate}T23:59:59.999Z`)
  }
  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status)
  }
  if (filters.assetClass && filters.assetClass !== 'ALL') {
    query = query.eq('asset_class', filters.assetClass)
  }
  if (filters.side && filters.side !== 'ALL') {
    query = query.eq('side', filters.side)
  }

  const { data, error } = await query
  if (error) throw error

  // Format tags cleanly
  return (data || []).map((t: Omit<Trade, 'tags'> & { tags?: { tag: Tag }[] }) => ({
    ...t,
    tags: t.tags?.map((rel) => rel.tag).filter(Boolean) || [],
  }))
}

export async function createTrade(
  trade: Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  tagIds?: string[]
): Promise<Trade> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let fees = trade.fees || 0
  let feesAutoCalculated = trade.fees_auto_calculated ?? false

  if (fees === 0) {
    try {
      const activeRules = await getCommissionRules(trade.account_id)
      fees = calculateCommission(activeRules, {
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        quantity: trade.quantity,
        asset_class: trade.asset_class,
      })
      feesAutoCalculated = true
    } catch (e) {
      console.error('Failed to calculate auto commission:', e)
    }
  }

  // Calculate gross_pnl if closed
  let grossPnL = trade.gross_pnl
  let netPnL = trade.net_pnl

  if (trade.exit_price && trade.gross_pnl === null) {
    const multiplier = trade.contract_multiplier || 1
    const diff = trade.exit_price - trade.entry_price
    const direction = trade.side === 'LONG' ? 1 : -1
    grossPnL = diff * trade.quantity * direction * multiplier
    netPnL = grossPnL - fees
  }

  const { data: newTrade, error } = await supabase
    .from('trades')
    .insert([{ 
      ...trade, 
      user_id: user.id,
      fees,
      fees_auto_calculated: feesAutoCalculated,
      gross_pnl: grossPnL,
      net_pnl: netPnL,
      status: trade.exit_price ? 'CLOSED' : 'OPEN'
    }])
    .select()
    .single()

  if (error) throw error

  // Associate tags
  if (tagIds && tagIds.length > 0) {
    const associations = tagIds.map((tagId) => ({
      trade_id: newTrade.id,
      tag_id: tagId,
    }))
    const { error: relError } = await supabase.from('trade_tags').insert(associations)
    if (relError) throw relError
  }

  return newTrade
}

export async function updateTrade(
  id: string,
  updates: Partial<Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
  tagIds?: string[]
): Promise<Trade> {
  const finalUpdates = { ...updates }

  if (
    updates.entry_price !== undefined ||
    updates.exit_price !== undefined ||
    updates.quantity !== undefined ||
    updates.side !== undefined ||
    updates.fees !== undefined
  ) {
    const { data: existing, error: getErr } = await supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .single()
      
    if (!getErr && existing) {
      const entryPrice = updates.entry_price !== undefined ? updates.entry_price : Number(existing.entry_price)
      const exitPrice = updates.exit_price !== undefined ? updates.exit_price : (existing.exit_price !== null ? Number(existing.exit_price) : null)
      const quantity = updates.quantity !== undefined ? updates.quantity : Number(existing.quantity)
      const side = updates.side !== undefined ? updates.side : existing.side
      const assetClass = updates.asset_class !== undefined ? updates.asset_class : existing.asset_class
      const multiplier = updates.contract_multiplier !== undefined ? updates.contract_multiplier : Number(existing.contract_multiplier || 1)
      
      let fees = existing.fees
      let feesAutoCalculated = existing.fees_auto_calculated

      if (updates.fees !== undefined) {
        fees = updates.fees
        feesAutoCalculated = false
        finalUpdates.fees_auto_calculated = false
      } else if (feesAutoCalculated) {
        try {
          const rules = await getCommissionRules(existing.account_id)
          fees = calculateCommission(rules, { entry_price: entryPrice, exit_price: exitPrice, quantity, asset_class: assetClass })
          finalUpdates.fees = fees
        } catch (e) {
          console.error(e)
        }
      }

      if (exitPrice !== null) {
        const diff = exitPrice - entryPrice
        const direction = side === 'LONG' ? 1 : -1
        const grossPnL = diff * quantity * direction * multiplier
        const netPnL = grossPnL - fees
        finalUpdates.gross_pnl = grossPnL
        finalUpdates.net_pnl = netPnL
        finalUpdates.status = 'CLOSED'
      } else {
        finalUpdates.gross_pnl = null
        finalUpdates.net_pnl = null
        finalUpdates.status = 'OPEN'
      }
    }
  }

  const { data, error } = await supabase
    .from('trades')
    .update(finalUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (tagIds !== undefined) {
    // Delete existing
    await supabase.from('trade_tags').delete().eq('trade_id', id)

    // Insert new
    if (tagIds.length > 0) {
      const associations = tagIds.map((tagId) => ({
        trade_id: id,
        tag_id: tagId,
      }))
      const { error: relError } = await supabase.from('trade_tags').insert(associations)
      if (relError) throw relError
    }
  }

  return data
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

export async function deleteTrades(ids: string[]): Promise<void> {
  const { error } = await supabase.from('trades').delete().in('id', ids)
  if (error) throw error
}

// Tags
export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createTag(tag: Omit<Tag, 'id' | 'user_id'>): Promise<Tag> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('tags')
    .insert([{ ...tag, user_id: user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}

// Diary Entries
export async function getDiaryEntry(date: string): Promise<DiaryEntry | null> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertDiaryEntry(entry: Omit<DiaryEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<DiaryEntry> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('diary_entries')
    .upsert({ ...entry, user_id: user.id }, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Playbook
export async function getPlaybookEntries(): Promise<PlaybookEntry[]> {
  const { data, error } = await supabase
    .from('playbook_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createPlaybookEntry(entry: Omit<PlaybookEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<PlaybookEntry> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('playbook_entries')
    .insert([{ ...entry, user_id: user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePlaybookEntry(id: string, updates: Partial<Omit<PlaybookEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<PlaybookEntry> {
  const { data, error } = await supabase
    .from('playbook_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePlaybookEntry(id: string): Promise<void> {
  const { error } = await supabase.from('playbook_entries').delete().eq('id', id)
  if (error) throw error
}

// Commission Rules
export async function getCommissionRules(accountId: string): Promise<CommissionRule[]> {
  const { data, error } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createCommissionRule(
  rule: Omit<CommissionRule, 'id' | 'user_id' | 'created_at'>
): Promise<CommissionRule> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('commission_rules')
    .insert([{ ...rule, user_id: user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCommissionRule(
  id: string,
  updates: Partial<Omit<CommissionRule, 'id' | 'user_id' | 'created_at'>>
): Promise<CommissionRule> {
  const { data, error } = await supabase
    .from('commission_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCommissionRule(id: string): Promise<void> {
  const { error } = await supabase.from('commission_rules').delete().eq('id', id)
  if (error) throw error
}

// Account Management
export async function getArchivedAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', false)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) throw error
}

export async function restoreAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: true, archived_at: null })
    .eq('id', id)
  
  if (error) throw error
}

export async function deleteAccount(id: string): Promise<void> {
  const { count, error: countErr } = await supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id)
  
  if (countErr) throw countErr
  if (count && count > 0) {
    throw new Error('Cannot delete account with existing trades. Please archive it instead.')
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}


