# Peaky Ledger — System Architecture & Design

This document details the system design, database schema, authentication flows, broker integration patterns, and key business logic implemented in **Peaky Ledger**.

---

## 1. High-Level Architecture

```mermaid
graph TD
    subgraph "Client (Browser)"
        UI[React 19 UI Components]
        ZS[Zustand Store]
        SBC[Supabase Browser Client]
        UI --> ZS
        UI --> SBC
    end

    subgraph "Next.js 16 Server"
        MW[Middleware - proxy.ts]
        AR[API Route Handlers]
        SSC[Supabase Server Client]
        BA[Broker Adapters]
        ENC[Encryption Module]
        AR --> SSC
        AR --> BA
        AR --> ENC
    end

    subgraph "External Services"
        SB[(Supabase - Postgres + Auth + Storage)]
        FY[Fyers API v3]
        FX[Frankfurter Exchange Rates]
    end

    UI -->|HTTP| MW
    MW -->|Route| AR
    SBC -->|Direct| SB
    SSC -->|Server-side| SB
    BA -->|OAuth + REST| FY
    UI -->|Client-side| FX
```

---

## 2. Directory Structure

```
peaky-ledger/
├── docs/
│   └── architecture.md            # ← THIS FILE
├── supabase/
│   └── schema.sql                 # PostgreSQL migrations, triggers & RLS policies
├── src/
│   ├── proxy.ts                   # Next.js middleware entry point
│   ├── app/                       # Next.js 16 App Router
│   │   ├── layout.tsx             # Root layout (font, theme, analytics)
│   │   ├── page.tsx               # Root redirect → /dashboard
│   │   ├── globals.css            # Complete design system & theme tokens
│   │   ├── (journal)/             # Protected route group (Sidebar + Header shell)
│   │   │   ├── layout.tsx         # Shell layout
│   │   │   ├── dashboard/         # Performance KPIs + charts
│   │   │   ├── trades/            # Trade CRUD + filters + tags + screenshots
│   │   │   ├── calendar/          # Monthly P&L calendar view
│   │   │   ├── diary/             # Mood tracker + rich text journal
│   │   │   ├── playbook/          # Strategy documentation
│   │   │   ├── import/            # CSV import + broker connect/sync
│   │   │   └── settings/          # Account + commission + profile management
│   │   ├── api/broker/            # Server-side broker API routes
│   │   │   ├── connect/           # OAuth redirect generation
│   │   │   ├── callback/          # OAuth code exchange + token storage
│   │   │   └── sync/              # Trade fetching + deduplication
│   │   ├── auth/callback/         # Supabase Auth session exchange
│   │   ├── oauth/consent/         # Google OAuth callback
│   │   ├── login/                 # Login page
│   │   └── signup/                # Signup page
│   ├── components/
│   │   ├── layout/                # Sidebar, Header, DateRangeFilter
│   │   └── ui/                    # Button, Card, Input, Select, Badge, Modal, ThemeToggle, ScreenshotUploader
│   ├── store/                     # Zustand state management
│   │   └── useJournalStore.ts
│   ├── types/                     # TypeScript interfaces
│   │   └── journal.ts
│   └── utils/
│       ├── broker/adapter.ts      # BrokerAdapter interface + FyersAdapter
│       ├── supabase/              # Client/Server/Middleware + centralized queries
│       ├── commission.ts          # Commission calculation engine
│       ├── currency.ts            # Exchange rate API + caching + formatting
│       ├── encryption.ts          # AES-256-GCM for broker tokens
│       ├── metrics.ts             # Trading metrics calculator
│       ├── screenshots.ts         # Supabase Storage operations
│       └── useCurrency.ts         # React currency conversion hook
```

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    users ||--|| profiles : "extends"
    profiles ||--o{ accounts : "owns"
    accounts ||--o{ trades : "logs"
    accounts ||--o{ broker_connections : "connects"
    accounts ||--o{ commission_rules : "configures"
    profiles ||--o{ tags : "creates"
    trades }o--o{ trade_tags : "links"
    tags }o--o{ trade_tags : "links"
    trades ||--o{ screenshots : "attaches"
    profiles ||--o{ diary_entries : "writes"
    diary_entries ||--o{ screenshots : "attaches"
    profiles ||--o{ playbook_entries : "documents"
    exchange_rates ||--|| exchange_rates : "cached"

    profiles {
        uuid id PK
        text display_name
        text default_currency
        text timezone
    }

    accounts {
        uuid id PK
        uuid user_id FK
        text name
        text broker
        numeric starting_balance
        text currency
        boolean is_active
        timestamptz archived_at
    }

    trades {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        text external_trade_id
        text symbol
        text asset_class
        text side
        numeric entry_price
        numeric exit_price
        numeric quantity
        text status
        numeric gross_pnl
        numeric fees
        numeric net_pnl
        text emotion
        integer satisfaction
        text source
    }

    broker_connections {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        text broker
        text access_token
        text sync_status
    }

    commission_rules {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        text label
        enum calc_type
        numeric value
        text_array applies_to
    }
```

### 3.2 Row Level Security (RLS)

All tables enforce RLS with the pattern:
```sql
CREATE POLICY "policy_name" ON public.table_name
  FOR ALL USING (auth.uid() = user_id);
```

Exception: `exchange_rates` allows public SELECT and authenticated INSERT.

### 3.3 Auto-Profile Trigger

A PostgreSQL trigger creates a `profiles` row automatically when a new user signs up via Supabase Auth:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Authentication Architecture

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Middleware
    participant NextJS as Next.js Server
    participant Supabase

    User->>Browser: Visit protected route
    Browser->>Middleware: Request /dashboard
    Middleware->>Supabase: getUser() (via cookies)
    alt Not authenticated
        Supabase-->>Middleware: null user
        Middleware-->>Browser: Redirect /login
    else Authenticated
        Supabase-->>Middleware: user object
        Middleware-->>Browser: Allow through
    end

    Note over User,Browser: Login Flow
    User->>Browser: Submit credentials
    Browser->>Supabase: signInWithPassword / signInWithOAuth
    Supabase-->>Browser: Auth code
    Browser->>NextJS: /auth/callback?code=...
    NextJS->>Supabase: exchangeCodeForSession
    Supabase-->>NextJS: Session cookies
    NextJS-->>Browser: Redirect /dashboard
```

---

## 5. Broker Integration Architecture

### 5.1 Adapter Pattern

```typescript
interface BrokerAdapter {
  getAuthUrl(accountId?: string): string
  exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiry: Date }>
  fetchTrades(accessToken: string, appId: string, params: {
    fromDate: string; toDate: string; symbol?: string
  }): Promise<Partial<Trade>[]>
}
```

### 5.2 Fyers OAuth Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Peaky Ledger
    participant Fyers as Fyers API v3

    User->>App: Click "Connect Fyers"
    App->>Fyers: Redirect to OAuth URL
    Fyers->>User: Show login/consent page
    User->>Fyers: Authorize
    Fyers->>App: Redirect to /api/broker/callback?auth_code=...&state=accountId=...
    App->>App: SHA-256(appId:appSecret)
    App->>Fyers: POST /v3/validate-authcode (code + appIdHash)
    Fyers-->>App: access_token
    App->>App: AES-256-GCM encrypt(access_token)
    App->>Supabase: Upsert broker_connections
    App-->>User: Redirect /import?success=...

    Note over User,App: Trade Sync Flow
    User->>App: Click "Sync Trades"
    App->>Supabase: Fetch broker_connections
    App->>App: Decrypt access_token
    App->>Fyers: GET /v3/trade-history
    Fyers-->>App: Trade records
    App->>App: Deduplicate by external_trade_id
    App->>Supabase: Insert new trades
    App-->>User: "X trades synced"
```

### 5.3 Token Security

Broker access tokens are encrypted at rest using AES-256-GCM:
- Algorithm: `aes-256-gcm`
- IV: 12 random bytes (96 bits)
- Key: 32 bytes from `BROKER_TOKEN_ENCRYPTION_KEY` environment variable
- Storage format: `iv_base64:authTag_base64:ciphertext_base64`

---

## 6. Data Flow Architecture

### 6.1 Trade P&L Calculation

```
entry_price, exit_price, quantity, side, contract_multiplier → grossPnL
  grossPnL = (exitPrice - entryPrice) × quantity × direction × multiplier
  direction = side === 'LONG' ? 1 : -1

commission_rules → fees
  fees = Σ(active rules matching asset class)

netPnL = grossPnL - fees
```

### 6.2 Metrics Calculation Pipeline

```
trades (filtered by date + account) → calculateMetrics()
  ├── winRate = (winners / total) × 100
  ├── profitFactor = totalWins / totalLosses
  ├── expectancy = (winRate × avgWin) - (lossRate × avgLoss)
  ├── equityCurve = chronological running balance
  └── dailyPnL = grouped by entry date
```

### 6.3 Currency Conversion Flow

```
User selects preferred currency (Header) → Zustand store
  │
  ├── useCurrency() hook loads rates from Frankfurter API
  │   ├── Check memory cache (12h TTL)
  │   ├── Check localStorage cache
  │   └── Fetch from api.frankfurter.dev/v1/latest
  │       └── Fallback to hardcoded rates
  │
  └── Dashboard/Trades pages convert amounts before display
      formatAmount(amount, fromCurrency) → converted & formatted string
```

---

## 7. Commission Engine

Stackable, per-account commission rules supporting three calculation types:

| Type | Formula |
|---|---|
| `percent_of_turnover` | `(value / 100) × (entryPrice + exitPrice) × quantity` |
| `flat_per_trade` | `value` per trade |
| `per_unit` | `value × quantity` |

Rules are:
- Filtered by `is_active` flag
- Filtered by `applies_to` array (asset classes) — empty array means "all"
- Applied additively (stackable)
- Auto-calculated on trade create/update (with manual override option)

---

## 8. Frontend Component Architecture

```mermaid
graph TD
    RootLayout[Root Layout<br/>Font + Theme + Analytics]
    JournalLayout[Journal Layout<br/>Sidebar + Header + Main]
    
    RootLayout --> LoginPage[Login Page]
    RootLayout --> SignupPage[Signup Page]
    RootLayout --> JournalLayout
    
    JournalLayout --> Dashboard[Dashboard Page]
    JournalLayout --> Trades[Trades Page]
    JournalLayout --> Calendar[Calendar Page]
    JournalLayout --> Diary[Diary Page]
    JournalLayout --> Playbook[Playbook Page]
    JournalLayout --> Import[Import Page]
    JournalLayout --> Settings[Settings Page]
    
    Dashboard --> DateRangeFilter
    Dashboard --> Card
    Dashboard --> Recharts[Recharts Charts]
    
    Trades --> Modal
    Trades --> ScreenshotUploader
    Trades --> Badge
    
    Diary --> TipTap[TipTap Editor]
    Playbook --> TipTap
```

---

## 9. Styling Architecture

### Design Token System (HSL-based)

```css
/* Color composition pattern */
--h-primary: 226;    /* Hue */
--s-primary: 96%;    /* Saturation */
--l-primary: 60%;    /* Lightness */
--primary: hsl(var(--h-primary), var(--s-primary), var(--l-primary));
```

### Theme Layers (in priority order)

1. `:root` — default light mode values
2. `@media (prefers-color-scheme: dark)` — system preference override
3. `[data-theme='light']` / `[data-theme='dark']` — explicit user choice (highest priority)

### Theme Persistence

- Stored in `localStorage` key `peaky-theme`
- Applied via `data-theme` attribute on `<html>`
- Anti-FOUC inline script in root layout reads and applies before paint

---
