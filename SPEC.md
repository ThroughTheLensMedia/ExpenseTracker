# Studio Tracker v4.3 — Master Engineering Specification

### Objective
The world's most elite, AI-driven financial command center for professional photographers and creative freelancers. Studio Tracker enables automated expense forensics, retroactive ledger repair, tax-aligned reporting, invoicing, asset depreciation, mileage tracking, and strategic business advice — all powered by a private "Bring Your Own Brain" (BYOB) architecture.

---

### Constraints
1. **Architecture**: Full-stack Node.js (Express 4.19 API) + React 19 (Vite 7.3 frontend).
2. **Database**: Supabase / PostgreSQL with Row-Level Security (RLS) for 100% multi-tenant data isolation.
3. **AI Engine**: Google Gemini 2.5 Flash. Users supply their own Gemini API keys (privacy + cost control).
4. **Design System**: Vanilla CSS with Glassmorphism, deep dark mode, and micro-animations. No component library.
5. **Hosting**: Vercel (auto-deploy on push to `main`). Custom domain: `app.throughthelens.media`.
6. **Security**: (IN PROGRESS) Row-Level Security on all user tables. Currently undergoing multi-tenant hardening. Admin-only tables (`beta_codes`, `user_subscriptions`, `user_daily_activity`) use Service Role Key for access.
7. **Payments**: Beta code gating during testing phase. Subscription licensing planned for SaaS launch.

---

### Tech Stack

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

### File Map

#### Backend — `/api/`

| File | Purpose |
|------|---------|
| `server.js` | Express app entry, middleware, route mounting |
| `db.js` | Supabase client init (Service Role Key priority for admin ops) |
| `routes/brain.js` | AI intelligence hub — chat, ledger repair, batch categorization |
| `routes/expenses.js` | Core ledger CRUD — create, read, update, delete transactions |
| `routes/import.js` | CSV import engine — 11+ bank parsers, auto-detection, cross-source dedup |
| `routes/invoices.js` | Invoice CRUD, line items, PDF export, email delivery via Resend |
| `routes/tax.js` | Schedule C tax mapping, depreciation summaries, deduction exports |
| `routes/assets.js` | Equipment tracking — straight-line & Section 179 depreciation |
| `routes/mileage.js` | Mileage log CRUD, IRS standard rate calculations |
| `routes/rules.js` | Auto-classification rules — vendor/notes pattern matching |
| `routes/receipts.js` | Receipt upload to Supabase Storage (date-based folder structure) |
| `routes/plaid.js` | Plaid link tokens, account sync, transaction pull |
| `routes/admin.js` | Admin dashboard — beta codes, subscriptions, daily reports, data exports |
| `routes/settings.js` | User config persistence (API keys, studio defaults, profile) |
| `routes/subscription.js` | Beta code redemption, subscription status tracking |
| `routes/activity.js` | Engagement pulse — daily active minutes tracking |
| `routes/leads.js` | CRM lead/client management |
| `routes/pwa.js` | PWA quick-snap receipt capture endpoint |
| `utils/gemini.js` | Gemini 2.5 Flash init, `repairLedgerBatch()` with 503 retry logic |
| `utils/mailer.js` | Resend email bridge with attachment support |

#### Frontend — `/web-react/src/`

**Pages (`/pages/`)**

| File | Purpose |
|------|---------|
| `Dashboard.jsx` | Executive summary — charts, burn rate, category breakdown, forecasts |
| `Transactions.jsx` | Full ledger — filtering, sorting, audit mode, bulk edit, manual entry |
| `Tax.jsx` | Tax workbench — Schedule C mapping, deduction totals, PDF export |
| `Import.jsx` | Bank import wizard — drag-drop CSV, auto-detect bank format, Plaid (collapsed) |
| `Invoice.jsx` | Invoice builder — line items, client info, tax/discount, PDF, email |
| `Assets.jsx` | Equipment registry — depreciation calculator, purchase/disposal tracking |
| `Mileage.jsx` | Mileage tracker — log by date, IRS rate lookup, yearly summaries |
| `Rules.jsx` | Classification rules editor — vendor matching with retroactive apply |
| `CRM.jsx` | Lead pipeline — kanban board (New Lead, Quoted, Booked), archive |
| `Backup.jsx` | Studio Control Center — 6-tab settings hub (Profile, AI, Automation, Infrastructure, Help, SaaS) |
| `Login.jsx` | Auth — email/password, Google OAuth, beta code signup |
| `Home.jsx` | Landing page — hero section, call-to-action |
| `Privacy.jsx` | Privacy policy (static) |
| `Terms.jsx` | Terms of service (static) |

**Components (`/components/`)**

| File | Purpose |
|------|---------|
| `AuthContext.jsx` | Global auth provider — session, subscription status, settings |
| `TransactionDrawer.jsx` | Transaction form drawer — create/edit/delete with receipt upload |
| `AssistantSidebar.jsx` | AI chat panel — floating sidebar for financial Q&A |
| `CategorySelect.jsx` | Shared category dropdown — optgroups (Expense/Income/Misc), custom entry |
| `PlaidLink.jsx` | Plaid Link SDK — account connection, sync, disconnect |
| `ModalContext.jsx` | Branded modal provider — replaces native confirm/alert dialogs |

