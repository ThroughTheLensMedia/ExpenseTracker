# Lumière Ledger — Claude Operational Brief

**Read this file first. Then read `ROADMAP.md` and `SERVICES.md` before touching any code.**

> `SERVICES.md` — master list of every connected external service, what it does, its cost model, and dashboard link. Before adding any new service or dependency, check it first. If a service is removed, update it. This is the guardrail against over-engineering.

> **2026-07-01: `SPEC.md` merged into this file and deleted.** It duplicated most of CLAUDE.md's own sections (Tech Stack ≈ Architecture at a Glance, File Map ≈ Key Files Reference, Key Data Patterns ≈ Data Patterns, Mobile/PWA Requirements — verbatim) under a rule that only conditionally required updating it ("if architecture changed"), which is exactly why it silently drifted 7 versions behind. One file, always read first, version bumped on every deploy — no longer possible to update one and forget the other.

## Objective

The world's most elite, AI-driven financial command center for creative professionals and self-employed freelancers — purpose-built for photographers, but designed to serve any independent operator running their business solo. Enables automated expense forensics, retroactive ledger repair, tax-aligned reporting, invoicing, asset depreciation, mileage tracking, and strategic business advice — all powered by a private "Bring Your Own Brain" (BYOB) architecture. Multi-tenant SaaS: every user's data is fully isolated via Supabase Row-Level Security.

---

## Current State

| Property | Value |
|----------|-------|
| **Version** | v7.26.0 |
| **Status** | Active Development — Open Public Launch |
| **Deploy target** | `www.lumiereledger.com` (primary) — `app.throughthelens.media` 301 redirects to it |
| **Deployment** | Vercel (auto-deploy on `git push origin main`) |
| **Database** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Owner** | Joshua Deuermeyer — Through The Lens Media, Las Vegas NV |

---

## Debug Protocol — No Exceptions

When something is broken or behaving unexpectedly, follow this order. Do not skip steps.

1. **Pull the actual logs first** — Vercel MCP (`get_runtime_logs`), Supabase, browser console, whatever applies to the failure.
2. **Read what they say** — do not theorize before reading the evidence.
3. **State the confirmed root cause** — one sentence, based on what the logs actually show. If logs are unavailable or unclear, say so explicitly and ask how to get them before writing any code.
4. **Propose the fix** — one targeted change, minimum footprint.
5. **Wait for yes** — do not deploy a guess.

**Never write code based on a hypothesis.** Assumptions waste deploys and Joshua's time.

---

## Non-Negotiable Rules

1. **Read `ROADMAP.md` before every session** — understand what's in scope, what's blocked, and what's next before writing a single line of code.
2. **Update `CHANGELOG.md` AND `ChangeLogModal.jsx` on every change** — `CHANGELOG.md` is the engineering record; `web-react/src/components/control-center/ChangeLogModal.jsx` is the in-app user-facing changelog. Both must be updated together on every version bump. Add a new entry at the top of the `RELEASES` array in `ChangeLogModal.jsx` with version, date, color, and user-friendly bullet points. No exceptions. No silent commits.
3. **Check off completed roadmap items** — after any change, update `ROADMAP.md` to mark newly completed items and remove them from the active sprint if done.
4. **Keep this file (CLAUDE.md) current** — if a change touches architecture, the file map, tech stack, data patterns, or Acceptance Criteria below, update the relevant section in the same commit. This file is read first every session — nothing else is a substitute.
5. **Only modify files explicitly in scope** — do not touch unrelated files.
6. **Never guess** — if something is unclear, ask Joshua before proceeding.
7. **One file per response, max 500 lines** — if output is truncated, wait for "CONTINUE".
8. **Preserve existing working logic** — do not refactor what isn't broken.
9. **Database changes must be idempotent** — never write a migration that fails on re-run or destroys data.
10. **Always commit `api/package-lock.json`** — Vercel caches `node_modules` between builds. Without a committed lock file, `npm install` hits the stale cache and skips new packages entirely. Any time a new dependency is added to `api/package.json`, run `npm install` locally inside `api/` first, then commit BOTH `package.json` and `package-lock.json` together. Pushing `package.json` alone will not install the new package on Vercel. **This was the root cause of the v7.6.7 production outage.**
11. **Never add Co-Authored-By trailers.** All commits belong to Joshua Deuermeyer / Through The Lens Media only. Commit format: `"vX.X.X — Short title\n\n- file — why"`. No trailer lines, ever.

---

## Out-of-Scope Request Protocol

Before making any change, check whether the request is within the current sprint scope in `ROADMAP.md`.

**If the request is out of scope:** Do not implement it. Notify Joshua and add it to `ROADMAP.md` under the correct category, then stop and wait for direction.

### Roadmap Categories for Out-of-Scope Items

| Category | Use When |
|----------|----------|
| **Need** | Required for core functionality or launch — will break something if not done |
| **Clean Up** | Technical debt, dead code, naming inconsistencies, structural improvements |
| **Broken** | Something is confirmed not working correctly in production |
| **Good to Have** | Nice UX improvement or feature addition — not blocking anything |

Add the item under the appropriate category in the relevant phase or backlog section with a one-line description of what it is and why it was flagged.

---

## Coding Efficiency Rules

### DEFAULTS
1. Kill filler — Start with the answer. No padding.
2. Match length — Short for simple, full for complex. No fluff.
3. Show options — Give 2-3 approaches first. Wait for my choice.
4. Admit gaps — If unsure, say it before including it.
5. Lock voice — Casual, direct, spoken style. No fluff.

