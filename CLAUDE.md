# Lumière Ledger — Claude Operational Brief

**Read this file first. Then read `SPEC.md` before touching any code.**

---

## Current State

| Property | Value |
|----------|-------|
| **Version** | v7.3.0 |
| **Status** | Active Development — Pre-SaaS Launch |
| **Deploy target** | `lumiereledger.com` (rebrand in progress from `app.throughthelens.media`) |
| **Deployment** | Vercel (auto-deploy on `git push origin main`) |
| **Database** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Owner** | Joshua Deuermeyer — Through The Lens Media, Las Vegas NV |

---

## Non-Negotiable Rules

1. **Update `CHANGELOG.md` on every change** — version number, date, plain-English description. No exceptions. No silent commits.
2. **Update `SPEC.md`** if architecture, file map, tech stack, data patterns, or acceptance criteria change.
3. **Only modify files explicitly in scope** — do not touch unrelated files.
4. **Never guess** — if something is unclear, ask Joshua before proceeding.
5. **One file per response, max 500 lines** — if output is truncated, wait for "CONTINUE".
6. **Preserve existing working logic** — do not refactor what isn't broken.
7. **Database changes must be idempotent** — never write a migration that fails on re-run or destroys data.

---

## Deploy Workflow

```
1. Make changes in /web-react/src or /api/routes
2. Update CHANGELOG.md
3. Update SPEC.md (if architecture/stack changed)
4. Commit: "v7.2.1 — Short title\n\n- file.jsx — why\n- Update CHANGELOG.md"
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
- **Purpose:** PostgreSQL database, Auth (email/password + Google OAuth), Storage (receipts), Realtime (live lead notifications)
- **Admin UUID:** `49e7efcb-6434-4f0c-9563-3151a6d50df9`
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server — bypasses RLS), `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Key behavior:** `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. PWA uses `visibilitychange` listener to refresh token on foreground.
- **Auth redirect URLs:** Must be allowlisted in Supabase → Settings → Auth. Currently includes `app.throughthelens.media`. Add `lumiereledger.com` before domain switch.
- **Storage:** Receipts stored as relative paths, always accessed via `/api/receipts/signed-url?path=`. Never use direct Storage URLs.

### Vercel
- **Purpose:** Hosting, auto-deploy, cron jobs
- **Deploy:** Push to `main` branch — Vercel builds and deploys automatically
- **Cron:** `vercel.json` → `GET /api/admin/watchdog` runs hourly. Checks Supabase DB + Resend SMTP. Sends alert email on failure.
- **Required env vars in Vercel Production Panel:**
  - ✅ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - ✅ `JWT_SECRET`
  - ✅ `RESEND_API_KEY`, `RESEND_FROM`
  - ⚠️ `REDIS_URL` — **NOT YET SET** — required to activate email queueing
  - ⚠️ `ENCRYPTION_KEY` — **NOT YET SET** — required before Plaid goes live
  - ⚠️ `CRON_SECRET` — confirm present (`vercel env ls`)
  - ⚠️ `NODE_ENV=production` — confirm explicitly set
  - Optional: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `VITE_GOOGLE_MAPS_API_KEY`, `LUMIERE_INTAKE_SECRET`

### Google Gemini 2.5 Flash
- **Purpose:** AI financial intelligence — chat, ledger repair, batch categorization
- **Model:** `@google/generative-ai` — Gemini 2.5 Flash
- **BYOB Architecture:** Users supply their own Gemini API keys (privacy + cost control). Stored per-user in settings table.
- **Reliability:** 503 errors trigger automatic retries via `repairLedgerBatch()` in `utils/gemini.js`
- **Persona:** "Lumière Assistant" (ensure all references use this — not "Studio Assistant")
- **Note:** All AI features use Gemini exclusively — no OpenAI or other providers

### Resend
- **Purpose:** Transactional email — invoices, daily admin reports, beta invitations
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM`
- **Files:** `api/utils/mailer.js` — email bridge with attachment support
- **Queueing:** Redis-backed queueing planned but not yet active (missing `REDIS_URL` in Vercel)

### Plaid (Pending)
- **Purpose:** Live bank account sync — transactions pulled automatically
- **Status:** API integration built (`api/routes/plaid.js`, `PlaidLink.jsx`). **Blocked by:**
  - Plaid account approval (pending)
  - `cryptoUtil.js` is a **stub** — replace with real `libsodium-wrappers` async implementation before going live
  - `ENCRYPTION_KEY` not yet set in Vercel
- **Do not use `cryptoUtil.js` in production in its current state**

### Google Cloud Console (OAuth + Maps)
- **OAuth:** Used for Google sign-in. GCP project name: update to "Lumiere Ledger" before rebrand.
- **Required GCP updates for rebrand:**
  - Add `lumiereledger.com` to Authorized Domains
  - Add `https://lumiereledger.com/auth/callback` to Authorized Redirect URIs
  - Keep `app.throughthelens.media` entries active during parallel-run period
