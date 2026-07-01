# Lumière Ledger v7.2 — Master Engineering Specification

> ✅ **REBRAND COMPLETE**: This product has been transitioned to **Lumière Ledger** (`lumiereledger.com`) as of May 2026.

**Current version:** v7.10.14
**Last updated:** 2026-07-01

---

## ⚙️ Engineering Standards
*These rules apply to every change, every session, no exceptions.*

### Changelog — Non-Negotiable
**Every code change must include a `CHANGELOG.md` update before the commit is made.**

- Format: `## [vX.X.X] — YYYY-MM-DD`
- Include: version number, date, and a plain-English description of what changed and why
- Group entries under: `Added`, `Changed`, `Fixed`, `Removed`, or `Planning`
- Never batch multiple version entries into one commit — one commit per version bump
- If you touch a file, it goes in the changelog. No silent changes.

### Version Numbering

| Change type | Example | When to use |
|-------------|---------|-------------|
| **Patch** `vX.X.+1` | `v7.2.0 → v7.2.1` | Bug fixes, copy changes, CSS tweaks, doc updates |
| **Minor** `vX.+1.0` | `v7.2.0 → v7.3.0` | New feature, new page, new API route, new DB table |
| **Major** `v+1.0.0` | `v7.2.0 → v8.0.0` | Breaking architecture change, full rebrand, major data migration |

### Commit Message Format
```
v7.2.0 — Short title describing the change

- Specific thing changed (file.jsx) — why
- Another change (route.js) — why
- Update CHANGELOG.md: vX.X.X entry
```

### File Modification Rules
- Only modify files explicitly in scope for the current task
- Do not rewrite unrelated files to "clean them up" — scope creep breaks things
- Never delete working logic unless explicitly instructed
- If a change is unclear, ask before assuming
- One logical change per commit — do not stack unrelated fixes

### Deploy Workflow
1. Make changes in `/web-react/src` or `/api/routes`
2. Update `CHANGELOG.md`
3. Update `SPEC.md` if architecture, stack, or file map changed
4. Commit with version-tagged message
5. `git push origin main` — Vercel auto-deploys on push to `main`
6. No separate build step required — Vercel handles `npm run build`

---

## Objective
The world's most elite, AI-driven financial command center for creative professionals and self-employed freelancers — purpose-built for photographers, but designed to serve any independent operator running their business solo. Enables automated expense forensics, retroactive ledger repair, tax-aligned reporting, invoicing, asset depreciation, mileage tracking, and strategic business advice — all powered by a private "Bring Your Own Brain" (BYOB) architecture.

Multi-tenant SaaS: every user's data is fully isolated via Supabase Row-Level Security. Each user sees only their own transactions, leads, settings, and receipts.

---

## Constraints
1. **Architecture**: Full-stack Node.js (Express 4.19 API) + React 19 (Vite 7.3 frontend).
2. **Database**: Supabase / PostgreSQL with Row-Level Security (RLS) for 100% multi-tenant data isolation.
3. **AI Engine**: Google Gemini 2.5 Flash. Users supply their own Gemini API keys (privacy + cost control).
4. **Design System**: Vanilla CSS with Glassmorphism, deep dark mode, and micro-animations. No component library.
5. **Hosting**: Vercel (auto-deploy on push to `main`). `www.lumiereledger.com` is the live primary domain; `app.throughthelens.media` 301-redirects to it — migration complete.
6. **Security**: Row-Level Security active on all user tables. `requireRole()` middleware uses service role client to bypass RLS on `user_roles` lookup. Admin UUID + Plaid-exempt list live in `api/constants.js` (single source of truth as of v7.10.11). Cloudflare Turnstile on signup form (v7.10.14).
7. **Payments**: Open public signup — free tier, no code required, but the automatic 30-day trial only activates after email confirmation (v7.10.13, stops bot signups). Invite codes grant elevated plan access (beta_tester, core, studio) and auto-redeem after email confirmation. Stripe subscription billing live for Sync ($4.99/mo, Plaid-only), Core ($9/mo), and Studio ($19/mo) — self-serve checkout without a code is a real, confirmed flow.
8. **Mobile / PWA**: The app is installable as a PWA. Mobile layouts use `.mobile-only` / `.desktop-only` CSS classes. All interactive targets must be ≥ 44px tap area. Session persistence is handled via Supabase `autoRefreshToken` + `visibilitychange` listener.

---

## Multi-Tenant Architecture

This is a shared-database, shared-schema SaaS. Every table that contains user data has a `user_id` column (UUID, references `auth.users`).