### BEHAVIOR
6. Stay in scope — Only touch what's asked.
7. Ask first — Describe changes and wait for my yes.
8. Confirm destruct — Before deleting, list what's affected and confirm.
9. Hard stops — For deploy, migrate, or major changes, get explicit yes.
10. Show changes — Tell me exactly which files you'll touch.
11. No acting alone — Never send, post, or publish without my yes.
12. Think first — Reason step by step before coding.

### CODING
- Always write clean, well-commented code with good variable names.
- Suggest the simplest solution first that gets the job done.
- Before writing code, ask if I want tests or documentation too.
- After writing code, always suggest the next logical step.
- When I share errors, check ERRORS.md first before suggesting fixes.

### The Big 4
- Ask, don't assume
- Simplest first
- Don't touch unrelated
- Flag uncertainty

---

## Deploy Workflow

```
1. Make changes in /web-react/src or /api/routes
2. ⚠️  If any npm dependency was added/changed in api/package.json:
       cd api && npm install   ← REQUIRED — generates/updates package-lock.json
       git add api/package-lock.json   ← REQUIRED — must be committed with package.json
       Skipping this step = Vercel cache bypass = missing module crash on first request
3. Update CHANGELOG.md AND ChangeLogModal.jsx (both required — see Rule 2)
4. Update this file (CLAUDE.md) if architecture/stack/file map changed (Rule 4)
5. Update version in TWO places (required for user update banner to fire):
   - web-react/public/version.json  → "version": "X.X.X"
   - web-react/src/App.jsx          → CURRENT_VERSION = "X.X.X"  (comment says DEPLOY SOP)
6. Commit: "vX.X.X — Short title\n\n- file.jsx — why\n- Update CHANGELOG.md"
   NEVER add Co-Authored-By trailers.
7. git push origin main → Vercel auto-builds and deploys
```

No manual build step. Vercel runs `npm run build` automatically.

**Version banner:** Users who already have the app open see "UPDATE AVAILABLE — CLICK TO REFRESH" in the header within 5 minutes of a new deploy.

---

## Architecture at a Glance

```
Browser / PWA
    │
    ▼
React 19 + Vite 7.3 (web-react/src/)
    │   Auth via Supabase JS SDK
    │   Charts: Chart.js 4.5
    │   PDF: jsPDF + html2canvas
    │
    ▼
Express 4.19 API (api/)
    │   Auth: JWT + JWKS validation
    │   Validation: Zod
    │   Uploads: Multer
    │
    ├── Supabase (PostgreSQL + RLS + Storage + Realtime)
    ├── Google Gemini 2.5 Flash (BYOB — user provides own API key)
    ├── Resend (transactional email)
    ├── Plaid (✅ LIVE — production banking sync with billing gate)
    └── Google Maps API (mileage automation — in progress)
```

**Multi-tenant:** Every user table has `user_id UUID` referencing `auth.users`. RLS enforces `user_id = auth.uid()` on all operations. The Express API adds `.eq('user_id', req.user.id)` as defense-in-depth. The service role key (server-side only) bypasses RLS only for admin lookups and `user_roles`.

---

## External Service Connections

### Supabase
- **Plan:** Free
- **Free plan limits:** 500MB database, 1GB file storage, 50MB max upload, 2 active projects. **Projects pause after 7 days of inactivity** — auth token refresh will fail while paused, causing user logouts. The daily watchdog cron keeps the project active.
- **Purpose:** PostgreSQL database, Auth (email/password + Google OAuth), Storage (receipts), Realtime (live lead notifications)
- **Admin UUID:** `49e7efcb-6434-4f0c-9563-3151a6d50df9` — single source of truth is `api/constants.js` (`ADMIN_UUID`) as of v7.10.11.
- **Trial signup gate (v7.10.13):** `handle_new_user()` trigger only grants the automatic 30-day `free_beta` trial once `email_confirmed_at` is set — a second trigger (`on_auth_user_confirmed`, `AFTER UPDATE OF email_confirmed_at`) catches email/password signups confirming after the fact. OAuth signups arrive pre-confirmed. Migration: `api/migrations/010_gate_trial_on_email_confirmation.sql`. Root cause this fixed: `user_subscriptions` column defaults (`plan_type='free_beta'`, `status='active'`) meant any signup, confirmed or not, got a working account instantly — exploited by scripted bot signups.
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server — bypasses RLS), `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Key behavior:** `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. PWA uses `visibilitychange` listener to refresh token on foreground.
- **Auth redirect URLs:** `https://www.lumiereledger.com/**` is allowlisted. `app.throughthelens.media` remains active during parallel-run period.
- **Email templates:** ✅ Updated 2026-05-19 — Supabase "Confirm signup" template now branded as Lumière Ledger, explains noreply@mail.app.supabase.io sender.
- **Storage:** Receipts stored as relative paths, always accessed via `/api/receipts/signed-url?path=`. Never use direct Storage URLs.
- **Storage buckets:** `receipts` (public), `documents` (private). Private buckets have no RLS policies — `req.sb` (anon client) will silently fail on all Storage ops. **Always use `adminClient` from `../db` for Storage operations on private buckets.** DB table ops stay on `req.sb`.
- **Tables of note:** `account_aliases` (user display names + hide flags per source key) — added v7.7.1, migration at `api/tests/account-aliases-migration.sql`.

