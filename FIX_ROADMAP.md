# Fix Roadmap — All Phases

**Last updated:** 2026-04-14

> See `REBRAND_ROADMAP.md` for the Lumière Ledger migration plan (May 2026).

---

## Status Legend
- ✅ Done
- 🔲 Not started
- ⚠️ Partial / needs verification

---

## Phase 1 & 2 — Security Hardening ✅

| Item | Status | Notes |
|------|--------|-------|
| Supabase RLS Lockdown | ⚠️ | Policies written. Full activation pending final verification. |
| Query param auth removed from admin.js | ✅ | `req.query.auth` bypass removed |
| RLS bypass fixed in admin.js | ✅ | `.neq("id", "-1")` removed |
| Email queueing implemented | ✅ | `emailQueue.js` created with direct fallback |
| ESM/CommonJS Compatibility Fix | ✅ | `file-type` and `resend` downgraded to CJS versions |
| RLS Safety Guards | ✅ | Defensive checks in Metrics and Licensing prevent 500s |
| `requireRole()` uses service role client | ✅ | Bypasses RLS on `user_roles` table — fixes admin 403 |
| Admin UUID corrected | ✅ | Updated to `49e7efcb-6434-4f0c-9563-3151a6d50df9` in auth.js |
| `user_roles` table created | ✅ | Joshua inserted as admin |
| Plaid token encryption | ⚠️ | `cryptoUtil.js` is a stub — real implementation deferred until Plaid work begins |

---

## Phase 3 — Mobile & UX Fixes ✅

| Item | Status | Notes |
|------|--------|-------|
| iOS date validation fix | ✅ | `z.preprocess()` normalizes `MM/DD/YYYY` and ISO strings → `YYYY-MM-DD` |
| Receipt upload on mobile | ✅ | Date fix unblocks iOS receipt uploads |
| Receipt "View Doc" button | ✅ | Now calls `/api/receipts/signed-url` via `apiGet()` with auth headers |
| Receipt error modal | ✅ | Uses branded `modal.alert()` instead of browser `alert()` |
| Double-tap save bug | ✅ | `saving` guard added to TransactionDrawer — disables button during async |
| Drawer auto-close on save | ✅ | `onClose()` fires after full save + receipt upload |
| `onSave` race condition | ✅ | `onSave()` moved after receipt upload completes |
| Persistent Subscription Ignoral | ✅ | `vendor_settings` DB table active |
| Safe Metrics Pagination | ✅ | Auto-paginator overcomes Supabase 1,000 row limit |
| Multi-Timeframe Filtering | ✅ | Full Year / Last Year / YTD / Current Month |

---

## Phase 4 — Performance & UX Polish ✅

| Item | Status | Notes |
|------|--------|-------|
| Stale-while-revalidate cache | ✅ | Shows cached data instantly, refreshes in background |
| Cold start first-25 fast load | ✅ | `GET /expenses?limit=25` renders immediately on first visit |
| `getExpensesCache()` exported | ✅ | Components can detect warm cache without private variable access |
| Days-since-last-import badge | ✅ | Color-coded indicator in Transaction Ledger header (green/yellow/red) |
| Remove duplicate mobile Add button | ✅ | Only "+ ADD TRANSACTION" in header remains |
| Remove logo from page headers | ✅ | Logo only in top nav bar and public landing page |
| Business Analytics header cleanup | ✅ | Removed logo from DashboardV2 page header |

---

## Environment / Ops

| Item | Status | Notes |
|------|--------|-------|
| `api/.env` with real credentials | ✅ | Was missing entirely |
| Root `.env` placeholder cleanup | ✅ | Duplicate values removed |
| `file-type` CJS (16.5.4) | ✅ | ESM conflict resolved |
| `resend` CJS (2.1.0) | ✅ | ESM conflict resolved |
| Vercel: `VITE_GOOGLE_MAPS_API_KEY` | ✅ | Set in Vercel Dashboard |
| Vercel: `REDIS_URL` | ⚠️ | **ACTION REQUIRED** — add to enable email queueing |
| Vercel: `ENCRYPTION_KEY` | 🔲 | Deferred — required for Plaid |

---

## Validation Checklist

**Security:**
- [ ] `curl /admin/beta-codes` with no token → 401
- [ ] Same with non-admin token → 403
- [ ] Same with Joshua's token → 200
- [ ] File upload `.exe` → rejected
- [ ] File upload `.pdf` → accepted
- [ ] Receipt "View Doc" opens file in new tab (not dashboard redirect)

**Mobile:**
- [ ] iOS date format `MM/DD/YYYY` accepted on submit
- [ ] Receipt uploads from iPhone work end-to-end
- [ ] Tapping Save once closes drawer and adds correct ledger entry
- [ ] Double-tap Save does NOT create a blank duplicate

**Performance:**
- [ ] Returning to Ledger tab shows data instantly (no blank screen)
- [ ] Days-since-import badge visible and correct color
- [ ] Cold load shows first 25 rows before full dataset arrives

---

## Optional Cleanup (Low Priority)

1. `mailer.js` — Stream large attachments instead of buffering (1 hr)
2. `invoices.js` — Combine invoice notes parsing logic (20 min)
3. `admin.js` — Cache daily report user mapping (1 hr)
4. Write local dev setup doc: env setup, how to run both servers

---

## Deferred (Plaid — 2+ months out)

- `cryptoUtil.js` — Replace stub with real `libsodium-wrappers` async implementation
- `plaid.js` — Batch sync, Promise.all syncs, Plaid-specific validation
- Vercel: add `ENCRYPTION_KEY` to production env

---

## May 2026 — Lumière Ledger Rebrand

See full plan in `REBRAND_ROADMAP.md`.

| Item | Status |
|------|--------|
| Domain purchased: `lumiereleadger.com` | 🔲 |
| Google Cloud OAuth redirect updated | 🔲 |
| Supabase auth redirect URL updated | 🔲 |
| Vercel new domain configured | 🔲 |
| All "Studio Tracker" UI text replaced | 🔲 |
| New logo deployed | 🔲 |
| Old domain `app.throughthelens.media` retired | 🔲 |
