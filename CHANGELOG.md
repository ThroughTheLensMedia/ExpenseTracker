# Lumière Ledger — Changelog

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

---

## [v7.2.0] — 2026-05-13

### Mobile UX Sprint & Multi-Tenant Account Architecture

#### Fixed
- **Import clock integrity** (`Transactions.jsx`) — Days-since-import badge now ignores `source === 'manual'` entries. Adding a manual transaction no longer resets the clock to "Updated today." Clock reflects actual bank/CSV import activity only.
- **Calendar icon visibility** (`index.css`) — Replaced conflicting `filter: invert(1)` (which fought against `color-scheme: dark`) with `filter: brightness(0) invert(1)`. Forces pure white icon regardless of OS theme. Tap target padded to 18×18px minimum.
- **Amount field UX** (`TransactionDrawer.jsx`) — New transactions now open with an empty amount field instead of pre-filled `0.00`. `LOAD_TRANSACTION` reducer returns `initialState` when `tx.id` is null. Added `onFocus` handler to clear zero values on existing transactions.
- **Recurring flag layout** (`TransactionDrawer.jsx`) — "Tax Deductible" and "Recurring" checkboxes now render on a single line with `flexWrap: 'nowrap'`. Label text shortened to prevent overflow on narrow screens.
- **Receipt upload — gallery access** (`TransactionDrawer.jsx`) — Removed `capture="environment"` attribute which forced camera-only mode on iOS. Users can now select from photo library, Files app, iCloud Drive, or email attachments saved locally.
- **Missing doc threshold** (`Transactions.jsx`) — MISSING DOC badge now only surfaces on transactions where `amount_cents > 7500` ($75) AND `tax_deductible` AND no `receipt_link`. Applied consistently to both mobile card view and desktop Doc column. Reduces noise on low-value transactions.
- **PWA session persistence** (`AuthContext.jsx`) — Supabase client initialized with explicit `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. Added `visibilitychange` event listener that calls `getSession()` on every app foreground. Eliminates forced logout when PWA is closed and re-opened.

#### Changed
- **Account source dropdown** (`TransactionDrawer.jsx`, `Transactions.jsx`) — Replaced hardcoded bank/card list with a dynamic dropdown built from the logged-in user's own imported `source` values via `useFilterOptions`. Each user sees only the accounts present in their ledger. New users with no imports see a hint to import or connect Plaid. Legacy source keys not in the user's data are surfaced as a fallback option when editing old records. `SOURCE_LABELS` map and `formatSourceKey()` helper added for human-readable display of known and unknown keys.
- **ACCOUNT_LABELS** (`Transactions.jsx`) — Extended with Delta Amex, Amex Gold, Amex Platinum, Amex Blue Cash keys for consistent display in filter dropdowns and table rows.

#### Planning
- **ROADMAP.md** — Added `🏃 ACTIVE SPRINT` section with NOW/NEXT/LATER priority queue. Added User-Defined Accounts (Phase 5) feature spec with implementation order. Marked all Phase 1 mobile patch items as complete.

---

## [v7.1.0] — 2026-05-06

### Website Lead Capture — Full Pipeline

#### New Features
- **`POST /api/intake`** — Public server-to-server endpoint. Validates `x-intake-secret` header against `intake_keys` table (falls back to `LUMIERE_INTAKE_SECRET` env var for legacy support). Resolves owning `user_id`, deduplicates clients by email, inserts lead with `status: "New Lead"`.
- **Client deduplication** — Email-based case-insensitive lookup before any insert. Returning clients link to existing record; no duplicate contact cards. `isReturning: true` appended to lead notes.
- **`intake_keys` table** — Per-user API key storage (`id`, `user_id`, `key`, `label`, `created_at`, `last_used_at`). RLS-protected. Service role bypasses RLS for server-side lookups. Index on `key` for fast per-request validation.
- **`GET/POST/DELETE /api/intake-keys`** — Authenticated CRUD. Keys generated as `ll-{24-char UUID slug}`. `last_used_at` updated on every valid intake request (fire-and-forget).
- **`useLeadsRealtime` hook** — Supabase Realtime `postgres_changes` subscription on `leads` filtered by `user_id`. Fires slide-in toast (bottom-right, 8s, click navigates to CRM) and badge counter on new INSERT.
- **Badge on nav** — Red dot badge on bottom nav Leads icon and dropdown CRM Pipeline link. Clears on navigation to `/crm`. `9+` cap for overflow.
- **IntegrationTab** — New Control Center tab (`?tab=integration`). Generate labeled intake keys, copy `LUMIERE_INTAKE_URL` + `LUMIERE_INTAKE_SECRET` env vars, view code snippet for Cloudflare Worker integration, revoke keys with confirm dialog.
- **AddOns page (`/addons`)** — Marketplace listing available add-ons with feature lists and CTAs. Coming-soon add-ons: Website Builder, Client Portal, Contract E-Sign. Linked from main nav dropdown.
- **TTLM `form.js` v2.0.0** — Complete rewrite of Cloudflare Pages Function. Success gate: Turnstile verification + owner Resend email. All secondary tasks (GAS, D1, customer confirmation, Lumière intake) are fire-and-forget via `context.waitUntil`. Form never fails due to downstream dependency.

#### Changed
- `server.js` — Mounts `intakeRouter` (public, before auth middleware) and `intakeKeysRouter` (authenticated, after auth middleware).
- `AuthContext.jsx` — Exports `supabase` client for use by `useLeadsRealtime` without creating a second client instance.
- `App.jsx` — Imports `AddOns` page, adds `/addons` route, adds 🧩 Add-Ons link to dropdown nav.
- `Backup.jsx` — Adds `IntegrationTab` import, adds `'integration'` to valid tab list, renders `IntegrationTab` for `activeTab === 'integration'`, adds 🔗 Integrations tab button.

#### Database
- New migration: `docs/supabase_schema_intake_keys.sql` — run in Supabase SQL Editor to activate multi-tenant intake keys.

#### Env Vars Added
- `LUMIERE_INTAKE_SECRET` — Legacy single-owner secret (backward compat, optional once DB keys are active).

---

## [v7.0.0] — 2026-04-14

### Rebrand to Lumière Ledger

- Full rebrand from internal name to **Lumière Ledger** (`lumiereledger.com`).
- Updated all UI copy, email templates, and admin tooling.
- Subscription licensing and SaaS admin layer launched.
- `SaasTab` added to Control Center — beta codes, subscriptions, engagement pulse.
- Version check hook added — in-app "Refresh for Updates" banner on new deploy.
- `ChangeLogModal` component for in-app release notes display.

---

## [v6.x.x] — 2026-Q1

### CRM Pipeline & Invoicing

- Full CRM pipeline — `New Lead → Quoted → Booked → Lost` kanban.
- Client management with linked lead history.
- Invoice builder — line items, tax, discount, PDF export, email delivery via Resend.
- Pay portal (`/pay/:token`) — public client-facing invoice payment page.
- Digital e-signature capture on invoices.
- CRM financials view — revenue per client, outstanding invoices.

---

## [v5.2.0] — 2025-Q4

### AI Intelligence Hub & Field Speed

- Gemini 2.5 Flash integration — BYOB (Bring Your Own Brain) API key model.
- AI Ledger Repair — batch retroactive categorization with 503 retry logic.
- AI Financial Assistant sidebar — contextual financial Q&A.
- 11+ bank CSV import profiles with auto-detection and dedup.
- Mileage tracker with IRS standard rate and Google Maps integration.
- Equipment registry with straight-line and Section 179 depreciation.
- Receipt upload to Supabase Storage with signed URL access.
- Schedule C tax mapping with PDF export.
- System reliability watchdog — hourly cron checks DB + SMTP, sends alert email on failure.
- UptimeRobot Layer 1 external HTTP monitoring.
- RLS fully activated — 40+ endpoints hardened.
- Admin diagnostic dashboard — service key validation, beta code management.

---

## [v5.0.0] — 2025-Q3

### Foundation & Invoicing

- Core transaction ledger CRUD with Supabase backend.
- Multi-tenant RLS isolation — each user sees only their own data.
- Auto-classification rules engine — vendor/notes pattern matching.
- Executive dashboard — gross/net/burn rate KPIs, charts.
- Plaid integration scaffolded (pending approval).
- Beta code access gating during testing phase.
