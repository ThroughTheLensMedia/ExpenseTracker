# Lumière Ledger — Claude Operational Brief

**Read this file first. Then read `ROADMAP.md` and `SPEC.md` before touching any code.**

---

## Current State

| Property | Value |
|----------|-------|
| **Version** | v7.3.8 |
| **Status** | Active Development — Pre-SaaS Launch |
| **Deploy target** | `www.lumiereledger.com` (primary) — `app.throughthelens.media` 301 redirects to it |
| **Deployment** | Vercel (auto-deploy on `git push origin main`) |
| **Database** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Owner** | Joshua Deuermeyer — Through The Lens Media, Las Vegas NV |

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

## Deploy Workflow

```
1. Make changes in /web-react/src or /api/routes
2. Update CHANGELOG.md
3. Update SPEC.md (if architecture/stack changed)
4. Commit: "v7.3.5 — Short title\n\n- file.jsx — why\n- Update CHANGELOG.md"
5. git push origin main → Vercel auto-builds and deploys
```

No manual build step. Vercel runs `npm run build` automatically.

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
    ├── Plaid (banking — pending approval)
    └── Google Maps API (mileage automation — in progress)
```

**Multi-tenant:** Every user table has `user_id UUID` referencing `auth.users`. RLS enforces `user_id = auth.uid()` on all operations. The Express API adds `.eq('user_id', req.user.id)` as defense-in-depth. The service role key (server-side only) bypasses RLS only for admin lookups and `user_roles`.

---

## External Service Connections

### Supabase
- **Plan:** Free
- **Free plan limits:** 500MB database, 1GB file storage, 50MB max upload, 2 active projects. **Projects pause after 7 days of inactivity** — auth token refresh will fail while paused, causing user logouts. The daily watchdog cron keeps the project active.
- **Purpose:** PostgreSQL database, Auth (email/password + Google OAuth), Storage (receipts), Realtime (live lead notifications)
- **Admin UUID:** `49e7efcb-6434-4f0c-9563-3151a6d50df9`
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server — bypasses RLS), `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Key behavior:** `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. PWA uses `visibilitychange` listener to refresh token on foreground.
- **Auth redirect URLs:** `https://www.lumiereledger.com/**` is allowlisted (added 2026-05-14). `app.throughthelens.media` remains active during parallel-run period.
- **Storage:** Receipts stored as relative paths, always accessed via `/api/receipts/signed-url?path=`. Never use direct Storage URLs.

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
  - ⚠️ `REDIS_URL` — **NOT YET SET** — required to activate email queueing
  - ⚠️ `ENCRYPTION_KEY` — **NOT YET SET** — required before Plaid goes live
  - Optional: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `APP_URL`, `LUMIERE_INTAKE_SECRET`
- **Deploy tokens (local .env only — never commit):**
  - `VERCEL_TOKEN` — Vercel personal access token (`vcp_...`). Used for CLI deploys if GitHub webhook fails.
  - `GITHUB_TOKEN` — GitHub PAT with `repo` scope. Used by Cowork agent to push commits.
  - **Webhook note:** If auto-deploy stops, go to Vercel → project → Settings → Git → Disconnect → Reconnect `ThroughTheLensMedia/ExpenseTracker`.

### Resend
- **Purpose:** Transactional email — invoices, daily admin reports, beta invitations, feedback
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM`
- **Verified sending domain:** `throughthelens.media` ONLY. `lumiereledger.com` is NOT verified — Resend silently drops all mail from unverified domains (API returns 200, nothing delivers).
- **Correct `RESEND_FROM`:** `Lumière Ledger <support@throughthelens.media>` — branded display name, verified sending domain.
- **⚠️ Known gap:** `api/server.js` line 115 and `api/utils/mailer.js` line 32 have hardcoded fallback `support@lumiereledger.com`. If `RESEND_FROM` env var is ever missing, email silently breaks. Fix pending (see ROADMAP.md Launch Gate).
- **Queueing:** `emailQueue.js` exists with direct fallback. Redis-backed queuing not yet active (`REDIS_URL` missing in Vercel).

### Google Gemini 2.5 Flash
- **Purpose:** AI financial intelligence — chat, ledger repair, batch categorization
- **Model:** `@google/generative-ai` — Gemini 2.5 Flash
- **BYOB Architecture:** Users supply their own Gemini API keys. Stored per-user in settings table.
- **Reliability:** 503 errors trigger automatic retries via `repairLedgerBatch()` in `utils/gemini.js`
- **Persona:** "Lumière Assistant" — not "Studio Assistant"
- **Note:** All AI features use Gemini exclusively. No OpenAI or other providers.

### Plaid (Pending)
- **Status:** API built (`api/routes/plaid.js`, `PlaidLink.jsx`). **Hard-blocked — do not activate:**
  - Plaid account approval pending
  - `cryptoUtil.js` is a stub — replace with real `libsodium-wrappers` async implementation
  - `ENCRYPTION_KEY` not set in Vercel

### Google Cloud Console (OAuth + Maps)
- **OAuth:** Google sign-in. `lumiereledger.com` added to authorized domains + redirect URIs (done 2026-05-16).
- **Maps API:** `VITE_GOOGLE_MAPS_API_KEY` set in Vercel. Powers mileage A→B→A round-trip (in progress).

### UptimeRobot
- **Purpose:** Layer 1 external monitoring — pings `/api/health` every 5 minutes.

---

## Known Code Gaps (not yet fixed — see ROADMAP.md)

| Gap | File | Impact |
|-----|------|--------|
| `ALLOWED_ORIGINS` missing `https://www.lumiereledger.com` | `api/server.js` | CORS failures on new domain |
| `APP_URL` fallback still `app.throughthelens.media` | `api/routes/invoices.js` line 236 | Pay portal links in emails point to old domain |
| Mailer fallback from-address `support@lumiereledger.com` | `api/server.js` line 115, `api/utils/mailer.js` line 32 | Email silent-fails if `RESEND_FROM` env var missing |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `SPEC.md` | **Master engineering spec — read before every session** |
| `CHANGELOG.md` | Version history — update on every change |
| `ROADMAP.md` | **Single source of truth for all roadmap, fixes, and launch gate** |