### Vercel
- **Plan:** Free (Hobby)
- **Purpose:** Hosting, auto-deploy
- **Deploy:** Push to `main` branch — Vercel builds and deploys automatically
- **Cron jobs:** Removed — monitored by external system (UptimeRobot). `vercel.json` has `"crons": []`. Do not add crons back without Joshua's direction.
- **Required env vars — Vercel Production Panel:**
  - ✅ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - ✅ `JWT_SECRET`, `CRON_SECRET`, `NODE_ENV=production`
  - ✅ `RESEND_API_KEY`, `RESEND_FROM`
  - ✅ `VITE_GOOGLE_MAPS_API_KEY`
  - ⛔ `GOOGLE_MAPS_SERVER_KEY` — **intentionally NOT set (decision confirmed 2026-07-14)** — Google requires enabling billing on the Cloud project to use the Distance Matrix API, and the billing-enabled-project quota request Joshua submitted would require prepaying for the added connections. Not worth the cost for this feature. The AI Brain's `log_mileage_trip` tool fails closed by design when this is unset: it still logs the trip (0 mi, `needs_review = true`) instead of losing it, and the weekly digest email flags it for Joshua to fill in the real mileage by hand. Do not re-enable or chase this without Joshua's explicit direction — this is a deliberate cost tradeoff, not an unfinished setup step.
  - ✅ `ENCRYPTION_KEY` — set, required for Plaid token encryption
  - ✅ `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=production`
  - ✅ `VITE_SENTRY_DSN` — set, Sentry.io active with Claude API connected
  - ✅ `RECEIPT_HMAC_SECRET` — set, required for per-user receipt forwarding addresses
  - ⚠️ `REDIS_URL` — **NOT SET** — Bull was removed v7.8.90; direct Resend fallback is intentional. Set only if re-enabling queue layer.
  - ⚠️ `TURNSTILE_SECRET_KEY` — **NOT SET as of v7.10.14** — added to Vercel to activate bot-challenge verification on signup. Site key is already live client-side; server verify route fails open until this is set, so it's safe but currently inert.
  - ✅ `POSTMARK_INBOUND_TOKEN` — set. Add `?token=<value>` to Postmark webhook URL: `https://www.lumiereledger.com/api/receipts/email-inbound?token=<POSTMARK_INBOUND_TOKEN>`
  - Optional: `APP_URL`, `LUMIERE_INTAKE_SECRET`
- **Deploy tokens (local .env only — never commit):**
  - `VERCEL_TOKEN` — Vercel personal access token (`vcp_...`). Used for CLI deploys if GitHub webhook fails.
  - `GITHUB_TOKEN` — GitHub PAT with `repo` scope. Used by Cowork agent to push commits.

