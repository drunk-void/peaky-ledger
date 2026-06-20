# Peaky Ledger — Complete Codebase Context

> **Canonical reference for AI coding agents.**
> Read this file in full before making any code change. It covers the entire project: architecture, stack, database schema, design patterns, file inventory, conventions, and known constraints.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | Peaky Ledger |
| **Package name** | `peaky-book` |
| **Version** | `0.1.0` |
| **License** | MIT |
| **Description** | Premium open-source trading journal for tracking performance, managing psychology, documenting strategies, and integrating broker trade data. |

---

## 2. Tech Stack (Exact Versions)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.2.7` | ⚠️ Breaking changes vs. older Next.js — **read `node_modules/next/dist/docs/` before writing any code** |
| **UI Library** | React | `19.2.4` | React 19 — uses modern APIs |
| **Language** | TypeScript | `^5` | Strict mode enabled |
| **Database + Auth** | Supabase (Postgres + Auth + Storage) | `@supabase/supabase-js ^2.107.0`, `@supabase/ssr ^0.10.3` | Row Level Security (RLS) on all tables |
| **State Management** | Zustand | `^5.0.14` | With `persist` middleware (localStorage) |
| **Rich Text** | TipTap | `^3.25.0` (React, StarterKit, PM) | Used in Diary and Playbook pages |
| **Charts** | Recharts | `^3.8.1` | AreaChart, BarChart on Dashboard |
| **CSV Parsing** | PapaParse | `^5.5.3` | Used in Import page |
| **Icons** | Lucide React | `^1.17.0` | Tree-shaken icon imports only |
| **Date Utilities** | date-fns | `^4.4.0` | `format`, `subDays`, `startOfYear`, `startOfMonth` |
| **Image Compression** | browser-image-compression | `^2.0.2` | Client-side before upload to Supabase Storage |
| **Confetti** | canvas-confetti | `^1.9.4` | Celebration effects |
| **CSS** | Vanilla CSS with CSS custom properties (HSL design tokens) | — | **NO Tailwind.** All styling via `globals.css` classes and inline styles |
| **Analytics** | Vercel Analytics + Speed Insights | `^2.0.1`, `^2.0.0` | Included in root layout |
| **Font** | Inter (Google Fonts via `next/font/google`) | — | CSS variable `--font-sans` |

---

## 3. Directory Structure

