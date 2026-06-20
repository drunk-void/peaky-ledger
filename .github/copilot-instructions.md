# Peaky Ledger — GitHub Copilot Instructions

## Project Summary

Peaky Ledger is a full-stack, premium trading journal for tracking performance, managing trading psychology, documenting strategies, and integrating broker trade data.

## Tech Stack

- **Framework**: Next.js 16.2.7 (App Router) with React 19.2.4 — ⚠️ Breaking changes from older versions
- **Language**: TypeScript 5 (strict mode)
- **Database/Auth**: Supabase (Postgres + Auth + Storage with Row Level Security)
- **State**: Zustand 5 with localStorage persistence
- **Charts**: Recharts 3
- **Rich Text**: TipTap 3
- **Styling**: Vanilla CSS with HSL design tokens — **NO TAILWIND**
- **Icons**: Lucide React (tree-shaken imports)
- **Date Utils**: date-fns 4

## Architecture

### File Layout
- `src/proxy.ts` — Next.js middleware (auth + route protection)
- `src/app/(journal)/` — protected route group (Sidebar + Header shell)
- `src/app/api/broker/` — server-side broker integration routes
- `src/utils/supabase/queries.ts` — centralized database CRUD operations
- `src/utils/broker/adapter.ts` — BrokerAdapter interface + FyersAdapter
- `src/types/journal.ts` — all TypeScript interfaces
- `src/store/useJournalStore.ts` — single Zustand store
- `src/app/globals.css` — all CSS (tokens, themes, components)

### Supabase Clients
- Browser: `src/utils/supabase/client.ts` (for client components)
- Server: `src/utils/supabase/server.ts` (for API routes)
- Never mix these two.

### Path Alias
- `@/*` maps to `./src/*`

## Code Style

- All page components are client components (`'use client'`)
- Database queries centralized in `queries.ts` — never scatter across components
- CSS: use custom properties (`var(--primary)`, `var(--bg-surface)`, etc.)
- Inline styles are common and acceptable
- Components use `React.forwardRef` where applicable
- PascalCase for components, camelCase for utilities/hooks

## Key Files to Reference

- `CODEBASE.md` — exhaustive project documentation
- `AGENTS.md` — agent behavioral rules
- `supabase/schema.sql` — complete database schema with RLS
- `docs/architecture.md` — system architecture documentation

## Do Not

- Use Tailwind CSS
- Import `@supabase/supabase-js` directly
- Put database queries in components
- Use `getServerSideProps` or `getStaticProps`
- Hardcode colors (use CSS custom properties)
