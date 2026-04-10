# Fix Roadmap — Phase 1 & 2

**Last updated:** 2026-04-08

---

## Status Legend
- ✅ Done
- 🔲 Not started
- ⚠️ Partial / needs verification

---

## Immediate Blockers

| Item | Status | Notes |
|------|--------|-------|
| Supabase RLS Lockdown | ⚠️ | **CRITICAL**: Tables were publicly accessible. Plan approved. |
| Query param auth removed from admin.js | ✅ | `req.query.auth` bypass removed |
| RLS bypass fixed in admin.js | ✅ | `.neq("id", "-1")` removed |
| Email queueing implemented | ✅ | `emailQueue.js` created, Bull-based (with Direct Fallback) |
| ESM/CommonJS Compatibility Fix | ✅ | Downgraded `file-type` and `resend` to fix server-start crash |
| RLS Safety Guards (userId/id) | ✅ | Defensive checks added to Metrics and Licensing to prevent 500s |
| Plaid token encryption | ⚠️ | `cryptoUtil.js` is a **stub** — throws if called. Real libsodium-wrappers implementation required when Plaid work begins (2+ months out) |

---

## Environment / Ops (NOT in original roadmap — fix before deploying)

| Item | Status | Notes |
|------|--------|-------|
| `api/.env` created with real Supabase credentials | ✅ | File was missing entirely |
| Root `.env` duplicate placeholder lines removed | ✅ | Placeholder values were overriding real credentials |
| `file-type` CJS (16.5.4) installed | ✅ | Version 22.x removed (ESM conflict) |
| `resend` CJS (2.1.0) installed | ✅ | Version 6.x removed (ESM conflict) |
| `user_roles` table created in Supabase | ✅ | Table created, Joshua inserted as admin. |
| Redis running locally for Bull queue | ✅ | Bull will automagically fallback to direct mail if Redis is missing |
| Vercel env vars: `REDIS_URL` | ⚠️ | **ACTION REQUIRED**: Add to Vercel panel to enable queueing |
| Vercel env vars: `ENCRYPTION_KEY` | 🔲 | Not in Vercel production env panel — required for future Plaid |

**user_roles table SQL (run in Supabase if missing):**
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Insert Joshua as admin (replace with actual user_id from auth.users)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'joshua.deuermeyer@gmail.com'
ON CONFLICT DO NOTHING;
```

---

## Phase 1 & 2 Fixes (Hardening)

| Item | Status | Notes |
|------|--------|-------|
| 1A: `requireRole()` and admin.js hardening | ✅ | All 10 admin routes protected |
| 1B: File type validation & Pagination | ✅ | JPEG/PNG/PDF whitelist added; Invoice pagination active |
| 2A: Signed URLs & Atomic Redemptions | ✅ | Private receipt storage + Race condition fix |
| 2B: URL Scheme validation & Gemini Chunking | ✅ | Blocks javascript: links; 500-txn AI safety buffer |
| 2C: Gemini Data Minimization | ✅ | ~60% reduction in AI state overhead |
| 3A: Supabase RLS Activation | ⚠️ | **Approved**. Generating SQL migration. |
| 3B: Backend Multi-Tenant Audit | ✅ | **Completed**. Hardened assets, rules, and secured global IRS mileage endpoints with admin scopes. |

---

## Phase 3 Operations (Dashboard & UX Hardening)

| Item | Status | Notes |
|------|--------|-------|
| 1A: Persistent Subscription Ignoral | ✅ | `vendor_settings` DB table active, frontend integrated and cached. |
| 1B: Safe Metrics Pagination | ✅ | Overcame Supabase 1,000 row limits using range auto-paginator. |
| 1C: Dynamic Multi-Timeframe Arrays | ✅ | 'Full Year', 'Last Year', 'YTD', 'Current Month' filter integrated instantly via backend mapping logic. |
| 1D: UI Architecture Safety & Labeling | ✅ | Restored missing Forecast blocks, removed syntax errors, and clarified 'Recurring Vendors' naming convention. |

---

## Validation Checklist

**Phase 1 (before marking done):**
- [ ] `user_roles` table exists in Supabase with Joshua as admin
- [ ] `SELECT * FROM user_roles LIMIT 1` returns data (not error)
- [ ] `curl localhost:3000/admin/beta-codes` → 401 (no token)
- [ ] Same with non-admin token → 403
- [ ] Same with Joshua's token → 200
- [ ] File upload with `.exe` → rejected
- [ ] File upload with `.pdf` → accepted
- [ ] `GET /api/invoices` returns `pagination.total`, `pagination.hasMore`
- [ ] Redis running: `redis-cli ping` → PONG
- [ ] Email queue: trigger a report, confirm job queued (check Bull dashboard or logs)

**Phase 2 (before marking done):**
- [ ] Receipt URLs return signed URL with TTL (not public URL)
- [ ] Concurrent beta code redemptions: only one succeeds
- [ ] Contact form email: no raw `<` characters in HTML output
- [ ] Invoice URL with `javascript:` scheme → rejected
- [ ] Gemini payload excludes `user_id` and `invoice_id`

---

## Optional Cleanup (Low Priority)

1. `auth.js` — Remove or gate dev bypass to localhost only (15 min)
2. `mailer.js` — Stream large attachments instead of buffering (1 hour)
3. `invoices.js` — Combine invoice notes parsing logic (20 min)
4. `admin.js` — Cache daily report user mapping (1 hour)
5. Write local dev setup doc: Redis install, env setup, how to run both api and web-react

---

## Deferred (Plaid — 2+ months out)

- `cryptoUtil.js` — Replace stub with real `libsodium-wrappers` async implementation
- `plaid.js` — Batch sync (1B-3)
- `plaid.js` — Promise.all syncs (1C)
- `plaid.js` — Plaid-specific data validation (2B-3)
- Vercel: add `ENCRYPTION_KEY` to production env