```
peaky-ledger/
├── AGENTS.md                         # Agent instructions for Gemini/Antigravity
├── CLAUDE.md                         # Agent instructions for Claude (references AGENTS.md)
├── CODEBASE.md                       # ← THIS FILE (canonical reference)
├── LICENSE                           # MIT License
├── README.md                         # User-facing project overview
├── docs/
│   └── architecture.md               # System architecture documentation
├── supabase/
│   └── schema.sql                    # Full DB schema, triggers, RLS policies
├── next.config.ts                    # Next.js 16 configuration
├── tsconfig.json                     # TypeScript configuration (strict, bundler)
├── eslint.config.mjs                 # Flat ESLint config (next/core-web-vitals + TS)
├── package.json                      # Dependencies and scripts
├── .env.local                        # Environment variables (gitignored)
├── .gitignore
└── src/
    ├── proxy.ts                      # Next.js middleware entry (delegates to supabase middleware)
    ├── app/
    │   ├── layout.tsx                # Root layout: Inter font, theme injection script, Analytics
    │   ├── page.tsx                  # Root page: redirects to /dashboard
    │   ├── globals.css               # ALL styling: reset, design tokens, dark/light themes, components
    │   ├── (journal)/                # Route group — protected pages with Sidebar + Header shell
    │   │   ├── layout.tsx            # Shell: Sidebar (fixed 260px), Header (sticky), main content
    │   │   ├── dashboard/page.tsx    # KPI cards + Equity Curve + Daily P&L charts
    │   │   ├── trades/page.tsx       # Trade CRUD table + Add/Edit modal + filters + tags + screenshots
    │   │   ├── calendar/page.tsx     # Monthly calendar view with daily P&L aggregation
    │   │   ├── diary/page.tsx        # Daily mood tracker + TipTap rich text journal
    │   │   ├── playbook/page.tsx     # Setup strategy cards + TipTap rich text editor
    │   │   ├── import/page.tsx       # CSV import + Fyers broker connect/sync UI
    │   │   └── settings/page.tsx     # Account management + commission rules + profile settings
    │   ├── api/broker/               # Server-side API routes for broker integration
    │   │   ├── connect/route.ts      # GET — redirects to Fyers OAuth URL
    │   │   ├── callback/route.ts     # GET — exchanges auth code for token, encrypts & stores
    │   │   └── sync/route.ts         # GET — fetches trades from Fyers API, deduplicates, inserts
    │   ├── auth/callback/route.ts    # Supabase Auth code-for-session exchange
    │   ├── oauth/consent/route.ts    # Google OAuth consent callback
    │   ├── login/page.tsx            # Login page (email/password + Google OAuth)
    │   └── signup/page.tsx           # Signup page (email/password + Google OAuth)
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx           # Fixed left sidebar with nav links and sign-out
    │   │   ├── Header.tsx            # Sticky top header: account selector, currency, theme, user badge
    │   │   └── DateRangeFilter.tsx   # Preset date ranges (7D/30D/90D/MTD/YTD) + custom date inputs
    │   └── ui/
    │       ├── Button.tsx            # Forwarded-ref button with variant + loading state
    │       ├── Card.tsx              # Forwarded-ref div with .card + optional .card-hover
    │       ├── Input.tsx             # Forwarded-ref input with label + error support
    │       ├── Select.tsx            # Forwarded-ref select with options array + label
    │       ├── Badge.tsx             # Pill badge with color variants (primary/success/danger/etc.)
    │       ├── Modal.tsx             # Native <dialog> modal with glassmorphism + Esc support
    │       ├── ThemeToggle.tsx       # Dark/Light toggle (data-theme attribute + localStorage)
    │       └── ScreenshotUploader.tsx # Drag-and-drop image upload with compression, gallery, captions
    ├── store/
    │   └── useJournalStore.ts        # Zustand store: dateRange, selectedAccountId, currency prefs
    ├── types/
    │   └── journal.ts                # All TypeScript interfaces & literal types
    └── utils/
        ├── broker/
        │   └── adapter.ts            # BrokerAdapter interface + FyersAdapter implementation
        ├── supabase/
        │   ├── client.ts             # Browser Supabase client (createBrowserClient)
        │   ├── server.ts             # Server Supabase client (createServerClient + cookies)
        │   ├── middleware.ts          # Auth session refresh + route protection middleware
        │   └── queries.ts            # ALL database CRUD operations (trades, accounts, tags, diary, etc.)
        ├── commission.ts              # Commission calculation engine (percent/flat/per-unit rules)
        ├── currency.ts                # Exchange rate fetching (Frankfurter API) + caching + formatting
        ├── encryption.ts              # AES-256-GCM encrypt/decrypt for broker tokens (server-only)
        ├── metrics.ts                 # Trading metrics calculator (win rate, PF, expectancy, equity curve)
        ├── screenshots.ts             # Screenshot upload/fetch/delete via Supabase Storage
        └── useCurrency.ts             # React hook: converts amounts to preferred currency
```

---

## 4. Database Schema

All tables live in `public` schema. Schema defined in `supabase/schema.sql`.

### 4.1 Tables & Relationships

```
auth.users (Supabase managed)
  └── profiles (1:1, trigger auto-creates on signup)
        ├── accounts (1:many, multi-broker support)
        │     ├── trades (1:many, core trade log)
        │     │     ├── trade_tags (many:many junction → tags)
        │     │     └── screenshots (1:many, optional)
        │     ├── broker_connections (1:1 per account, OAuth tokens)
        │     └── commission_rules (1:many, stackable fee rules)
        ├── tags (1:many, user-scoped custom labels)
        ├── diary_entries (1:many, one per date)
        │     └── screenshots (1:many, optional)
        ├── playbook_entries (1:many, strategy documentation)
        └── exchange_rates (cached currency rates, public read)
```

### 4.2 Key Tables Detail

