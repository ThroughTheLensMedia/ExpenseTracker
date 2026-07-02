# Lumière Ledger — Claude Operational Brief

**Read this file first. Then read `ROADMAP.md`, `SPEC.md`, and `SERVICES.md` before touching any code.**

> `SERVICES.md` — master list of every connected external service, what it does, its cost model, and dashboard link. Before adding any new service or dependency, check it first. If a service is removed, update it. This is the guardrail against over-engineering.

---

## Current State

| Property | Value |
|----------|-------|
| **Version** | v7.10.20 |
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
4. **Update `SPEC.md`** if architecture, file map, tech stack, data patterns, or acceptance criteria change.
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
4. Update SPEC.md (if architecture/stack changed)
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
- **Maps API:** `VITE_GOOGLE_MAPS_API_KEY` set in Vercel. Powers mileage A→B→A round-trip (in progress).

### UptimeRobot
- **Purpose:** Layer 1 external monitoring — pings `/api/health` every 5 minutes.

---

## Known Code Gaps (not yet fixed — see ROADMAP.md)

| Gap | File | Impact |
|-----|------|--------|
| Plaid webhook backfill not run | `api/scripts/backfill-plaid-webhooks.js` | Shipped v7.10.16. New connections auto-register the webhook; existing connections (Amex, Capital One, USAA, Venmo) need this one-time script run to get real-time health events. |
| `REDIS_URL` not set in Vercel | Vercel env panel | Bull removed v7.8.90 — direct Resend fallback is intentional. Set only if re-enabling queue layer. |
| `plaid_account_id` backfill | `expenses` table | Pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Sub-account breakdown unavailable on historical rows until users re-sync. |
| `file-type` moderate vuln | `api/routes/receipts.js` | v22 is ESM-only; needs dynamic `import()` refactor. Near-zero real risk (ASF audio only). |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `SPEC.md` | **Master engineering spec — read before every session** |
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
| Plaid billing exempt | `PLAID_BILLING_EXEMPT` from `api/constants.js` (single source of truth as of v7.10.11). Joshua + Michelle Gornichec (`fcb92809-70f1-4ae0-b39c-e317378a01a7`). Frontend mirror: `web-react/src/constants/billing.js`. |
| Dashboard config | `dashboard_config JSONB` on `settings` table. Shape: `{ role, widgets: { invoices, forecast, performance_chart, top_expenses, insights, operational_intelligence } }`. Defaults all-on if null. Widget flag: `!== false`. |
| Trial signup gate | New `auth.users` rows only get an active `user_subscriptions` row once `email_confirmed_at` is set (v7.10.13). No `profiles` table exists anywhere — use `listAllUsers()` from `api/utils/userDirectory.js` for any "all users" lookup. |

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
