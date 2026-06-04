# Peaky Ledger — Open Source Trading Journal

**Peaky Ledger** is a premium, open-source trading journal designed to help traders track their performance, manage trading psychology, document execution strategies, and seamlessly integrate broker trades.

Built with **Next.js 16 (App Router + React 19)**, **Supabase** (Postgres, Auth, RLS), and styled using custom **Vanilla CSS variables** for maximum flexibility and performance.

---

## 🚀 Key Features

* **Performance Dashboard**: Real-time calculated trading metrics including Net/Gross P&L, Win Rate, Profit Factor, Expectancy, Average Win/Loss, and Max Excursions.
* **Equity Curve & Charts**: High-performance visualizations using Recharts displaying your running balance and daily net outcomes.
* **Interactive Trading Calendar**: Month-to-month roadmap aggregating daily profits/losses with detailed side drawers.
* **Psychological Mindset Log (Diary)**: Multi-state mindset selector (mood tracker) and execution quality ratings alongside a rich-text journaling editor (TipTap).
* **Setup Playbook**: Create, tag, and document setup sheets containing checklists, rules, and chart criteria.
* **Fyers API Integration & CSV Import**: Supports direct connection to the Fyers API (paginated Reports Trade History endpoint) with duplicate detection, alongside a flexible CSV upload parser.
* **Multi-Currency Support**: Conversions handled dynamically using the Frankfurter exchange rates API with offline static defaults.
* **Multi-Account Support**: Switch seamlessly between broker connections and manual test accounts.
* **Premium Theme Customization**: Elegant dark and light modes with custom scrollbars and transition states.

---

## 🛠️ Tech Stack

* **Framework**: Next.js 16 (App Router, React 19)
* **Language**: TypeScript
* **Database / Authentication**: Supabase (Postgres + Auth + Storage with Row Level Security)
* **State Management**: Zustand
* **Rich Text Editing**: TipTap (StarterKit)
* **CSV Processing**: PapaParse
* **Charts**: Recharts

---

## ⚙️ Project Setup

### 1. Supabase Initialization
Create a new Supabase project and execute the SQL migration script located at `supabase/schema.sql` in your Supabase SQL Editor. This script creates:
* The core database schema.
* Auto-profile creation triggers on user registration.
* Row Level Security (RLS) policies protecting individual user records.

### 2. Environment Variables Configuration
Duplicate `.env.local` template or configure the following keys in your local environment:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Fyers API Configuration (For Broker Integration)
FYERS_APP_ID=your-fyers-app-id
FYERS_APP_SECRET=your-fyers-app-secret
FYERS_REDIRECT_URI=http://localhost:3000/auth/callback
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📐 Architecture & System Design

For a deep-dive explanation of the system architecture, database structure, and the Broker Adapter Pattern, please refer to our [Architecture Documentation](docs/architecture.md).

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