| Table | Primary Key | Key Columns | Notes |
|---|---|---|---|
| `profiles` | `id` (UUID, FK → auth.users) | `display_name`, `default_currency`, `timezone` | Auto-created by trigger |
| `accounts` | `id` (UUID) | `user_id`, `name`, `broker` ('fyers'/'zerodha'/'manual'), `starting_balance`, `currency`, `is_active`, `archived_at` | Soft-delete via `archived_at` |
| `trades` | `id` (UUID) | `external_trade_id` (dedup key), `symbol`, `asset_class`, `side` (LONG/SHORT), `entry_price`, `exit_price`, `quantity`, `status` (OPEN/CLOSED/PARTIAL), `gross_pnl`, `fees`, `net_pnl`, `emotion`, `satisfaction`, `plan_adherence`, `source` | `fees_auto_calculated` flag tracks auto vs manual fees |
| `tags` | `id` (UUID) | `user_id`, `name` (unique per user), `group_name`, `color` | |
| `trade_tags` | composite (`trade_id`, `tag_id`) | | Many-to-many junction |
| `diary_entries` | `id` (UUID) | `user_id`, `date` (unique per user+date), `content` (HTML), `mood`, `day_rating` | Upserted on save |
| `screenshots` | `id` (UUID) | `user_id`, `trade_id` (nullable), `diary_entry_id` (nullable), `storage_path`, `file_size`, `original_size`, `caption` | Supabase Storage integration |
| `playbook_entries` | `id` (UUID) | `user_id`, `title`, `content` (HTML), `tags` (text[]) | |
| `exchange_rates` | `id` (UUID) | `base_currency`, `target_currency`, `rate`, `date` | Unique constraint on (base, target, date) |
| `broker_connections` | `id` (UUID) | `user_id`, `account_id` (unique together), `broker`, `access_token` (encrypted), `sync_status` | Token encrypted with AES-256-GCM |
| `commission_rules` | `id` (UUID) | `user_id`, `account_id`, `label`, `calc_type` (enum), `value`, `applies_to` (text[]), `is_active` | Stackable per-account rules |

### 4.3 RLS Policy Pattern

Every table uses `USING (auth.uid() = user_id)` for all operations (SELECT/INSERT/UPDATE/DELETE). Exception: `exchange_rates` allows public SELECT, authenticated INSERT. The `trade_tags` junction checks ownership via a subquery on `trades.user_id`.

### 4.4 Trigger

`handle_new_user()` trigger fires `AFTER INSERT ON auth.users` and auto-creates a `profiles` row using the user's `full_name` or `display_name` metadata, falling back to email prefix.

---

## 5. Core Architectural Patterns

### 5.1 Supabase Client Strategy (SSR/CSR Split)

| Context | Creator | File |
|---|---|---|
| Browser (Client Components) | `createBrowserClient()` | `src/utils/supabase/client.ts` |
| Server (Route Handlers, Server Components) | `createServerClient()` with cookie adapter | `src/utils/supabase/server.ts` |
| Middleware | `createServerClient()` with request cookie adapter | `src/utils/supabase/middleware.ts` |

**Rule:** Never use the browser client in server contexts or vice versa.

### 5.2 Data Access Layer (`queries.ts`)

All database operations are centralized in `src/utils/supabase/queries.ts`. This file:
- Uses the **browser** Supabase client (imported from `client.ts`)
- Provides typed CRUD functions for every entity
- Handles auto-commission calculation on trade create/update
- Handles P&L computation on trade create/update
- Manages tag associations via the junction table
- Is imported directly by client components (pages)

**Convention:** Do NOT scatter Supabase queries across components. Add new queries to `queries.ts`.

### 5.3 Broker Adapter Pattern

Defined in `src/utils/broker/adapter.ts`:
```typescript
interface BrokerAdapter {
  getAuthUrl(accountId?: string): string
  exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiry: Date }>
  fetchTrades(accessToken: string, appId: string, params: { fromDate: string; toDate: string; symbol?: string }): Promise<Partial<Trade>[]>
}
```

Currently implemented: `FyersAdapter` (Fyers API v3).

**To add a new broker:** Create a new class implementing `BrokerAdapter`, add the broker name to the `BrokerType` union type in `types/journal.ts`, and create corresponding API routes.

### 5.4 Commission Engine

`src/utils/commission.ts` implements stackable fee calculation:
- `percent_of_turnover` — percentage of `(entry + exit) × quantity`
- `flat_per_trade` — fixed amount per trade
- `per_unit` — fixed amount per unit of quantity

Rules filter by `is_active` and `applies_to` (asset classes). Multiple rules stack additively.

### 5.5 Currency Conversion