**Control Center (`/components/control-center/`)**

| File | Purpose |
|------|---------|
| `ProfileTab.jsx` | Business profile — company name, tax ID, invoice branding, signature |
| `IntelligenceTab.jsx` | AI Brain — Gemini key management, repair triggers, feature toggles |
| `AutomationTab.jsx` | Rule automation — create/manage classification rules |
| `InfrastructureTab.jsx` | System health — DB checks, mailer readiness, activity logging |
| `SaasTab.jsx` | SaaS dashboard — Plaid links, subscriptions, beta codes |
| `HelpTab.jsx` | Help & FAQ — troubleshooting, support links |
| `ChangeLogModal.jsx` | Version changelog — release notes display |

#### Database — SQL Schemas (project root)

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Core tables: expenses, classification_rules, mileage_logs, mileage_rates |
| `supabase_schema_rls.sql` | Row-Level Security policies for multi-tenant isolation |
| `supabase_schema_settings.sql` | User settings table (profile, API keys, preferences) |
| `supabase_schema_activity.sql` | Daily user activity tracking |
| `supabase_schema_leads.sql` | CRM leads & clients with relationships |
| `supabase_schema_plaid.sql` | Plaid integration tables (items, accounts, sync cursors) |
| `supabase_fix_admin_rls.sql` | Disables RLS on admin-only tables for server-side access |

---

### Key Data Patterns

- **Currency**: Stored as `amount_cents` (BIGINT). All UI conversion uses `amount_cents / 100`.
- **Dates**: `expense_date` (expenses), `log_date` (mileage), `purchase_date` (assets). Always `YYYY-MM-DD`.
- **Equipment**: `cost_cents` (BIGINT), `description` (name), `depreciation_method`, `useful_life_years`.
- **Sources**: `manual`, `plaid`, `rocketmoney`, `chase`, `usbank`, `bankofamerica`, `wellsfargo`, `applecard`, `capitalone`, `usaa`, `navyfcu`, `wise`.
- **Dedup**: CSV import uses two-pass detection — exact match (`date|vendor|amount_cents`) + fuzzy cross-source match (`date|amount_cents`).

---

### Supported Bank Import Profiles

| Key | Bank | Notes |
|-----|------|-------|
| `rocketmoney` | Rocket Money | Positive = expense, negative = income |
| `chase` | Chase | Negative amounts = expenses |
| `usbank` | US Bank | Single Amount column |
| `bankofamerica` | Bank of America | Negative amounts = expenses |
| `wellsfargo` | Wells Fargo | Standard activity export |
| `applecard` | Apple Card | iPhone Wallet export |
| `capitalone` | Capital One | Separate Debit/Credit columns |
| `usaa` | USAA | Date, Description, Amount format |
| `navyfcu` | Navy Federal | Transaction and Post date headers |
| `wise` | Wise | Multi-currency, merchant headers |
| `universal` | Generic | Fallback — matches Date, Amount, Vendor headers |

---

### Environment Variables

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
| `CRON_SECRET` | No | Admin cron job authentication |
| `CF_TUNNEL_TOKEN` | No | Cloudflare tunnel |

---

### Acceptance Criteria

- [x] **Data Integrity**: Newest transactions processed first during AI repairs. Cross-source duplicates detected on import. Safe auto-pagination prevents row truncation.
- [/] **Privacy**: (HARDENING IN PROGRESS) Row-Level Security enforces complete tenant isolation. User A never sees User B's data.
- [x] **Mobile UX**: Decimal/numeric keyboards for currency fields. Dark-mode calendar icons. Scrollable modals.
- [x] **Resilience**: Gemini 503 errors trigger automatic retries before surfacing failure.
- [x] **Branding**: All AI feedback uses "Studio Assistant" persona. No raw JSON in user-facing messages.
- [x] **CRUD Complete**: Transactions can be created, read, updated, and deleted from the UI.
- [x] **Tax Alignment**: Expense categories map to IRS Schedule C line items. Mileage uses current IRS rates.
- [x] **Bank Import**: 11+ bank CSV formats supported with auto-detection and cross-source dedup.
- [x] **Operational Intelligence**: Multi-timeframe metrics filtering (Full Year, Last Year, YTD, Current Month), predictive cash flow, and persistent active vendor ignoral states seamlessly bypass performance latency.
- [ ] **Plaid Sync**: Live bank auto-sync (pending Plaid account approval).
- [ ] **Subscription Billing**: Paid SaaS tier with Stripe integration.

---

### Non-Goals
- Global data sharing or anonymous benchmarking (until Phase 4).
- Hosting user-uploaded high-res photo galleries (metadata tracking only).
- Real-time stock portfolio tracking.
- Multi-currency conversion (single-currency per user for now).

---

### Commands

| Command | Purpose |
|---------|---------|
| `cd api && npm start` | Start backend server |
| `cd web-react && npm run dev` | Start frontend dev server |
| `cd web-react && npm run build` | Production build |
| `git push origin main` | Deploy to Vercel (auto-build) |
