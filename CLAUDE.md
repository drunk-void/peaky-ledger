# Peaky Ledger — Claude Code Instructions

@AGENTS.md
@CODEBASE.md

## Claude-Specific Directives

### Memory & Context
- Always read `CODEBASE.md` for full project context before making changes.
- `AGENTS.md` contains behavioral rules that override default assumptions.
- `docs/architecture.md` has the database ER diagram and broker adapter pattern.

### When Editing Code
1. Check `src/types/journal.ts` for existing type definitions before creating new ones.
2. Check `src/utils/supabase/queries.ts` for existing query patterns before writing new ones.
3. Check `src/app/globals.css` for existing CSS classes before adding inline styles.
4. Use `@/*` path alias for all imports (maps to `./src/*`).

### When Debugging
- Supabase RLS errors often manifest as empty results (not errors). Check RLS policies in `supabase/schema.sql`.
- The middleware is in `src/proxy.ts` (not the typical `middleware.ts` location).
- Token encryption errors likely mean `BROKER_TOKEN_ENCRYPTION_KEY` is wrong length (needs 64 hex chars = 32 bytes).

### Project Tech Stack Summary
- **Next.js 16** (App Router), **React 19**, **TypeScript 5** (strict)
- **Supabase** (Auth + Postgres + Storage + RLS)
- **Zustand** (state), **Recharts** (charts), **TipTap** (rich text)
- **Vanilla CSS** with HSL design tokens — **NO Tailwind**
- **Fyers API v3** (broker integration with OAuth + SHA-256 auth)