Two-tier approach:
1. **API:** Frankfurter API (`api.frankfurter.dev`) with 12-hour localStorage + memory cache
2. **Fallback:** Hardcoded static rates for INR/USD/EUR/GBP pairs
3. **Hook:** `useCurrency()` provides `formatAmount(amount, fromCurrency)` that auto-converts to the user's preferred currency

### 5.6 Encryption

`src/utils/encryption.ts` — AES-256-GCM with random IV. Format: `iv_b64:authTag_b64:ciphertext_b64`. Used exclusively for broker access tokens stored in `broker_connections`. Server-only (requires `BROKER_TOKEN_ENCRYPTION_KEY` env var).

### 5.7 Authentication Flow

1. **Email/Password** or **Google OAuth** via Supabase Auth
2. Auth callback at `/auth/callback` or `/oauth/consent` exchanges code for session
3. Middleware (`src/proxy.ts` → `src/utils/supabase/middleware.ts`) refreshes sessions and protects routes
4. Protected routes: `/dashboard`, `/trades`, `/calendar`, `/diary`, `/playbook`, `/settings`, `/import`
5. Unauthenticated users hitting protected routes → redirect to `/login`
6. Authenticated users hitting `/login`, `/signup`, or `/` → redirect to `/dashboard`

### 5.8 Theme System

- CSS custom properties (HSL design tokens) defined in `:root`, `[data-theme='light']`, `[data-theme='dark']`
- Theme persisted in `localStorage` key `peaky-theme`
- Applied via `data-theme` attribute on `<html>` element
- Inline `<script>` in root layout prevents flash of wrong theme (FOUC)
- `ThemeToggle` component toggles the attribute and persists

### 5.9 State Management

Single Zustand store (`useJournalStore`) with `persist` middleware:
- `dateRange` — `{ from: string, to: string }` (yyyy-MM-dd)
- `selectedAccountId` — `'all'` or UUID
- `currency` / `preferredCurrency` — ISO currency code
- Persisted to localStorage key `peaky-journal-settings`

---

## 6. Environment Variables

```env
# Required — Supabase
NEXT_PUBLIC_SUPABASE_URL=            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Supabase anon/public API key

# Required for broker integration
FYERS_APP_ID=                        # Fyers API app client ID
FYERS_APP_SECRET=                    # Fyers API app secret
FYERS_REDIRECT_URI=                  # OAuth redirect (e.g. http://localhost:3000/api/broker/callback)

# Required for token encryption (server-side only)
BROKER_TOKEN_ENCRYPTION_KEY=         # 32-byte hex string (64 hex chars) for AES-256
```

---

## 7. Page-by-Page Feature Map

| Route | Component | Key Features |
|---|---|---|
| `/dashboard` | `(journal)/dashboard/page.tsx` | KPI stat cards (Net P&L, Win Rate, Profit Factor, Total Trades), Equity Curve (AreaChart), Daily P&L (BarChart), Advanced Performance Metrics row |
| `/trades` | `(journal)/trades/page.tsx` | Filterable trade table (by account, asset class, side, status), Add/Edit modal with full trade form, Psychology fields (emotion/satisfaction/adherence), Commission auto-calc toggle, Tag management, Screenshot uploader |
| `/calendar` | `(journal)/calendar/page.tsx` | Monthly grid calendar with daily P&L color-coding, navigation arrows, date-click side drawer |
| `/diary` | `(journal)/diary/page.tsx` | Date picker, mood selector (emoji states), day rating, TipTap rich text editor, auto-save diary entries |
| `/playbook` | `(journal)/playbook/page.tsx` | Strategy card list, create/edit with TipTap editor, tag-based organization |
| `/import` | `(journal)/import/page.tsx` | CSV file upload (PapaParse), column mapping UI, Fyers broker connect button, sync history, duplicate detection |
| `/settings` | `(journal)/settings/page.tsx` | Account CRUD (create/archive/restore/delete), commission rule CRUD, profile preferences, data export |
| `/login` | `login/page.tsx` | Email/password form, Google OAuth button, link to signup |
| `/signup` | `signup/page.tsx` | Email/password form, Google OAuth button, link to login |

---

## 8. Component Library

All components are in `src/components/` and use vanilla CSS classes from `globals.css`.

### Layout Components (`components/layout/`)

