# Lumière Ledger v7.2 — Master Engineering Specification

> ✅ **REBRAND COMPLETE**: This product has been transitioned to **Lumière Ledger** (`lumiereledger.com`) as of May 2026.

**Current version:** v7.2.0
**Last updated:** 2026-05-13

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
The world's most elite, AI-driven financial command center for professional photographers and creative freelancers. Enables automated expense forensics, retroactive ledger repair, tax-aligned reporting, invoicing, asset depreciation, mileage tracking, and strategic business advice — all powered by a private "Bring Your Own Brain" (BYOB) architecture.

Multi-tenant SaaS: every user's data is fully isolated via Supabase Row-Level Security. Each user sees only their own transactions, leads, settings, and receipts.

---

## Constraints
1. **Architecture**: Full-stack Node.js (Express 4.19 API) + React 19 (Vite 7.3 frontend).
2. **Database**: Supabase / PostgreSQL with Row-Level Security (RLS) for 100% multi-tenant data isolation.
3. **AI Engine**: Google Gemini 2.5 Flash. Users supply their own Gemini API keys (privacy + cost control).
4. **Design System**: Vanilla CSS with Glassmorphism, deep dark mode, and micro-animations. No component library.
5. **Hosting**: Vercel (auto-deploy on push to `main`). Migrating from `app.throughthelens.media` → `lumiereledger.com`.
6. **Security**: Row-Level Security active on all user tables. `requireRole()` middleware uses service role client to bypass RLS on `user_roles` lookup. Admin UUID: `49e7efcb-6434-4f0c-9563-3151a6d50df9`.
7. **Payments**: Beta code gating during testing phase. Stripe subscription billing planned for SaaS launch.
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
| Backend | Node.js, Express 4.19, Multer (uploads), Zod (validation), csv-parser |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Email | Resend (transactional invoices, daily reports, invitations) |
| Banking | Plaid API (pending approval), CSV import (11+ bank profiles) |
| Auth | Supabase Auth (email/password, Google OAuth), JWT + JWKS validation |

---

## File Map

### Backend — `/api/`

| File | Purpose |
|------|---------|
| `server.js` | Express app entry, middleware, route mounting |
| `db.js` | Supabase client init (Service Role Key for admin ops) |
| `routes/brain.js` | AI intelligence hub — chat, ledger repair, batch categorization |
| `routes/expenses.js` | Core ledger CRUD — create, read, update, delete transactions. Zod `z.preprocess` normalizes iOS date formats. |
| `routes/import.js` | CSV import engine — 11+ bank parsers, auto-detection, cross-source dedup |
| `routes/invoices.js` | Invoice CRUD, line items, PDF export, email delivery via Resend |
| `routes/tax.js` | Schedule C tax mapping, depreciation summaries, deduction exports |
| `routes/assets.js` | Equipment tracking — straight-line & Section 179 depreciation |
| `routes/mileage.js` | Mileage log CRUD, IRS standard rate calculations |
| `routes/rules.js` | Auto-classification rules — vendor/notes pattern matching |
| `routes/receipts.js` | Receipt upload to Supabase Storage. Signed URL endpoint for secure access. |
| `routes/plaid.js` | Plaid link tokens, account sync, transaction pull |
| `routes/admin.js` | Admin dashboard — beta codes, subscriptions, daily reports, data exports |
| `routes/settings.js` | User config persistence (API keys, studio defaults, profile) |
| `routes/subscription.js` | Beta code redemption, subscription status tracking |
| `routes/activity.js` | Engagement pulse — daily active minutes tracking |
| `routes/leads.js` | CRM lead/client management |
| `routes/intake.js` | **Public** server-to-server endpoint — receives leads from external websites. Validates `x-intake-secret`, resolves owning user via `intake_keys` table (falls back to legacy env var), deduplicates clients by email, inserts lead. No auth required. |
| `routes/intake-keys.js` | **Authenticated** CRUD for per-user intake API keys. `GET /intake-keys`, `POST /intake-keys` (generates `ll-` prefixed UUID key), `DELETE /intake-keys/:id`. |
| `routes/pwa.js` | PWA quick-snap receipt capture endpoint |
| `middleware/auth.js` | JWT auth + `requireRole()`. Uses adminClient (service role) for role lookups to bypass RLS. |
| `middleware/licensing.js` | Subscription gate — blocks expired/suspended users. Fail-closed: 503 on DB error, not pass-through. |
| `utils/gemini.js` | Gemini 2.5 Flash init, `repairLedgerBatch()` with 503 retry logic |
| `utils/mailer.js` | Resend email bridge with attachment support |
| `utils/cryptoUtil.js` | ⚠️ Stub — real implementation deferred until Plaid work begins. Do not use in production. |