**How isolation works:**
- Supabase RLS policies enforce `user_id = auth.uid()` on every SELECT, INSERT, UPDATE, DELETE
- The Express API additionally filters all queries with `.eq('user_id', req.user.id)` as defense-in-depth
- The service role client (`db.js`) bypasses RLS — only used server-side for admin operations and `user_roles` lookups
- Never pass the service role key to the frontend

**What "per-user" means in practice:**
- Source dropdown in Add Transaction: built from *that user's* imported data — no shared or hardcoded list
- AI Brain: fetches only the authenticated user's expenses for context
- Receipts: stored in Supabase Storage with user-scoped paths, accessed only via signed URLs
- Intake keys: each user generates their own `ll-` prefixed API key; intake routes to their CRM only

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2, Vite 7.3, React Router 7, Chart.js 4.5, jsPDF, html2canvas |
| Backend | Node.js, Express 4.19, Multer `^2.1.0`, Zod `^3.23.8`, csv-parser `^3.2.0` |
| Database | Supabase `^2.99.1` (PostgreSQL + Auth + Storage) |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai ^0.24.1`) |
| Email | Resend `2.1.0` (transactional invoices, daily reports, invitations) |
| Banking | Plaid `^29.0.0` — ✅ LIVE in production with billing gate, encryption, sync + reconnect flow. CSV import (11+ bank profiles) |
| Billing | Stripe `^17.7.0` — ✅ LIVE, Free / Sync / Core / Studio, self-serve checkout confirmed as a real flow |
| Auth | Supabase Auth (email/password, Google OAuth), JWT (`jsonwebtoken ^9.0.3`) + JWKS (`jwks-rsa ^4.0.1`). Trial signup gated on email confirmation (v7.10.13). |
| Bot protection | Cloudflare Turnstile on signup (v7.10.14) — needs `TURNSTILE_SECRET_KEY` in Vercel to activate |
| Utilities | archiver `^7.0.1`, uuid `^9.0.0`, file-type `16.5.4`, dotenv `^16.4.7` |

> **Queue removed:** Bull/Redis was removed v7.8.90. `emailQueue.js` uses inline `withRetry()` (3 attempts, linear backoff) — no Redis dependency.

> **⚠️ Lock File Rule:** `api/package-lock.json` MUST be committed whenever `api/package.json` changes. Vercel caches `node_modules` keyed to the lock file — a stale lock bypasses new package installs silently, causing runtime `Cannot find module` crashes. See CLAUDE.md Rule 10. (Confirmed root cause of v7.6.7 production outage.)

---

## File Map

### Backend — `/api/`

| File | Purpose |
|------|---------|
| `server.js` | Express app entry, middleware, route mounting, public `POST /verify-turnstile` |
| `db.js` | Supabase client init (Service Role Key for admin ops) |
| `constants.js` | ✅ v7.10.11 — single source of truth for `ADMIN_UUID`, `MICHELLE_UUID`, `PLAID_BILLING_EXEMPT` |
| `routes/brain.js` | AI intelligence hub — chat, ledger repair, batch categorization |
| `routes/expenses.js` | Core ledger CRUD — create, read, update, delete transactions. Zod `z.preprocess` normalizes iOS date formats. `scanForDuplicates()` also used by Plaid sync. |
| `routes/import.js` | CSV import engine — 11+ bank parsers, auto-detection, cross-source dedup |
| `routes/invoices.js` | Invoice CRUD, line items, PDF export, email delivery via Resend |
| `routes/tax.js` | Schedule C tax mapping, depreciation summaries, deduction exports |
| `routes/assets.js` | Equipment tracking — straight-line & Section 179 depreciation |
| `routes/mileage.js` | Mileage log CRUD, IRS standard rate calculations |
| `routes/rules.js` | Auto-classification rules — vendor/notes pattern matching |
| `routes/receipts.js` | Receipt upload to Supabase Storage. Signed URL endpoint for secure access. |
| `routes/plaid.js` | ✅ LIVE — Plaid link tokens (incl. update-mode reconnect), account sync (pending→posted merge-in-place), transaction pull, `needs_reauth` item health check |
| `routes/admin.js` | Admin dashboard — beta codes, subscriptions, daily/weekly reports, data exports. Uses `listAllUsers()`, not a `profiles` table. |
| `routes/settings.js` | User config persistence (API keys, studio defaults, profile) |
| `routes/subscription.js` | Subscription status, beta code redemption (`POST /redeem`, upserts), public code validation (`GET /validate-code/:code`) |
| `routes/activity.js` | Engagement pulse — daily active minutes tracking. Handles concurrent-tab race via conflict fallback. |
| `routes/leads.js` | CRM lead/client management |
| `routes/intake.js` | **Public** server-to-server endpoint — receives leads from external websites. Validates `x-intake-secret`, resolves owning user via `intake_keys` table (falls back to legacy env var), deduplicates clients by email, inserts lead. No auth required. |
| `routes/intake-keys.js` | **Authenticated** CRUD for per-user intake API keys. `GET /intake-keys`, `POST /intake-keys` (generates `ll-` prefixed UUID key), `DELETE /intake-keys/:id`. |
| `routes/pwa.js` | PWA quick-snap receipt capture endpoint |
| `routes/cron.js` | Daily/monthly reports + watchdog. Uses `listAllUsers()` (no `profiles` table exists). |
| `middleware/auth.js` | JWT auth + `requireRole()`. Uses adminClient (service role) for role lookups to bypass RLS. |
| `middleware/licensing.js` | Subscription gate — blocks expired/suspended users. Fail-closed: 503 on DB error, not pass-through. Own `deriveTier()` intentionally treats Sync as free-tier limits — do not "fix" to match `stripe.js`. |
| `utils/gemini.js` | Gemini 2.5 Flash init, `repairLedgerBatch()` with 503 retry logic |
| `utils/mailer.js` | Resend email bridge with attachment support |
| `utils/cryptoUtil.js` | ✅ Real libsodium implementation — async encrypt/decrypt for Plaid tokens |
| `utils/userDirectory.js` | ✅ v7.10.12 — `listAllUsers()` via Supabase Auth admin API. Use for any "all users" lookup — no `profiles` table exists. |

### Frontend — `/web-react/src/`

**Pages (`/pages/`)**

| File | Purpose |
|------|---------|
| `DashboardV2.jsx` | Business Analytics — executive KPIs, charts, forecasts, operational intelligence. Loads `dashboard_config` from settings on mount; 6 widget flags; ⚙️ gear panel; smart empty states. |
| `Transactions.jsx` | Full ledger — filtering, sorting, audit mode, import clock badge (non-manual only), receipt view via signed URL, MISSING DOC badge for $75+ deductible transactions |
| `Tax.jsx` | Tax workbench — Schedule C mapping, deduction totals, PDF export |
| `Import.jsx` | Bank import wizard — drag-drop CSV, auto-detect bank format, retroactive dedup scanner |
| `Invoice.jsx` | Invoice builder — line items, client info, tax/discount, PDF, email |
| `Assets.jsx` | Equipment registry — depreciation calculator, purchase/disposal tracking |
| `Mileage.jsx` | Mileage tracker — log by date, Google Maps automation, IRS rate lookup |
| `Rules.jsx` | Classification rules editor — vendor matching with retroactive apply |
| `CRM.jsx` | Lead pipeline — kanban board (New Lead, Quoted, Booked), archive |
| `Backup.jsx` | Ledger Control Center — pill nav: AI Intelligence, Automation, Categories, Dashboard, Documents, Help Center, Integrations, Profile, Infrastructure (admin-only), Admin (admin-only, consolidates SaaS Mgmt/System Logs/Security — see `AdminTab.jsx`). Legacy `?tab=saas/logs/security` URLs redirect into Admin. |
| `AddOns.jsx` | Add-On Marketplace — lists available and coming-soon platform extensions |
| `Login.jsx` | Auth — email/password, Google OAuth, invite-code signup. Cloudflare Turnstile bot challenge on signup form (v7.10.14). |
| `Home.jsx` | Public landing page — hero section, feature grid, CTA |
| `Privacy.jsx` | Privacy policy (static) |
| `Terms.jsx` | Terms of service (static) |

**Components (`/components/`)**

| File | Purpose |
|------|---------|
| `AuthContext.jsx` | Global auth provider — session, subscription, settings. Supabase client initialized with `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. `visibilitychange` listener refreshes token on PWA foreground. |
| `OnboardingChecklist.jsx` | 3-page new-user setup wizard: Welcome → Role Selector (saves `dashboard_config` preset) → Data Import Guide → Setup Checklist. Role step saves to settings API. Completion state in localStorage. |
| `control-center/DashboardTab.jsx` | Dashboard customization tab — role selector (4 types, change confirmation) + widget visibility toggles. Auto-saves to `dashboard_config` in settings. |
| `TransactionDrawer.jsx` | Transaction form — create/edit/delete + receipt upload. New transactions open empty (no pre-filled 0.00). Account source dropdown built dynamically from `userSources` prop (user's own imported data). `SOURCE_LABELS` map + `formatSourceKey()` for display. Double-tap guard. Auto-closes on save. |
| `AssistantSidebar.jsx` | AI chat panel — floating sidebar for financial Q&A |
| `CategorySelect.jsx` | Shared category dropdown — optgroups (Expense/Income/Misc) for built-in + user custom categories (✦ marker). Accepts `customCats` prop. |
| `PlaidLink.jsx` | Plaid Link SDK — account connection, sync, disconnect |
| `ModalContext.jsx` | Branded modal provider — replaces native browser confirm/alert |

**Hooks (`/hooks/`)**

| File | Purpose |
|------|---------|
| `useExpenseFilters.js` | Shared filtering + sorting logic for Transactions, Dashboard, Tax pages |
| `useFilterOptions.js` | Extracts unique vendors, accounts, categories from expense data — feeds filter dropdowns and `TransactionDrawer` source list |
| `useActivityPulse.js` | Daily engagement tracking |
| `useLeadsRealtime.js` | Supabase Realtime subscription for live lead notifications |

**Constants (`/constants/`)**

| File | Purpose |
|------|---------|
| `categories.js` | Single source of truth for all built-in category groups |
| `billing.js` | ✅ v7.10.11 — shared `deriveTier()` + `PLAID_EXEMPT_IDS`. Mirrors `api/routes/stripe.js`'s copy — no shared package exists across the frontend/backend boundary, keep both in sync by hand. |

**Control Center (`/components/control-center/`)**

| File | Purpose |
|------|---------|
| `ProfileTab.jsx` | Business profile — company name, tax ID, invoice branding, signature |
| `IntelligenceTab.jsx` | AI Brain — Gemini key management, repair triggers, feature toggles |
| `AutomationTab.jsx` | Rule automation — create/manage classification rules |
| `CategoriesTab.jsx` | User category management — create/rename/delete custom categories; review & import orphan freeform categories from transactions (v7.10.6) |
| `InfrastructureTab.jsx` | System health — DB checks, mailer readiness, activity logging |
| `AdminTab.jsx` | Admin-only consolidated panel — sub-nav between SaaS Management, System Logs, Security. |
| `SaasTab.jsx` | SaaS admin — split into 3 tabs as of v7.10.14: Active Members, Invite Codes, Engagement Pulse (matches `SystemLogsTab.jsx`'s underline-tab pattern). Admin-only. |
| `SystemLogsTab.jsx` | Admin log viewer — Receipt Email Sessions / All Events tabs, filters, live 30s auto-refresh. |
| `SecurityReviewTab.jsx` | Security review cadence — weekly/monthly/quarterly/annual/dependency tiers with checklists and history. |
| `HelpTab.jsx` | Help & FAQ — troubleshooting, support links, feedback form (merged in v7.9.3) |
| `IntegrationTab.jsx` | Website Lead Capture management — generate/revoke intake API keys, copy env vars, view integration code snippet. |
| `ChangeLogModal.jsx` | Version changelog — release notes display |

### Database — SQL Schemas

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Core tables: expenses, classification_rules, mileage_logs, mileage_rates |
| `supabase_schema_rls.sql` | Row-Level Security policies for multi-tenant isolation |
| `supabase_schema_settings.sql` | User settings table (profile, API keys, preferences, `dashboard_config` JSONB added v7.9.1) |
| `supabase_schema_activity.sql` | Daily user activity tracking |
| `supabase_schema_leads.sql` | CRM leads & clients with relationships |
| `supabase_schema_plaid.sql` | Plaid integration tables (items, accounts, sync cursors) |
| `supabase_schema_intake_keys.sql` | `intake_keys` table — per-user API keys for website lead capture |
| `api/migrations/009_user_categories.sql` | `user_categories` table — per-user custom expense/income categories (v7.10.6) |
| `supabase_fix_admin_rls.sql` | Adjusts RLS on admin-only tables for server-side service role access |

---

## Key Data Patterns

- **Currency**: Stored as `amount_cents` (BIGINT). All UI conversion: `amount_cents / 100`. `$75 threshold = 7500 cents`.
- **Dates**: `expense_date` (expenses), `log_date` (mileage), `purchase_date` (assets). Always `YYYY-MM-DD`. iOS date formats normalized via `z.preprocess()` in Zod schema.
- **Equipment**: `cost_cents` (BIGINT), `description` (name), `depreciation_method`, `useful_life_years`.
- **Sources**: The `source` field on expenses is a string key identifying the import origin. It is user-scoped — the source dropdown in TransactionDrawer is built dynamically from the user's own data, not from a hardcoded list. Display labels are handled by `SOURCE_LABELS` in `TransactionDrawer.jsx` and `ACCOUNT_LABELS` in `Transactions.jsx`. Known keys: `manual`, `plaid`, `rocketmoney`, `chase`, `usbank`, `bankofamerica`, `wellsfargo`, `applecard`, `capitalone`, `usaa`, `navyfcu`, `wise`, `delta_amex`, `amex_gold`, `amex_platinum`, `amex_blue`. Unknown keys fall back to `formatSourceKey()` (capitalizes underscored key).
- **Dedup**: CSV import uses three-pass detection — exact match (`date|vendor|amount_cents`) + fuzzy cross-source match (`date|amount_cents`) + near-duplicate detection (vendor substring match, date ±1 day, amount diff ≤$50 AND ≤40% of lower). Near-duplicates are flagged `needs_review = true` with a shared `review_pair_id` UUID.
- **Receipts**: Stored as relative paths in Supabase Storage. Always accessed via `/api/receipts/signed-url?path=` endpoint. Never direct storage URLs.
- **Cache**: `fetchAllExpenses` uses in-memory stale-while-revalidate. `getExpensesCache()` exported for component-level detection.
- **Import clock**: `daysSinceImport` in `Transactions.jsx` computes the most recent `created_at` across non-manual expenses only. Manual entries do not reset the clock.
- **Missing doc threshold**: MISSING DOC badge displays only when `amount_cents > 7500` AND `tax_deductible = true` AND `receipt_link` is null. Applied to both mobile card view and desktop Doc column.

---

## Supported Bank Import Profiles

| Key | Bank |
|-----|------|
| `rocketmoney` | Rocket Money |
| `chase` | Chase |
| `usbank` | US Bank |
| `bankofamerica` | Bank of America |
| `wellsfargo` | Wells Fargo |
| `applecard` | Apple Card |
| `capitalone` | Capital One |
| `usaa` | USAA |
| `navyfcu` | Navy Federal |
| `wise` | Wise |
| `universal` | Generic CSV fallback |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side admin access (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Yes | Public client-side auth |
| `VITE_SUPABASE_URL` | Yes | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Frontend Supabase key |
| `JWT_SECRET` | Yes | Token signing |
| `RESEND_API_KEY` | No | Email delivery (invoices, reports). Active key labeled "LumiereLedger" in Resend dashboard. |
| `RESEND_FROM` | No | Sender address — must use `@throughthelens.media` domain. `lumiereledger.com` is NOT a verified Resend sending domain (costs $20/mo extra). Use: `Lumière Ledger <support@throughthelens.media>` |
| `PLAID_CLIENT_ID` | Yes | Plaid banking integration — ✅ set, live in production |
| `PLAID_SECRET` | Yes | Plaid API secret — ✅ set |
| `ENCRYPTION_KEY` | Yes | Plaid token encryption (libsodium) — ✅ set, live |
| `CRON_SECRET` | Yes | Admin cron job authentication |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Google Maps mileage automation |
| `REDIS_URL` | No | Not set — intentional, Bull removed v7.8.90, direct Resend fallback in use |
| `TURNSTILE_SECRET_KEY` | No | ⚠️ Added v7.10.14, **not yet set in Vercel** — Cloudflare Turnstile bot-challenge verification fails open (harmless) until set |
| `LUMIERE_INTAKE_SECRET` | No | Legacy single-owner intake secret (env fallback for backward compat) |

---

## System Reliability & Monitoring

| Layer | Type | Action | Purpose |
|-------|------|--------|---------|
| **Layer 1** | UptimeRobot | External HTTP ping | 5-minute ping to `/api/health`. Alerts on complete server/Vercel failure. |
| **Layer 2** | Vercel Cron | `vercel.json` → `/api/admin/watchdog` | Daily at 8am UTC. Internal check of Supabase DB and Resend SMTP. Sends `🚨 URGENT: Lumière Ledger Alert`. Hobby plan = daily crons only. |

---

## Mobile / PWA Requirements

- App is installable as a PWA from `lumiereledger.com`
- Manifest: `/web-react/public/manifest.json` — name, icons, `display: standalone`
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` in `index.html`
- Layout classes: `.mobile-only` (hidden on desktop), `.desktop-only` (hidden on mobile)
- All tap targets: minimum 44×44px — never smaller
- Date inputs: `colorScheme: 'dark'` on input element + `filter: brightness(0) invert(1)` on `::webkit-calendar-picker-indicator` in `index.css`
- File upload: never use `capture="environment"` — forces camera-only and blocks gallery/file picker access
- Session: `autoRefreshToken: true` + `persistSession: true` + `visibilitychange` listener in `AuthContext.jsx` prevents PWA logout on app close

---

## Acceptance Criteria

- [x] **Data Integrity**: Newest transactions processed first. Cross-source dedup on import. Safe auto-pagination prevents row truncation.
- [x] **Privacy**: RLS enforces tenant isolation. `requireRole()` uses service role for `user_roles` lookup. Admin UUID verified.
- [x] **Multi-tenant accounts**: Source dropdown in Add Transaction is built from the user's own imported data — not a hardcoded shared list. Each user sees only their accounts.
- [x] **Mobile UX**: Decimal/numeric keyboards. White calendar icon visible against dark background. Amount field opens empty on new transactions. Tax Deductible and Recurring flags on one line. Receipt upload allows gallery + file picker (not camera-forced). Drawer auto-closes on save. Double-tap guard on Save button.
- [x] **PWA session**: Users are not logged out when closing and re-opening the app. Token refreshes on foreground via `visibilitychange`.
- [x] **Missing doc threshold**: MISSING DOC badge appears only on deductible transactions over $75 with no receipt — on both mobile and desktop.
- [x] **Import clock**: Days-since-import badge reflects actual bank/CSV imports only. Manual entries do not reset the clock.
- [x] **Resilience**: Gemini 503 errors trigger automatic retries. Receipt signed URL fetched on demand. Licensing middleware fail-closed (503, not pass-through).
- [x] **Branding**: All AI feedback uses branded persona. No raw JSON in user-facing messages. Styled modal replaces browser alert.
- [x] **CRUD Complete**: Transactions created, read, updated, deleted. Receipt attached, viewed, and securely fetched.
- [x] **Tax Alignment**: Categories map to IRS Schedule C. Mileage uses current IRS rates.
- [x] **Bank Import**: 11+ CSV formats with auto-detection and dedup.
- [x] **Performance**: Stale-while-revalidate cache shows first 25 rows instantly on cold start.
- [x] **Admin Access**: `requireRole('admin')` correctly routes the admin user via service role DB lookup.
- [x] **Website Lead Capture**: Multi-tenant intake key system routes external booking forms into the CRM in real time.
- [x] **Client Deduplication**: Returning clients link to existing records — no duplicate contacts.
- [x] **Real-Time Notifications**: Supabase Realtime subscription fires in-app toast + badge on new lead INSERT.
- [x] **Add-On Marketplace**: `/addons` page surfaces available and coming-soon platform extensions.
- [x] **Plaid Sync**: Live bank auto-sync — billing gate, real libsodium encryption, pending→posted merge-in-place, reconnect flow.
- [x] **Subscription Billing**: Free / Sync / Core / Studio tiers live via Stripe, self-serve checkout confirmed as a real flow.
- [x] **Rebrand domain**: `www.lumiereledger.com` is the live primary domain; `app.throughthelens.media` 301-redirects to it.
- [x] **Bot signup protection**: Trial signup gated on email confirmation (DB trigger level); Cloudflare Turnstile on signup form (needs `TURNSTILE_SECRET_KEY` in Vercel to activate).
- [ ] **User-Defined Accounts**: Settings page where users name their own accounts. Source dropdown reads from accounts table. (See `ROADMAP.md` Phase 5.)
- [ ] **Plaid webhook support**: Currently polls `itemGet` during sync only — doesn't catch every Plaid-side failure mode (confirmed via Venmo investigation 2026-07-01). See `ROADMAP.md` Technical Debt.

---

## Non-Goals (Current Phase)
- Global data sharing or anonymous benchmarking.
- Hosting user-uploaded high-res photo galleries.
- Real-time stock portfolio tracking.
- Multi-currency conversion (single-currency per user).

---

## Commands

| Command | Purpose |
|---------|---------|
| `cd api && npm start` | Start backend server |
| `cd web-react && npm run dev` | Start frontend dev server |
| `cd web-react && npm run build` | Production build |
| `git push origin main` | Deploy to Vercel (auto-build triggers on push) |