| Component | Props | Description |
|---|---|---|
| `Sidebar` | — | Fixed 260px left sidebar, nav links with active state, glassmorphism, sign-out button |
| `Header` | — | Sticky top header, account selector dropdown, currency selector, theme toggle, user badge |
| `DateRangeFilter` | — | Date preset buttons (7D/30D/90D/MTD/YTD) + custom date range inputs |

### UI Components (`components/ui/`)

| Component | Props | Description |
|---|---|---|
| `Button` | `variant` ('primary'/'secondary'/'danger'/'ghost'), `loading` | Standard button with btn-* CSS classes |
| `Card` | `hoverable` | Div wrapper with `.card` class, optional `.card-hover` |
| `Input` | `label`, `error` | Input with label + error message display |
| `Select` | `label`, `error`, `options: {value, label}[]` | Select dropdown with label |
| `Badge` | `variant` ('primary'/'success'/'danger'/'warning'/'info'/'secondary') | Pill-shaped status label |
| `Modal` | `isOpen`, `onClose`, `title` | Native `<dialog>` with glassmorphism backdrop |
| `ThemeToggle` | — | Dark/Light toggle button (Sun/Moon icons) |
| `ScreenshotUploader` | `tradeId?`, `diaryEntryId?`, `userId`, `onUploadComplete?` | Drag-and-drop image upload with preview gallery and captions |

---

## 9. CSS Architecture

All styles live in `src/app/globals.css`. **No Tailwind, no CSS modules, no styled-components.**

### Design Token System

- HSL-based color tokens: `--h-primary`, `--s-primary`, `--l-primary` → composed into `--primary`
- Semantic tokens: `--bg-app`, `--bg-surface`, `--text-primary`, `--border-color`, etc.
- Shadow tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- Transition tokens: `--transition-fast` (150ms), `--transition-normal` (250ms), `--transition-slow` (350ms)
- Scrollbar tokens: `--scrollbar-thumb`, `--scrollbar-track`

### Theme Switching

Three layers of theme definition:
1. `:root` — light mode defaults
2. `@media (prefers-color-scheme: dark)` — system dark mode
3. `[data-theme='light']` / `[data-theme='dark']` — explicit user override (highest priority)

### Key CSS Classes

| Class | Purpose |
|---|---|
| `.glassmorphism` | Frosted glass effect: translucent background + backdrop-filter blur |
| `.card` / `.card-hover` | Card container with border, shadow, hover lift effect |
| `.glow-hover` | Blue glow box-shadow on hover |
| `.btn` `.btn-primary` `.btn-secondary` `.btn-danger` `.btn-ghost` | Button variants |
| `.animate-fade-in` | Entry animation (opacity + translateY) |
| `.pulse-glow` | Infinite pulsing glow animation |

---

## 10. API Route Inventory

All server-side routes are in `src/app/api/`.

| Route | Method | Purpose |
|---|---|---|
| `/api/broker/connect` | GET | Generates Fyers OAuth URL and redirects. Requires `?accountId=` |
| `/api/broker/callback` | GET | Handles Fyers OAuth callback: exchanges code for token, encrypts, stores in `broker_connections` |
| `/api/broker/sync` | GET | Fetches trades from Fyers API using stored token, deduplicates by `external_trade_id`, inserts new trades |

Auth routes (not under `/api/`):

| Route | Method | Purpose |
|---|---|---|
| `/auth/callback` | GET | Supabase Auth code-to-session exchange |
| `/oauth/consent` | GET | Google OAuth consent callback |

---

## 11. Key Business Logic

### P&L Calculation (in `queries.ts`)

```
grossPnL = (exitPrice - entryPrice) × quantity × direction × contractMultiplier
netPnL = grossPnL - fees
direction = side === 'LONG' ? 1 : -1
```

Calculated on trade create and update. Stored in DB for query performance.

### Metrics Calculation (in `metrics.ts`)

- **Win Rate** = (winning trades / total closed trades) × 100
- **Profit Factor** = total win amount / total loss amount (∞ if no losses)
- **Expectancy** = (win% × avgWin) - (loss% × avgLoss)
- **Equity Curve** = starting balance + cumulative net P&L per trade (chronological)
- **Daily P&L** = grouped sum of net P&L by entry date

### Commission Calculation (in `commission.ts`)