- **Maps API:** `VITE_GOOGLE_MAPS_API_KEY` — Powers mileage A→B→A round-trip automation (in progress). Add `lumiereledger.com/*` to allowed referrers before domain switch.

### UptimeRobot
- **Purpose:** Layer 1 external monitoring — pings `/api/health` every 5 minutes. Alerts on complete server/Vercel failure.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `SPEC.md` | **Master engineering spec — read before every session** |
| `CHANGELOG.md` | Version history — update on every change |
| `ROADMAP.md` | Product roadmap with active sprint priorities |
| `REBRAND_ROADMAP.md` | Domain migration plan (`app.throughthelens.media` → `lumiereledger.com`) |
| `FIX_ROADMAP.md` | Tactical fix tracking across all phases |
| `LAUNCH_FIXES.md` | Security hardening checklist (Passes 1–11) |

### Backend Entry Points
| File | Purpose |
|------|---------|
| `api/server.js` | Express entry — middleware, route mounting |
| `api/db.js` | Supabase service role client (bypasses RLS — server-side only) |
| `api/middleware/auth.js` | JWT auth + `requireRole()` using service role client |
| `api/middleware/licensing.js` | Subscription gate — fail-closed (503 on DB error, not pass-through) |

### Critical Frontend Files
| File | Purpose |
|------|---------|
| `web-react/src/components/AuthContext.jsx` | Global auth + session persistence. Exports `supabase` client. |
| `web-react/src/pages/DashboardV2.jsx` | Business analytics — KPIs, charts, forecasts |
| `web-react/src/pages/Transactions.jsx` | Full ledger — filtering, sorting, audit, import clock badge |
| `web-react/src/components/TransactionDrawer.jsx` | Transaction form — CRUD, receipt upload, dynamic source dropdown |

---

## Roadmap Summary (as of 2026-05-14)

### 🔥 Blocking — Must Ship Before SaaS Launch
- [ ] Purchase and configure `lumiereledger.com` domain
- [ ] Update Google OAuth redirect URIs for new domain
- [ ] Update Supabase auth redirect allowlist for new domain
- [ ] Add `REDIS_URL` to Vercel (email queueing)
- [ ] Final multi-tenant RLS audit
- [ ] Run all Post-Hardening Validation tests in `LAUNCH_FIXES.md`
- [ ] Select final logo concept (3 ready — decision needed)

### ⏭ Next Sprint
- Maps Autopilot — Google Maps A→B→A mileage round-trip (in progress)
- Stripe subscription billing
- Fast Receipt Processing — Vision model auto-extract on drag-drop
- User-Defined Accounts (Phase 5 — see `ROADMAP.md` for full spec)

### 🔭 Backlog
- Plaid live bank sync (pending approval + `cryptoUtil.js` real impl + `ENCRYPTION_KEY`)
- AI Function Calling — write to DB from chat ("Studio Hands")
- RAG document indexing — PDF receipts, contracts
- Semantic search via pgvector
- Phase 6: Website Builder add-on, Client Portal, Contract E-Sign

---

## Data Patterns (Quick Reference)

| Pattern | Rule |
|---------|------|
| Currency | Stored as `amount_cents` (BIGINT). UI: `amount_cents / 100`. $75 threshold = 7500 cents |
| Dates | Always `YYYY-MM-DD`. iOS formats normalized via `z.preprocess()` in Zod schema |
| Sources | `source` field is user-scoped. Display via `SOURCE_LABELS` + `formatSourceKey()` fallback |
| Dedup | Two-pass: exact (`date|vendor|amount_cents`) + fuzzy cross-source (`date|amount_cents`) |
| Receipts | Stored as relative paths. Always access via `/api/receipts/signed-url?path=` |
| Missing doc | Badge: `amount_cents > 7500` AND `tax_deductible = true` AND `receipt_link` null |
| Import clock | `daysSinceImport` ignores `source === 'manual'` — only bank/CSV imports reset the clock |

---

## Security Rules

- **Never pass the Supabase service role key to the frontend**
- `requireRole()` uses the service role client (admin client) to bypass RLS on `user_roles` lookup only
- `isLocalDev` check in `auth.js` uses AND logic: `!process.env.VERCEL && process.env.NODE_ENV !== 'production'` — dev bypass cannot activate on Vercel
- Licensing middleware is fail-closed: DB error → 503, not pass-through
- All destructive operations (DELETE) include `.eq('user_id', req.user.id)` as defense-in-depth beyond RLS
- `cryptoUtil.js` is a stub — do not use in production

---

## PWA / Mobile Requirements

- Minimum tap target: 44×44px on all interactive elements
- Calendar icon: `filter: brightness(0) invert(1)` + `colorScheme: 'dark'` for dark-mode visibility
- File upload: **never use `capture="environment"`** — forces camera-only, blocks gallery/file picker
- Session persistence: `autoRefreshToken: true` + `persistSession: true` + `visibilitychange` listener
- PWA manifest: `web-react/public/manifest.json` — name, icons, `display: standalone`