### Frontend — `/web-react/src/`

**Pages (`/pages/`)**

| File | Purpose |
|------|---------|
| `DashboardV2.jsx` | Business Analytics — executive KPIs, charts, forecasts, operational intelligence |
| `Transactions.jsx` | Full ledger — filtering, sorting, audit mode, import clock badge (non-manual only), receipt view via signed URL, MISSING DOC badge for $75+ deductible transactions |
| `Tax.jsx` | Tax workbench — Schedule C mapping, deduction totals, PDF export |
| `Import.jsx` | Bank import wizard — drag-drop CSV, auto-detect bank format, retroactive dedup scanner |
| `Invoice.jsx` | Invoice builder — line items, client info, tax/discount, PDF, email |
| `Assets.jsx` | Equipment registry — depreciation calculator, purchase/disposal tracking |
| `Mileage.jsx` | Mileage tracker — log by date, Google Maps automation, IRS rate lookup |
| `Rules.jsx` | Classification rules editor — vendor matching with retroactive apply |
| `CRM.jsx` | Lead pipeline — kanban board (New Lead, Quoted, Booked), archive |
| `Backup.jsx` | Studio Control Center — 7-tab settings hub |
| `AddOns.jsx` | Add-On Marketplace — lists available and coming-soon platform extensions |
| `Login.jsx` | Auth — email/password, Google OAuth, beta code signup |
| `Home.jsx` | Public landing page — hero section, feature grid, CTA |
| `Privacy.jsx` | Privacy policy (static) |
| `Terms.jsx` | Terms of service (static) |

**Components (`/components/`)**

