export type AssetClass = 'equity' | 'futures' | 'options' | 'forex'

export type TradeSide = 'LONG' | 'SHORT'

export type TradeStatus = 'OPEN' | 'CLOSED' | 'PARTIAL'

export type TradeEmotion = 'calm' | 'fomo' | 'revenge' | 'hesitation' | 'greed' | 'fear'

export type BrokerType = 'fyers' | 'zerodha' | 'manual'

export type SyncStatus = 'connected' | 'expired' | 'error' | 'disconnected'

export interface Profile {
  id: string
  display_name: string | null
  default_currency: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  broker: BrokerType
  account_id: string | null
  starting_balance: number
  currency: string
  is_active: boolean
  archived_at?: string | null
  created_at: string
  updated_at: string
  broker_connections?: {
    sync_status: SyncStatus
    last_sync_at: string | null
  }[]
}

export interface Trade {
  id: string
  user_id: string
  account_id: string
  external_trade_id: string | null
  symbol: string
  display_symbol: string | null
  asset_class: AssetClass
  exchange: string | null
  side: TradeSide
  entry_price: number
  exit_price: number | null
  quantity: number
  entry_time: string
  exit_time: string | null
  status: TradeStatus
  number_of_orders?: number
  gross_pnl: number | null
  fees: number
  net_pnl: number | null
  currency: string
  strike_price: number | null
  option_type: 'CE' | 'PE' | null
  expiry_date: string | null
  contract_multiplier: number
  setup: string | null
  notes: string | null
  satisfaction: number | null // 1 to 5
  plan_adherence: number | null // 1 to 5
  emotion: TradeEmotion | null
  mfe_price: number | null
  mae_price: number | null
  r_multiple: number | null
  duration_minutes: number | null
  source: 'fyers_api' | 'csv_import' | 'manual'
  fees_auto_calculated?: boolean
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export type CommissionCalcType = 'percent_of_turnover' | 'flat_per_trade' | 'per_unit' | 'flat_per_order'

export interface CommissionRule {
  id: string
  user_id: string
  account_id: string
  label: string
  calc_type: CommissionCalcType
  value: number
  applies_to: string[]  // asset classes, empty array = all
  is_active: boolean
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  group_name: string | null
  color: string
}

export interface DiaryEntry {
  id: string
  user_id: string
  date: string
  content: string | null
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null
  day_rating: number | null // 1 to 5
  created_at: string
  updated_at: string
}

export interface Screenshot {
  id: string
  user_id: string
  trade_id: string | null
  diary_entry_id: string | null
  storage_path: string
  file_size: number
  original_size: number
  caption: string | null
  created_at: string
}

export interface PlaybookEntry {
  id: string
  user_id: string
  title: string
  content: string | null
  tags: string[]
  created_at: string
  updated_at: string
}