### Resend
- **Purpose:** Transactional email — invoices, daily admin reports, beta invitations
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM`
- **Verified sending domain:** `throughthelens.media` ONLY. `lumiereledger.com` is NOT verified — Resend silently drops all mail from unverified domains (API returns 200, nothing delivers).
- **Correct `RESEND_FROM`:** `Lumière Ledger <support@throughthelens.media>` — branded display name, verified sending domain.
- **✅ Fixed v7.10.11:** `api/routes/feedback.js` was the one remaining file with a hardcoded fallback pointing at the unverified `support@lumiereledger.com` domain — corrected to `support@throughthelens.media`, matching `server.js` and `mailer.js`.
- **Queueing:** `emailQueue.js` uses inline `withRetry()` (3 attempts, linear backoff) — Bull was removed v7.8.90. No Redis dependency. Direct Resend calls with retry.

### Cloudflare
- **Purpose:** DNS + reverse proxy for `lumiereledger.com` (a real active Zone, not just DNS/MX — confirmed via dashboard screenshot 2026-07-01), plus Turnstile bot-challenge widget on signup.
- **Plan:** Free
- **Turnstile:** site key hardcoded in `web-react/src/pages/Login.jsx` (public, safe to expose). `TURNSTILE_SECRET_KEY` env var required in Vercel for server-side verification (`POST /api/verify-turnstile` in `server.js`) to actually take effect — fails open (allows signup through) if unset, so a missing key can never break real signups, it just means the check is inactive.
- **Limitation:** Turnstile only stops bots that load the real signup page through a browser. It does not stop a script calling Supabase's Auth REST API directly, bypassing the frontend entirely. The email-confirmation gate (see Supabase section below) is what actually neutralizes that pattern.

### Google Gemini 2.5 Flash
- **Purpose:** AI financial intelligence — chat, ledger repair, batch categorization
- **Model:** `@google/generative-ai` — Gemini 2.5 Flash
- **BYOB Architecture:** Users supply their own Gemini API keys. Stored per-user in settings table.
- **Reliability:** 503 errors trigger automatic retries via `repairLedgerBatch()` in `utils/gemini.js`
- **Persona:** "Lumière Assistant" — not "Studio Assistant"
- **SUBSCRIPTIONS RULE:** When user asks about subscriptions/recurring charges, Brain searches ALL categories (no category filter) over 60-90 days for vendor frequency patterns. Never dead-end on zero Software & Subscriptions results.
- **Reasoning tuning (v7.21.3):** both Gemini call sites (`utils/gemini.js`'s `getGeminiModel()` and `routes/brain.js`'s `/ask` handler) explicitly set `generationConfig: { temperature: 0.2 }` — previously unset, running on the API default (~1.0). Lower temperature favors deterministic tool selection and numeric consistency over creative variance.
- ⚠️ **`@google/generative-ai` SDK is EOL (Aug 31, 2025), pinned at v0.24.1.** No further updates will ever ship — Google has moved all new development to the successor `@google/genai` package. This SDK has no `thinkingConfig`/thinking-budget support, and Gemini 3.x model compatibility through it isn't confirmed by Google's current docs. A migration to `@google/genai` is tracked in `ROADMAP.md`'s Technical Debt section — it's the prerequisite for thinking-budget tuning and a user-selectable Gemini model picker (also tracked, blocked on this). Do not add a model picker before this migration lands — there's nothing to pick between yet.

### Plaid ✅ LIVE
- **Status:** Production — fully wired and gated. `PLAID_ENV=production`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `ENCRYPTION_KEY` all set in Vercel.
- **Encryption:** Real `libsodium-wrappers` implementation in `cryptoUtil.js` — async `encrypt()`/`decrypt()`.
- **Billing gate:** `POST /plaid/create-link-token` checks `PLAID_BILLING_EXEMPT` set, then `stripe_customer_id` in `user_subscriptions`. Non-exempt users without billing method → HTTP 402. Frontend shows fee disclosure modal before Plaid Link opens.
- **Exempt users:** `PLAID_BILLING_EXEMPT` — single source of truth is `api/constants.js` as of v7.10.11 (previously duplicated independently in `plaid.js` + `stripe.js` + `SaasTab.jsx`, which had drifted risk). Joshua + Michelle Gornichec (`fcb92809-70f1-4ae0-b39c-e317378a01a7`). Confirmed 2026-07-01: this is exactly and only these two — everyone else pays.
- **Cross-source dedup:** Before inserting Plaid transactions, matches existing CSV rows on `date+amount_cents`, stamps `plaid_transaction_id` onto match — preserves all user enrichment.
- **Accounts page:** Live balances, institution names, sync button, disconnect (Unsync) button, type grouping (Credit/Checking/Manual), synced accounts section at top.
- **Webhook (v7.10.16):** `POST /api/plaid/webhook`, public, mounted before `authMiddleware`, JWT-verified via the `Plaid-Verification` header (not a shared secret like Stripe's). Pushes `ITEM` health events (`ERROR`, `PENDING_EXPIRATION`, `USER_PERMISSION_REVOKED`, `LOGIN_REPAIRED`) in real time instead of relying only on the next sync's `itemGet` poll. New connections register it automatically via `linkTokenCreate`'s `webhook` param; existing connections need `api/scripts/backfill-plaid-webhooks.js` run once.

### Google Cloud Console (OAuth + Maps)
- **OAuth:** Google sign-in. `lumiereledger.com` added to authorized domains + redirect URIs (done 2026-05-16).
- **Maps API:** `VITE_GOOGLE_MAPS_API_KEY` set in Vercel. Powers mileage A→B→A round-trip on the Mileage page (client-side, browser Maps JS SDK).
- **Maps API (server-side, v7.18.0 — intentionally inactive):** `api/utils/googleMaps.js` (`getDrivingDistanceMiles()`) would let the AI Brain's `log_mileage_trip` tool auto-calculate exact mileage server-side, using a separate `GOOGLE_MAPS_SERVER_KEY` (can't reuse the browser `VITE_` key — it's HTTP-referrer-restricted and unusable from Node). Joshua decided not to enable billing for this (Google requires prepaying for the added billing-enabled-project quota) — confirmed 2026-07-14, not a bug. The code fails closed by design: every mileage trip still gets logged (flagged `needs_review` when the calculation can't run), and the weekly digest surfaces those for manual mileage entry. See Vercel env var list above for the full reasoning — don't treat the missing key as something to fix.

### UptimeRobot
- **Purpose:** Layer 1 external monitoring — pings `/api/health` every 5 minutes.

---

## Known Code Gaps (not yet fixed — see ROADMAP.md)

| Gap | File | Impact |
|-----|------|--------|
| `REDIS_URL` not set in Vercel | Vercel env panel | Bull removed v7.8.90 — direct Resend fallback is intentional. Set only if re-enabling queue layer. |
| `plaid_account_id` backfill | `expenses` table | Pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Sub-account breakdown unavailable on historical rows until users re-sync. |
| `file-type` moderate vuln | `api/routes/receipts.js` | v22 is ESM-only; needs dynamic `import()` refactor. Near-zero real risk (ASF audio only). |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Version history — update on every change |
| `ROADMAP.md` | **Single source of truth for all roadmap, fixes, and launch gate** |
| `SERVICES.md` | **All connected external services — read before adding any dependency** |
| `PLAID_BILLING_SPEC.md` | Plaid usage billing design — pricing, exemptions, Stripe flow |
| `STRIPE_ROADMAP.md` | Stripe subscription build plan and feature gate matrix |

> `FIX_ROADMAP.md` and `LAUNCH_FIXES.md` are archived — `ROADMAP.md` supersedes both.

### Backend Entry Points
| File | Purpose |
|------|---------|
| `api/server.js` | Express entry — middleware, route mounting, CORS config, public `/verify-turnstile` |
| `api/db.js` | Supabase service role client (bypasses RLS — server-side only) |
| `api/constants.js` | ✅ v7.10.11 — single source of truth for `ADMIN_UUID`, `MICHELLE_UUID`, `PLAID_BILLING_EXEMPT`. Import from here — do not hardcode a new copy. |
| `api/utils/userDirectory.js` | ✅ v7.10.12 — `listAllUsers()` via Supabase Auth admin API. Use this for "all users with email" — never query a `profiles` table, it doesn't exist. |
| `api/middleware/auth.js` | JWT auth + `requireRole()` using service role client |
| `api/middleware/licensing.js` | Subscription gate — fail-closed (503 on DB error, not pass-through). Has its own `deriveTier()` that intentionally does NOT recognize `sync` as a tier (Sync plan gets free-tier feature limits) — do not "fix" to match `stripe.js`'s version, `TIER_LIMITS` has no `sync` key and it will crash gated routes. |
| `api/utils/emailQueue.js` | Email queue with direct Resend fallback |
| `api/utils/mailer.js` | Resend email bridge — invoices, invites, alerts |
| `api/utils/cryptoUtil.js` | ✅ Real libsodium implementation — async encrypt/decrypt for Plaid tokens |

### Critical Frontend Files
| File | Purpose |
|------|---------|
| `web-react/src/components/AuthContext.jsx` | Global auth + session persistence. Exports `supabase` client. |
| `web-react/src/pages/DashboardV2.jsx` | Business analytics — KPIs, charts, forecasts. Widget flags via `dashboard_config`. Gear panel (⚙️) for inline toggles. |
| `web-react/src/pages/Transactions.jsx` | Full ledger — filtering, sorting, audit, near-duplicate review. Supports `?search=` and `?source=` URL params. |
| `web-react/src/pages/Accounts.jsx` | Accounts overview — type groups, live Plaid balances, sync, disconnect, alias, hide |
| `web-react/src/components/TransactionDrawer.jsx` | Transaction form — CRUD, receipt upload, dynamic source dropdown, 🚩 Flag for Review toggle |
| `web-react/src/pages/Backup.jsx` | Ledger Control Center — 12-tab: SaaS, feedback, integrations, profile, dashboard, etc. |
| `web-react/src/components/OnboardingChecklist.jsx` | 3-step new-user setup guide: role selector → data import → checklist. Shown once on first login. |
| `web-react/src/components/PlaidLink.jsx` | Plaid Link SDK — fee confirmation modal, account connection, sync, disconnect |
| `web-react/src/components/control-center/DashboardTab.jsx` | Dashboard customization — role cards (4 types) + widget toggles. Saves to `settings.dashboard_config`. |
| `web-react/src/constants/billing.js` | ✅ v7.10.11 — shared `deriveTier()` + `PLAID_EXEMPT_IDS` for the frontend. Import from here (`AuthContext.jsx`, `SaasTab.jsx`) — must be kept in sync by hand with `api/routes/stripe.js`'s copy, no shared package exists across the frontend/backend boundary. |
| `web-react/src/pages/Login.jsx` | Auth — email/password, Google OAuth, invite-code signup. Cloudflare Turnstile widget (signup only) as of v7.10.14. |

### Full Frontend File Map (beyond the curated table above)

**Pages (`web-react/src/pages/`)** — `Tax.jsx` (Schedule C mapping, deduction totals, PDF export), `Import.jsx` (CSV wizard, auto-detect, retroactive dedup), `Invoice.jsx` (line items, client info, tax/discount, PDF, email), `Clients.jsx` (v7.23.0 — dedicated client roster: search, open/paid invoice counts, sortable lifetime value, edit-in-place, merge/delete/email; deliberately kept separate from the Clients tab inside `Invoice.jsx` rather than merged), `Assets.jsx` (equipment registry, depreciation calc), `Mileage.jsx` (log by date, Google Maps automation, IRS rate), `Rules.jsx` (classification rules editor, retroactive apply), `CRM.jsx` (lead pipeline kanban), `AddOns.jsx` (marketplace), `Home.jsx` / `Privacy.jsx` / `Terms.jsx` (static/public).

**Hooks (`web-react/src/hooks/`)** — `useExpenseFilters.js` (shared filter/sort for Transactions/Dashboard/Tax; Category + Notes combine as AND by default, or OR via the `categoryNotesMatch` option — added v7.25.2, only Transactions.jsx exposes the toggle, other callers default to AND unchanged), `useFilterOptions.js` (unique vendors/accounts/categories, feeds filter dropdowns + drawer source list), `useActivityPulse.js` (daily engagement tracking), `useLeadsRealtime.js` (Supabase Realtime subscription for live lead notifications).

**Constants (`web-react/src/constants/`)** — `categories.js` (single source of truth for built-in category groups), `billing.js` (see Key Files Reference above).

**Control Center tabs (`web-react/src/components/control-center/`)** — `ProfileTab.jsx`, `IntelligenceTab.jsx` (Gemini key mgmt, repair triggers), `AutomationTab.jsx` (rule CRUD), `CategoriesTab.jsx` (custom categories + orphan import), `InfrastructureTab.jsx` (system health, admin-only), `AdminTab.jsx` (SaaS Mgmt/System Logs/Security sub-nav, admin-only), `SaasTab.jsx` (Active Members/Invite Codes/Engagement Pulse), `SystemLogsTab.jsx`, `SecurityReviewTab.jsx`, `HelpTab.jsx` (FAQ + feedback), `IntegrationTab.jsx` (intake keys), `ChangeLogModal.jsx`.

**Other components** — `AssistantSidebar.jsx` (AI chat panel — renders GFM markdown tables from Brain responses with a per-message Export CSV button, v7.25.0), `CategorySelect.jsx` (shared category dropdown), `ModalContext.jsx` (branded modal, replaces native confirm/alert).

**Backend routes not in the curated table above (`api/routes/`)** — `import.js` (CSV import engine, 11+ bank parsers), `invoices.js`, `tax.js`, `assets.js`, `mileage.js`, `rules.js`, `receipts.js`, `settings.js`, `subscription.js` (beta code redemption), `activity.js`, `leads.js`, `intake.js` (public, server-to-server, validates `x-intake-secret`), `intake-keys.js` (authenticated CRUD for per-user `ll-` prefixed intake keys), `pwa.js` (quick-snap receipt capture), `cron.js` (daily/monthly reports + watchdog), `brain.js` (AI Brain — 11 agentic tools over Gemini 2.5 Flash, `GET /messages` + `POST /ask` with server-side persistent history in `brain_messages`, `POST /repair-ledger` batch categorization).

**Database — SQL Schemas** — `supabase_schema.sql` (expenses, classification_rules, mileage_logs, mileage_rates), `supabase_schema_rls.sql` (RLS policies), `supabase_schema_settings.sql` (settings incl. `dashboard_config`), `supabase_schema_activity.sql`, `supabase_schema_leads.sql`, `supabase_schema_plaid.sql`, `supabase_schema_intake_keys.sql`, `api/migrations/009_user_categories.sql`, `api/migrations/010_gate_trial_on_email_confirmation.sql`, `api/migrations/011_brain_messages.sql` (persistent AI Brain conversation history, RLS-scoped), `supabase_fix_admin_rls.sql`.

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

Plaid-connected accounts use `source: 'plaid'` regardless of institution. Known non-import source keys also seen in the wild: `manual`, `delta_amex`, `amex_gold`, `amex_platinum`, `amex_blue`. Unknown keys fall back to `formatSourceKey()` (capitalizes underscored key) — the dropdown is never hardcoded, it's built from the user's own data.

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
- [x] **Bot signup protection**: Trial signup gated on email confirmation (DB trigger level); Cloudflare Turnstile on signup form, `TURNSTILE_SECRET_KEY` confirmed set — active.
- [x] **Plaid webhook support**: Real-time `ITEM` health events (v7.10.16), JWT-verified, all 8 existing connections backfilled (v7.10.18). Replaces poll-only `needs_reauth` detection.
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

---

## Data Patterns (Quick Reference)

| Pattern | Rule |
|---------|------|
| Currency | Stored as `amount_cents` (BIGINT). UI: `amount_cents / 100`. $75 threshold = 7500 cents |
| Discount | `discount_cents` stores percent×100 (basis points). Divide by 10000 to get fraction. e.g. `500 = 5%` → `500 / 10000 = 0.05` |
| Dates | Always `YYYY-MM-DD`. iOS formats normalized via `z.preprocess()` in Zod schema |
| Sources | `source` field is user-scoped. Display via `SOURCE_LABELS` + `formatSourceKey()` fallback |
| Dedup | Three-pass: exact (`date|vendor|amount_cents`) + fuzzy cross-source (`date|amount_cents`) + near-duplicate (vendor substring + ±1 day + ≤$50 diff) |
| Plaid dedup | Before inserting Plaid transactions, matches existing CSV rows on `date+amount_cents` — stamps `plaid_transaction_id` onto match, skips insert |
| Receipts | Stored as relative paths. Always access via `/api/receipts/signed-url?path=`. Never use direct Storage URLs. |
| Missing doc | Badge fires when: `amount_cents > 7500` AND `tax_deductible = true` AND `receipt_link` is null |
| Import clock | `daysSinceImport` ignores `source === 'manual'` — only bank/CSV imports reset the clock |
| Account aliases | `account_aliases` table: `(user_id, source_key, display_name, visible)`. Upsert via `PUT /api/accounts/alias`. |
| Vendor aliases | `vendor_aliases` table: `(user_id, vendor_key, canonical_name)` (added v7.20.1, `api/migrations/015_billing_cycle_and_vendor_aliases.sql`) — merges vendor name variants (e.g. "Starlink" + "Starlink Internet") for Operational Intelligence recurring-vendor rollups. Upsert/delete via `PUT`/`DELETE /api/vendors/alias`, mergeable from the dashboard's Operational Intelligence table (MERGE button, v7.21.0). |
| Client merge/dedup | Unlike vendors (free-text strings, no real row), `clients` are first-class rows with a real FK — merging reassigns `invoices.client_id` and `leads.client_id` (both `ON DELETE SET NULL`) from the duplicate onto the canonical client, then deletes the duplicate, via `POST /invoices/clients/merge` (v7.22.0). No alias table needed. `DELETE /invoices/clients/:id` blocks with a 400 if the client still has invoices attached — merge is the only path once a client has invoice history. `PATCH /invoices/clients/:id` (v7.23.0) edits a client's own `name`/`email`/`phone`/`address`/`notes` in place (`ClientSchema.partial()`, uses `.maybeSingle()` not `.single()` so a missing client 404s cleanly instead of throwing a raw Postgrest error). Client creation itself still doesn't dedup by email on insert (known gap, see `ROADMAP.md` Clean Up). |
| Recurring vendor cadence | `expenses.billing_cycle` (nullable: `monthly`/`quarterly`/`annual`, added v7.20.1) — set via Transaction Drawer when "Recurring" is checked (v7.21.0). `api/utils/recurringVendors.js`'s `deriveCadenceDays()` uses it if set, else derives cadence from real charge-date gaps (2+ occurrences), else falls back to a naive total/count average flagged `cadenceLabel: 'Unconfirmed'`. Shared by `metrics.js` (dashboard) and `cron.js` (weekly digest forecast) so both agree. |
| Subscription display name | `user_subscriptions.display_name` (added v7.19.1, `api/migrations/014_add_display_name_to_subscriptions.sql`) — admin-settable name override, edited via SaaS Management tab `PATCH /admin/subscriptions/:userId`. Distinct from `account_aliases.display_name` (per-account label) and Auth user metadata. |
| Bulk edit — overwrite vs. append | `PATCH /expenses/bulk-source` and `bulk-category` (v7.26.0) do a blind overwrite — correct, since account/category are single-value fields being reassigned to one new value across the batch. `PATCH /expenses/bulk-notes` (v7.26.0) instead APPENDS a dated entry (`[YYYY-MM-DD] text`) to each row's existing notes — different selected rows likely already hold different notes text, so an overwrite would silently destroy it. General rule: a bulk field update should overwrite only when the field represents one current value being replaced; if the field is free-text that varies per row and accumulates meaning over time (notes, comments, history), append instead. |
| Plaid billing exempt | `PLAID_BILLING_EXEMPT` from `api/constants.js` (single source of truth as of v7.10.11). Joshua + Michelle Gornichec (`fcb92809-70f1-4ae0-b39c-e317378a01a7`). Frontend mirror: `web-react/src/constants/billing.js`. |
| Dashboard config | `dashboard_config JSONB` on `settings` table. Shape: `{ role, widgets: { invoices, forecast, performance_chart, top_expenses, insights, operational_intelligence } }`. Defaults all-on if null. Widget flag: `!== false`. |
| Trial signup gate | New `auth.users` rows only get an active `user_subscriptions` row once `email_confirmed_at` is set (v7.10.13). No `profiles` table exists anywhere — use `listAllUsers()` from `api/utils/userDirectory.js` for any "all users" lookup. |
| Income/spend category exclusion | `api/utils/spendCategories.js` (backend) + `web-react/src/constants/spendCategories.js` (frontend mirror, added v7.23.2) — `INCOME_CATS` (Photo Income, Freelance Income, Reimbursement, Refund, etc.) vs `TRANSFER_CATS` (Internal Transfer, Credit Card Payment, Deposit). `isNonSpendRow()` excludes both from spend totals; `isNonIncomeRow()` excludes only `TRANSFER_CATS` from income totals — real income categories must never be excluded from income (v7.23.1 fix, see Security Rules). **Never write `amount_cents < 0` as a standalone income check anywhere in the app, frontend or backend — a negative amount also covers credit card payments and transfers. Always call `isNonIncomeRow(category, vendor)` first.** New income/transfer category added to `constants/categories.js`? Add it to `INCOME_CATS`/`TRANSFER_CATS` in **both** `spendCategories.js` files in the same commit, or the two will silently disagree (v7.23.2 fix, see Security Rules — this exact drift happened to `cron.js`'s monthly report and the Transactions/TransactionDrawer UI after the v7.23.1 fix only patched the weekly digest). |

---

## Security Rules

- **Never pass the Supabase service role key to the frontend**
- `requireRole()` uses the service role client to bypass RLS on `user_roles` lookup only
- **Supabase Storage on private buckets: always use `adminClient`, never `req.sb`** — `req.sb` is the anon client (user JWT) and silently fails on private buckets with no RLS policies. Import `adminClient` from `../db`. DB table ops stay on `req.sb`. (Root cause of v7.8.71 fix.)
- `isLocalDev` in `auth.js` uses AND logic: `!process.env.VERCEL && process.env.NODE_ENV !== 'production'` — dev bypass cannot activate on Vercel
- Licensing middleware fail-closed: DB error → 503, not pass-through
- All destructive operations (DELETE) include `.eq('user_id', req.user.id)` as defense-in-depth beyond RLS
- Plaid billing gate: `create-link-token` blocks non-exempt users without `stripe_customer_id` — HTTP 402
- **Trial signup gate (v7.10.13):** the automatic 30-day `free_beta` trial only grants once `email_confirmed_at` is set — DB trigger-level, not app-level, so it can't be bypassed by calling the API directly. Self-serve Stripe checkout without a code remains untouched by design (confirmed 2026-07-01).
- **Cloudflare Turnstile on signup (v7.10.14):** `POST /api/verify-turnstile` is public and fails open if `TURNSTILE_SECRET_KEY` is unset — this is intentional so a missing env var never blocks real signups, but it also means the check is a no-op until the key is set in Vercel.
- **RLS policy naming ≠ RLS policy enforcement (v7.10.21):** a policy named `"Service role full access"` on `user_daily_activity` had `qual: true` — RLS doesn't check caller role by name, so it was actually granting universal access, not service-role-only. `service_role` already has `BYPASSRLS` and never needed a policy for this. Dropped in the annual review. When writing a new RLS policy, verify the `qual` clause actually enforces what the name claims — don't trust the label.
- **BYOB Gemini keys encrypted at rest (v7.15.0, migration complete v7.15.5):** `settings.gemini_api_key` is encrypted with the same libsodium/`ENCRYPTION_KEY` pattern as Plaid tokens (`api/utils/cryptoUtil.js`). `decryptOrPlain()` is used at every read site so any future legacy plaintext row would keep working. All existing keys were migrated in production (confirmed via direct SQL, 0 plaintext remaining) via a temporary admin route since `ENCRYPTION_KEY` is Sensitive in Vercel and can't be exported for a local script — same pattern as the v7.10.17 Plaid webhook backfill. Route removed after confirming success.
- **Cross-tenant unique constraints break multi-tenancy (v7.22.0):** `invoices.invoice_number` had a database-wide `UNIQUE` constraint instead of one scoped to the owning user — two completely unrelated accounts could never use the same invoice number, so every new user's suggested first invoice number (`INV-1001`) could only ever belong to one account, total. Found via a real production error (`duplicate key value violates unique constraint`). Fixed with `api/migrations/016_scope_invoice_number_unique_per_user.sql`: dropped the global constraint, replaced with `UNIQUE (user_id, invoice_number)`. General rule: any per-user "unique" field needs the constraint scoped to `user_id` explicitly — a bare `UNIQUE` on a single column is table-wide, not per-tenant.
- **Model-side numerical aggregation is unreliable (v7.16.1):** the AI Brain's `search_transactions` tool only accepted one category filter, so answering "how much have I paid to credit cards" required Gemini to call it twice (once per category) and manually sum the results in prose — it fabricated plausible-looking numbers that didn't match the real ledger (confirmed via direct SQL). Fixed by accepting a comma-separated category list via a single Supabase `.or()` filter, so totals are computed once in code. General rule: never let the model combine numbers across multiple tool calls when a single deterministic query can express the same filter.
- **A shared exclusion set silently dropped real income (v7.23.1):** the v7.14.0 dashboard/digest consistency fix created one `NON_SPEND_CATS` set and used it to skip a row entirely wherever it appeared — correct for spend totals, but it also excluded real income categories (`Photo Income`, `Reimbursement`, etc.) from income totals in both `cron.js`'s weekly digest and `metrics.js`'s dashboard summary. Confirmed against production data: a real Venmo payment (expense id 19503, -$740.63, category `Photo Income`) was invisible to both. Root cause traced by reading the actual `expenses`/`pending_receipts` rows via Supabase MCP before writing any fix — not from a hypothesis. Fixed by splitting into `INCOME_CATS` (never excluded from income) and `TRANSFER_CATS` (excluded from both), with a new `isNonIncomeRow()` check for the income side. General rule: an exclusion set built for one direction (spend) is not automatically safe to reuse for the opposite direction (income) — verify against real rows before trusting a shared filter's semantics in a new context.
- **The v7.23.1 income fix didn't cover every call site — sign-only checks kept recurring (v7.23.2):** `isNonIncomeRow()` was added to fix `cron.js`'s weekly digest, but `cron.js`'s own `buildMonthlyReport()` (the monthly email) still did a bare `amount_cents < 0` with no category check — so a Credit Card Payment counted as income in the monthly report the whole time the weekly digest was already fixed. Two frontend sites (`Transactions.jsx`'s Type column pill, `TransactionDrawer.jsx`'s "Biz Income" label) had the identical bug and had always had it — they couldn't have used `isNonIncomeRow()` because no frontend equivalent of `spendCategories.js` existed to import. Fixed: patched `cron.js:182`, added `web-react/src/constants/spendCategories.js` as a hand-synced frontend mirror (same pattern as `constants/billing.js`), updated both frontend sites to import it. General rule: fixing a bug at the one call site you found doesn't fix the bug class — grep for every other place doing the same naive check (`amount_cents.*< 0`) before considering a "shared source of truth" fix actually done, and if the fix needs to reach the frontend, check whether a frontend-importable version of the logic exists yet.
- **Blank-category negative rows were silently labeled "Income" instead of flagged uncertain (v7.23.4):** investigating the v7.23.2/.3 bug turned up real production rows (Joshua's military retirement pay `DFAS-CLEVELAND RET NET`, VA benefits `VACP TREAS 310 XXVA BENEF`, Wise EUR transfers — 91 rows, ~$36.7K total) that had sat with a blank `category` the entire time; a second user's account had 18 more (`CAPITAL ONE MOBILE PYMT` not caught by `CC_PAYMENT_PATTERN` because it only matched `pmt`, not `pymt`). These were data-quality issues, not code bugs — hand-corrected via scoped, idempotent `UPDATE ... WHERE user_id = ...` statements (mechanically safe vendor-string matches only; P2P/Venmo and ambiguous "other" rows were left for Joshua to review manually, never auto-recategorized). The code fix: widened `CC_PAYMENT_PATTERN` to include `pymt`, AND — the actual structural fix — `Transactions.jsx`'s Type column now shows an orange "Needs Review" badge instead of a confident "Income" label whenever a row is negative-amount with a blank/`Uncategorized` category and isn't already identified as a transfer. General rule: closing today's specific vendor-string gap (regex patching) is whack-a-mole — the durable fix is making the app admit uncertainty (flag for review) instead of asserting a guess as fact whenever the classification can't be made confidently.

---

## ENCRYPTION_KEY Rotation Runbook

**When to rotate:** suspected key leak, annual security review, staff offboarding.

**Script:** `api/scripts/rotate-plaid-tokens.js` — re-encrypts all Plaid access tokens locally.

```bash
# Step 1 — Generate a new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Step 2 — Dry run (no writes)
OLD_ENCRYPTION_KEY=<current_key> ENCRYPTION_KEY=<new_key> node api/scripts/rotate-plaid-tokens.js --dry-run

# Step 3 — Confirm row count looks right, then run live
OLD_ENCRYPTION_KEY=<current_key> ENCRYPTION_KEY=<new_key> node api/scripts/rotate-plaid-tokens.js

# Step 4 — Only after script succeeds with 0 failures:
#   Update ENCRYPTION_KEY in Vercel env panel
#   git push origin main  (triggers redeploy)
#   Verify Plaid sync works for one account
#   Delete OLD_ENCRYPTION_KEY from local .env
```

⚠️ Do NOT update Vercel's `ENCRYPTION_KEY` until the script reports 0 failures. Updating the key before all tokens are re-encrypted will break Plaid sync for those users.

---

## PWA / Mobile Requirements

- Minimum tap target: 44×44px on all interactive elements
- Calendar icon: `filter: brightness(0) invert(1)` + `colorScheme: 'dark'` for dark-mode visibility
- File upload: **never use `capture="environment"`** — forces camera-only, blocks gallery/file picker
- Session persistence: `autoRefreshToken: true` + `persistSession: true` + `visibilitychange` listener
- PWA manifest: `web-react/public/manifest.json` — name, icons, `display: standalone`