| File | Purpose |
|------|---------|
| `AuthContext.jsx` | Global auth provider — session, subscription, settings. Supabase client initialized with `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. `visibilitychange` listener refreshes token on PWA foreground. |
| `TransactionDrawer.jsx` | Transaction form — create/edit/delete + receipt upload. New transactions open empty (no pre-filled 0.00). Account source dropdown built dynamically from `userSources` prop (user's own imported data). `SOURCE_LABELS` map + `formatSourceKey()` for display. Double-tap guard. Auto-closes on save. |
| `AssistantSidebar.jsx` | AI chat panel — floating sidebar for financial Q&A |
| `CategorySelect.jsx` | Shared category dropdown — optgroups (Expense/Income/Misc), custom entry |
| `PlaidLink.jsx` | Plaid Link SDK — account connection, sync, disconnect |
| `ModalContext.jsx` | Branded modal provider — replaces native browser confirm/alert |

**Hooks (`/hooks/`)**

| File | Purpose |
|------|---------|
| `useExpenseFilters.js` | Shared filtering + sorting logic for Transactions, Dashboard, Tax pages |
| `useFilterOptions.js` | Extracts unique vendors, accounts, categories from expense data — feeds filter dropdowns and `TransactionDrawer` source list |
| `useActivityPulse.js` | Daily engagement tracking |
| `useLeadsRealtime.js` | Supabase Realtime subscription for live lead notifications |

**Control Center (`/components/control-center/`)**

| File | Purpose |
|------|---------|
| `ProfileTab.jsx` | Business profile — company name, tax ID, invoice branding, signature |
| `IntelligenceTab.jsx` | AI Brain — Gemini key management, repair triggers, feature toggles |
| `AutomationTab.jsx` | Rule automation — create/manage classification rules |
| `InfrastructureTab.jsx` | System health — DB checks, mailer readiness, activity logging |
| `SaasTab.jsx` | SaaS admin — beta codes, subscriptions, engagement pulse. Admin-only. |
| `HelpTab.jsx` | Help & FAQ — troubleshooting, support links |
| `IntegrationTab.jsx` | Website Lead Capture management — generate/revoke intake API keys, copy env vars, view integration code snippet. |
| `ChangeLogModal.jsx` | Version changelog — release notes display |

### Database — SQL Schemas

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Core tables: expenses, classification_rules, mileage_logs, mileage_rates |
| `supabase_schema_rls.sql` | Row-Level Security policies for multi-tenant isolation |
| `supabase_schema_settings.sql` | User settings table (profile, API keys, preferences) |
| `supabase_schema_activity.sql` | Daily user activity tracking |
| `supabase_schema_leads.sql` | CRM leads & clients with relationships |
| `supabase_schema_plaid.sql` | Plaid integration tables (items, accounts, sync cursors) |
| `supabase_schema_intake_keys.sql` | `intake_keys` table — per-user API keys for website lead capture |
| `supabase_fix_admin_rls.sql` | Adjusts RLS on admin-only tables for server-side service role access |

---

## Key Data Patterns

- **Currency**: Stored as `amount_cents` (BIGINT). All UI conversion: `amount_cents / 100`. `$75 threshold = 7500 cents`.
- **Dates**: `expense_date` (expenses), `log_date` (mileage), `purchase_date` (assets). Always `YYYY-MM-DD`. iOS date formats normalized via `z.preprocess()` in Zod schema.
- **Equipment**: `cost_cents` (BIGINT), `description` (name), `depreciation_method`, `useful_life_years`.
- **Sources**: The `source` field on expenses is a string key identifying the import origin. It is user-scoped — the source dropdown in TransactionDrawer is built dynamically from the user's own data, not from a hardcoded list. Display labels are handled by `SOURCE_LABELS` in `TransactionDrawer.jsx` and `ACCOUNT_LABELS` in `Transactions.jsx`. Known keys: `manual`, `plaid`, `rocketmoney`, `chase`, `usbank`, `bankofamerica`, `wellsfargo`, `applecard`, `capitalone`, `usaa`, `navyfcu`, `wise`, `delta_amex`, `amex_gold`, `amex_platinum`, `amex_blue`. Unknown keys fall back to `formatSourceKey()` (capitalizes underscored key).
- **Dedup**: CSV import uses two-pass detection — exact match (`date|vendor|amount_cents`) + fuzzy cross-source match (`date|amount_cents`).
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
| `RESEND_API_KEY` | No | Email delivery (invoices, reports) |
| `RESEND_FROM` | No | Sender email address |
| `PLAID_CLIENT_ID` | No | Plaid banking integration |
| `PLAID_SECRET` | No | Plaid API secret |
| `ENCRYPTION_KEY` | No | ⚠️ Required before Plaid goes live — not yet set |
| `CRON_SECRET` | No | Admin cron job authentication |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Google Maps mileage automation |
| `REDIS_URL` | No | ⚠️ Required to activate email queueing — not yet set in Vercel |
| `LUMIERE_INTAKE_SECRET` | No | Legacy single-owner intake secret (env fallback for backward compat) |

---

## System Reliability & Monitoring

| Layer | Type | Action | Purpose |
|-------|------|--------|---------|
| **Layer 1** | UptimeRobot | External HTTP ping | 5-minute ping to `/api/health`. Alerts on complete server/Vercel failure. |
| **Layer 2** | Vercel Cron | `vercel.json` → `/api/admin/watchdog` | Hourly internal check of Supabase DB and Resend SMTP. Sends `🚨 URGENT: Lumière Ledger Alert`. |

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
- [ ] **Plaid Sync**: Live bank auto-sync (pending Plaid account approval + `ENCRYPTION_KEY` env var).
- [ ] **Subscription Billing**: Paid SaaS tier with Stripe integration.
- [ ] **Rebrand domain**: Full transition to `lumiereledger.com` (in progress — see `REBRAND_ROADMAP.md`).
- [ ] **User-Defined Accounts**: Settings page where users name their own accounts. Source dropdown reads from accounts table. (See `ROADMAP.md` Phase 5.)

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
