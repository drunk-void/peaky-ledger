<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Peaky Ledger — Agent Instructions

> **Read `CODEBASE.md` for complete project context.** This file provides behavioral rules and constraints for AI coding agents.

## Identity

**Peaky Ledger** is a full-stack trading journal built with **Next.js 16 (App Router)**, **React 19**, **Supabase**, **Zustand**, and **vanilla CSS**. It tracks trades, psychology, strategies, and integrates with broker APIs.

## Critical Rules

### 1. Framework Awareness
- **Next.js 16** — not 13/14/15. Check `node_modules/next/dist/docs/` for current API surface.
- **React 19** — uses modern React APIs. Do not use deprecated patterns.
- Middleware entry point is `src/proxy.ts`, not `middleware.ts`.

### 2. Styling
- **NO TAILWIND CSS.** All styling uses vanilla CSS from `src/app/globals.css` + inline styles.
- Use CSS custom properties (design tokens) for all theming. See `:root` and `[data-theme]` selectors in `globals.css`.
- New utility classes or component styles go in `globals.css`.

### 3. Data Layer
- All Supabase queries are centralized in `src/utils/supabase/queries.ts`. Add new queries there.
- Browser client: `src/utils/supabase/client.ts` — for client components and `queries.ts`.
- Server client: `src/utils/supabase/server.ts` — for API route handlers and server components.
- **Never mix** browser and server clients.

### 4. Type Safety
- TypeScript strict mode is enabled. All types are in `src/types/journal.ts`.
- Add new interfaces/types to `journal.ts`, not scattered across files.
- Use the existing union types (`AssetClass`, `TradeSide`, `TradeStatus`, `BrokerType`, etc.) — don't create parallel definitions.

### 5. Component Patterns
- All page components (`page.tsx`) use `'use client'` and fetch data in `useEffect`.
- UI components in `src/components/ui/` use `React.forwardRef` where applicable.
- Layout components in `src/components/layout/` are client components (they use hooks).
- Modal component uses native `<dialog>` element — do not replace with portals or divs.

### 6. State Management
- Global state: Zustand store in `src/store/useJournalStore.ts` (dateRange, selectedAccountId, currency).
- Local state: `useState` within components for UI concerns (modals, forms, loading).
- Do not add new Zustand stores without good reason. Extend the existing one if possible.

### 7. Database Changes
- Schema changes require updating `supabase/schema.sql` AND the corresponding TypeScript types in `types/journal.ts`.
- All tables must have RLS policies (pattern: `auth.uid() = user_id`).
- New tables need CRUD functions in `queries.ts`.

### 8. Broker Integration
- Follow the `BrokerAdapter` interface pattern for new broker integrations.
- Broker tokens are AES-256-GCM encrypted before storage.
- All broker API routes go under `src/app/api/broker/`.

### 9. Environment Variables
- Public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server-only vars: `FYERS_APP_ID`, `FYERS_APP_SECRET`, `FYERS_REDIRECT_URI`, `BROKER_TOKEN_ENCRYPTION_KEY`
- Never expose server-only variables to the client.

### 10. File Organization
- Path alias `@/*` → `./src/*` is configured.
- Follow existing naming conventions: PascalCase for components, camelCase for utils/hooks.
- Page files must be `page.tsx`, route handlers must be `route.ts`.

## Architecture Quick Reference

```
src/proxy.ts → middleware (auth session + route protection)
src/app/layout.tsx → root (font, theme script, analytics)
src/app/(journal)/layout.tsx → shell (Sidebar + Header + main area)
src/app/(journal)/*/page.tsx → feature pages (all client components)
src/app/api/broker/* → server-side broker routes
src/utils/supabase/queries.ts → ALL database operations
src/utils/broker/adapter.ts → broker adapter pattern
src/store/useJournalStore.ts → global UI state
src/types/journal.ts → ALL TypeScript types
```

## Do NOT

- Add Tailwind or any CSS framework
- Create new middleware files (use `proxy.ts`)
- Put Supabase queries directly in components (use `queries.ts`)
- Use `getServerSideProps` or `getStaticProps` (App Router only)
- Create `.css` module files (use `globals.css`)
- Import from `@supabase/supabase-js` directly (use the client/server wrappers)
- Hardcode colors — use CSS custom properties
