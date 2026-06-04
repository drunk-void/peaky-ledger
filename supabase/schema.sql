-- Users profile extension (Supabase Auth handles core auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  default_currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trading accounts (multi-account support)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                          -- "Fyers Main", "Zerodha F&O"
  broker TEXT NOT NULL,                        -- 'fyers', 'zerodha', 'manual'
  account_id TEXT,                             -- Broker-specific account ID
  starting_balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  broker_credentials JSONB,                    -- { accessToken, appId, ... }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Core trades table
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  
  -- Trade identity
  external_trade_id TEXT,                      -- Broker's trade ID (dedup key)
  symbol TEXT NOT NULL,                        -- "NSE:SBIN-EQ", "NSE:NIFTY24JUNFUT"
  display_symbol TEXT,                         -- Cleaned: "SBIN", "NIFTY FUT"
  asset_class TEXT NOT NULL,                   -- 'equity', 'futures', 'options', 'forex'
  exchange TEXT,                               -- "NSE", "BSE", "MCX"
  
  -- Execution
  side TEXT NOT NULL CHECK (side IN ('LONG','SHORT')),
  entry_price NUMERIC(15,4) NOT NULL,
  exit_price NUMERIC(15,4),
  quantity NUMERIC(15,4) NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','PARTIAL')),
  
  -- Financials
  gross_pnl NUMERIC(15,2),
  fees NUMERIC(15,2) DEFAULT 0,
  net_pnl NUMERIC(15,2),
  currency TEXT DEFAULT 'INR',
  
  -- Options/Futures specific
  strike_price NUMERIC(15,2),
  option_type TEXT CHECK (option_type IN ('CE','PE')),
  expiry_date DATE,
  contract_multiplier NUMERIC(10,2) DEFAULT 1,
  
  -- Psychology & journaling
  setup TEXT,                                  -- Strategy/setup name
  notes TEXT,
  satisfaction INTEGER CHECK (satisfaction BETWEEN 1 AND 5),
  plan_adherence INTEGER CHECK (plan_adherence BETWEEN 1 AND 5),
  emotion TEXT CHECK (emotion IN ('calm','fomo','revenge','hesitation','greed','fear')),
  
  -- Excursions (MFE/MAE)
  mfe_price NUMERIC(15,4),                    -- Max Favorable Excursion
  mae_price NUMERIC(15,4),                    -- Max Adverse Excursion
  
  -- Computed (stored for query performance)
  r_multiple NUMERIC(10,4),
  duration_minutes INTEGER,
  
  -- Import source
  source TEXT DEFAULT 'manual',                -- 'fyers_api', 'csv_import', 'manual'
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tags (many-to-many with trades)
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  group_name TEXT,                              -- "Patterns", "Mistakes", "Setups"
  color TEXT DEFAULT '#6366f1',
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS public.trade_tags (
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

-- Diary entries
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  content TEXT,                                -- Rich text HTML (TipTap)
  mood TEXT CHECK (mood IN ('great','good','neutral','bad','terrible')),
  day_rating INTEGER CHECK (day_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Screenshots (references to Supabase Storage objects)
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  diary_entry_id UUID REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                   -- Supabase Storage path
  file_size INTEGER,                            -- Bytes (compressed)
  original_size INTEGER,                        -- Bytes (original)
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Playbook entries
CREATE TABLE IF NOT EXISTS public.playbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,                                -- Rich text HTML
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Currency exchange rate cache
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(15,6) NOT NULL,
  date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_currency, target_currency, date)
);

-- Broker connection tokens (encrypted, server-side only)
CREATE TABLE IF NOT EXISTS public.broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  broker TEXT NOT NULL,                        -- 'fyers'
  access_token TEXT,                           -- Fyers access token (encrypt this at app level)
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'disconnected',     -- 'connected', 'expired', 'error'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: Users can read and write only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Accounts
CREATE POLICY "Users can access own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id);

-- Trades
CREATE POLICY "Users can access own trades" ON public.trades FOR ALL USING (auth.uid() = user_id);

-- Tags
CREATE POLICY "Users can access own tags" ON public.tags FOR ALL USING (auth.uid() = user_id);

-- Trade tags
CREATE POLICY "Users can access own trade_tags" ON public.trade_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM public.trades WHERE trades.id = trade_tags.trade_id AND trades.user_id = auth.uid())
);

-- Diary Entries
CREATE POLICY "Users can access own diary" ON public.diary_entries FOR ALL USING (auth.uid() = user_id);

-- Screenshots
CREATE POLICY "Users can access own screenshots" ON public.screenshots FOR ALL USING (auth.uid() = user_id);

-- Playbook Entries
CREATE POLICY "Users can access own playbook" ON public.playbook_entries FOR ALL USING (auth.uid() = user_id);

-- Exchange Rates (public read, system write)
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert exchange rates" ON public.exchange_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Broker Connections
CREATE POLICY "Users can access own broker connections" ON public.broker_connections FOR ALL USING (auth.uid() = user_id);

-- Profile trigger to create a profile automatically when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
