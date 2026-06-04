import { createClient } from './client'
import { Trade, Account, Tag, DiaryEntry, PlaybookEntry } from '@/types/journal'

const supabase = createClient()

// Accounts
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
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
  return (data || []).map((t: any) => ({
    ...t,
    tags: t.tags?.map((rel: any) => rel.tag).filter(Boolean) || [],
  }))
}

export async function createTrade(
  trade: Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  tagIds?: string[]
): Promise<Trade> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Calculate gross_pnl if closed
  let grossPnL = trade.gross_pnl
  let netPnL = trade.net_pnl

  if (trade.exit_price && trade.gross_pnl === null) {
    const multiplier = trade.contract_multiplier || 1
    const diff = trade.exit_price - trade.entry_price
    const direction = trade.side === 'LONG' ? 1 : -1
    grossPnL = diff * trade.quantity * direction * multiplier
    netPnL = grossPnL - (trade.fees || 0)
  }

  const { data: newTrade, error } = await supabase
    .from('trades')
    .insert([{ 
      ...trade, 
      user_id: user.id,
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
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
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