> `FIX_ROADMAP.md` and `LAUNCH_FIXES.md` are archived — `ROADMAP.md` supersedes both.

### Backend Entry Points
| File | Purpose |
|------|---------|
| `api/server.js` | Express entry — middleware, route mounting, CORS config |
| `api/db.js` | Supabase service role client (bypasses RLS — server-side only) |
| `api/middleware/auth.js` | JWT auth + `requireRole()` using service role client |
| `api/middleware/licensing.js` | Subscription gate — fail-closed (503 on DB error, not pass-through) |
| `api/utils/emailQueue.js` | Email queue with direct Resend fallback |
| `api/utils/mailer.js` | Resend email bridge — invoices, invites, alerts |

### Critical Frontend Files
| File | Purpose |
|------|---------|
| `web-react/src/components/AuthContext.jsx` | Global auth + session persistence. Exports `supabase` client. |
| `web-react/src/pages/DashboardV2.jsx` | Business analytics — KPIs, charts, forecasts |
| `web-react/src/pages/Transactions.jsx` | Full ledger — filtering, sorting, audit, near-duplicate review |
| `web-react/src/components/TransactionDrawer.jsx` | Transaction form — CRUD, receipt upload, dynamic source dropdown |
| `web-react/src/pages/Backup.jsx` | Ledger Control Center — SaaS, feedback, integrations, profile tabs |

---

## Data Patterns (Quick Reference)

| Pattern | Rule |
|---------|------|
| Currency | Stored as `amount_cents` (BIGINT). UI: `amount_cents / 100`. $75 threshold = 7500 cents |
| Discount | `discount_cents` stores percent×100 (basis points). Divide by 10000 to get fraction. e.g. `500 = 5%` → `500 / 10000 = 0.05` |
| Dates | Always `YYYY-MM-DD`. iOS formats normalized via `z.preprocess()` in Zod schema |
| Sources | `source` field is user-scoped. Display via `SOURCE_LABELS` + `formatSourceKey()` fallback |
| Dedup | Three-pass: exact (`date|vendor|amount_cents`) + fuzzy cross-source (`date|amount_cents`) + near-duplicate (vendor substring + ±1 day + ≤$50 diff) |
| Receipts | Stored as relative paths. Always access via `/api/receipts/signed-url?path=`. Never use direct Storage URLs. |
| Missing doc | Badge fires when: `amount_cents > 7500` AND `tax_deductible = true` AND `receipt_link` is null |
| Import clock | `daysSinceImport` ignores `source === 'manual'` — only bank/CSV imports reset the clock |

---

## Security Rules

- **Never pass the Supabase service role key to the frontend**
- `requireRole()` uses the service role client to bypass RLS on `user_roles` lookup only
- `isLocalDev` in `auth.js` uses AND logic: `!process.env.VERCEL && process.env.NODE_ENV !== 'production'` — dev bypass cannot activate on Vercel
- Licensing middleware fail-closed: DB error → 503, not pass-through
- All destructive operations (DELETE) include `.eq('user_id', req.user.id)` as defense-in-depth beyond RLS
- `cryptoUtil.js` is a stub — do not use in production

---

## PWA / Mobile Requirements

- Minimum tap target: 44×44px on all interactive elements
- Calendar icon: `filter: brightness(0) invert(1)` + `colorScheme: 'dark'` for dark-mode visibility
- File upload: **never use `capture="environment"`** — forces camera-only, blocks gallery/file picker
- Session persistence: `autoRefreshToken: true` + `persistSession: true` + `visibilitychange` listener
- PWA manifest: `web-react/public/manifest.json` — name, icons, `display: standalone`