- `percent_of_turnover`: `(rule.value / 100) × (entryPrice + exitPrice) × quantity`
- `flat_per_trade`: `rule.value` per trade
- `per_unit`: `rule.value × quantity`

Rules are stackable (additive). Filtered by `is_active` and `applies_to` asset classes.

### Trade Deduplication (in sync route)

Checks `external_trade_id` before inserting synced trades. Existing trades with matching external IDs are skipped.

---

## 12. Development Commands

```bash
npm run dev     # Start development server (Next.js 16)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint check
```

---

## 13. Coding Conventions & Rules

### General

1. **TypeScript strict mode** is enabled — no `any` unless absolutely necessary
2. **All page components are client components** (`'use client'` directive) — they use hooks and browser APIs
3. **Path alias**: `@/*` maps to `./src/*` (configured in `tsconfig.json`)
4. **Import order**: React → Next.js → third-party → internal components → internal utils → types
5. **No default exports for components** — use named exports (except page components which must be default)

### Styling

1. **NO Tailwind CSS** — use vanilla CSS classes from `globals.css` or inline styles
2. Use CSS custom properties (design tokens) for all colors, shadows, transitions
3. Inline styles are acceptable and heavily used throughout the codebase
4. New CSS classes should be added to `globals.css`

### Data Flow

1. All Supabase queries go through `src/utils/supabase/queries.ts`
2. Components fetch data in `useEffect` hooks
3. Global state (date range, account, currency) lives in Zustand store
4. Local component state manages UI (modals, forms, loading)

### Error Handling

1. Query functions throw errors — callers wrap in try/catch
2. API routes return `NextResponse.json({ error: message }, { status })` on failure
3. Console.error for non-critical failures, throw for critical ones

### File Naming

- Page files: `page.tsx` (Next.js convention)
- Route handlers: `route.ts` (Next.js convention)
- Components: PascalCase (`Button.tsx`, `Sidebar.tsx`)
- Utilities: camelCase (`currency.ts`, `metrics.ts`)
- Types: camelCase (`journal.ts`)
- Hooks: `use` prefix (`useCurrency.ts`, `useJournalStore.ts`)

---

## 14. Known Constraints & Gotchas

1. **Next.js 16 breaking changes** — APIs, conventions, and file structure may differ from training data. Always check `node_modules/next/dist/docs/` for the latest API reference.
2. **Middleware file** is `src/proxy.ts` (not `middleware.ts` in the root). It exports `proxy` and `config`.
3. **Supabase Storage bucket** named `screenshots` must exist in Supabase project with appropriate policies.
4. **Encryption key** (`BROKER_TOKEN_ENCRYPTION_KEY`) must be exactly 32 bytes (64 hex characters).
5. **Fyers API v3** uses SHA-256 hash of `appId:appSecret` for auth code exchange (not raw secret).
6. **Exchange rates** use Frankfurter API (`api.frankfurter.dev`) which is free and open. Fallback rates are hardcoded for offline use.
7. **All pages in `(journal)/` route group** are client components with their own data fetching.
8. **`queries.ts` uses the browser client** — it cannot be used in server components or API routes. API routes use the server client directly.
9. **Image optimization** is configured for Supabase storage hostname in `next.config.ts`.
10. **ESLint** uses flat config format (`eslint.config.mjs`) with `next/core-web-vitals` and TypeScript rules.
11. **The `proxy.ts` middleware** only runs on non-static routes (see the matcher regex).

---

## 15. Supabase Storage Configuration

The project uses a Supabase Storage bucket named `screenshots` for trade and diary screenshots.

Required bucket configuration:
- **Name**: `screenshots`
- **Public**: Yes (for `getPublicUrl` to work)
- **File size limit**: 10MB
- **Allowed MIME types**: `image/*`

The `next.config.ts` has the Supabase hostname whitelisted for Next.js Image optimization.

---

## 16. Testing & Verification

Currently no automated test suite. To verify changes:
1. `npm run build` — ensures no TypeScript/build errors
2. `npm run lint` — ESLint validation
3. `npm run dev` — manual testing in browser

---

## 17. Deployment

The project is configured for Vercel deployment:
- Vercel Analytics and Speed Insights are integrated in the root layout
- Environment variables must be configured in Vercel dashboard
- Supabase project must be separately provisioned

---
