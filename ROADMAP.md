# Lumière Ledger — Master Roadmap

**Version:** v7.5.7 | **Last reviewed:** 2026-05-17  
Source of truth for all sprint work, security status, and product phases. Replaces `FIX_ROADMAP.md` and `LAUNCH_FIXES.md` — those files are archived.

---

## 🚦 Current Status

| Area | State |
|------|-------|
| Security hardening (Passes 1–11) | ✅ Complete — verified in code |
| Email pipeline | ✅ Fixed — `RESEND_FROM` → `support@throughthelens.media` |
| Marketing page | ✅ Live — `throughthelens.media/marketing/lumiere-ledger` |
| Supabase auth redirect | ✅ `https://www.lumiereledger.com/**` allowlisted |
| Domain + rebrand | ✅ Complete |
| Google OAuth updated | ✅ Complete |
| Vercel env vars confirmed | ✅ Complete |
| AI Brain — Phase 2 Steps 1–3 | ✅ Complete — read + write + confirmation UI live |
| AI Brain — conversation memory | ✅ Complete — history sent with each request |
| AI Brain — BYOB onboarding CTA | ✅ Complete — setup card for unconfigured users |
| Post-hardening validation tests | 🔲 Never run — blocking Stripe/Plaid |
| RLS multi-tenant audit | 🔲 Policies written, end-to-end verification pending |

---

## 🔥 Launch Gate — Must Ship Before SaaS Launch

### 1. Remaining Code Gaps

| Item | File | Issue |
|------|------|-------|
| `REDIS_URL` in Vercel | Vercel env panel | Required to activate email queueing |

### 2. Post-Hardening Validation (run after code fixes deployed)

| # | Test | Result |
|---|------|--------|
| 1 | `vercel env ls` — `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NODE_ENV=production` | ✅ Fixed + verified 2026-05-17 |
| 2 | `GET /api/health` → `"key_mode": "ADMIN_PRIVILEGED"` | ✅ Pass |
| 3 | `POST /api/admin/beta-codes` as non-admin → 403 | ⏸ Needs second test account |
| 4 | `DELETE /api/admin/beta-codes/TESTCODE` as non-admin → 403 | ⏸ Needs second test account |
| 5 | Vercel preview deploy + `Authorization: Bearer mock-session` → 401 | ⏸ Needs second test account |
| 6 | Delete expense owned by User A while logged in as User B → 404 or 403 | ⏸ Needs second test account |
| 7 | Invoice with 5% discount on $500 subtotal → $475.00 | ✅ Pass |
| 8 | Kill DB connection mid-request → licensing response → 503 | ⏸ Deferred — hard to simulate safely |
| 9 | Cron triggers daily report email | ✅ Pass — cron-job.org wired, fires 11:59 PM PT daily |
| 10 | Click "EXTEND ACCESS" → Ledger Control Center | ✅ Conditionally verified (code audited) |
| 11 | Invoice approval email has no broken download link | ✅ Pass |

### 3. RLS Multi-Tenant Audit

- [ ] Verify all tables have `user_id = auth.uid()` RLS policies active in Supabase dashboard
- [ ] Test: User A cannot read User B's expenses, leads, invoices, clients
- [ ] Confirm `user_roles` table is service-role-only (no user-facing RLS bypass)

---

## ⏭ Next Sprint

| Item | Notes |
|------|-------|
| Maps Autopilot | In progress — Google Maps A→B→A mileage round-trip |
| Stripe billing | Checkout, webhook, subscription lifecycle. Deferred until launch gate complete. |
| User-Defined Accounts (Phase 5) | Replace dynamic source dropdown with user-managed named accounts |
| Brain — Chart/Analysis Popup (Phase 2 Step 5) | Chart.js modal + Download CSV when user requests visual analysis |

---

## ✅ Completed — Fast Receipt Processing (v7.5.9, 2026-05-17)

| Item | Notes |
|------|-------|
| Receipt scanner at top of transaction form | `TransactionDrawer.jsx` — scan card is first element in form |
| Gemini Vision auto-extraction | `POST /api/receipts/extract` — vendor, amount, date, category, notes returned |
| Image → PDF client-side conversion | jsPDF used in browser before storage — no server round-trip |
| iOS "Scan Documents" support | No `capture` attr on file input — iOS native scanner surfaces automatically |
| No-key graceful fallback | File attaches without extraction if Gemini key is not configured |

---

## ✅ Completed — AI Brain (Phase 2, 2026-05-17)

| Item | Version | Notes |
|------|---------|-------|
| Gemini function calling — 4 read tools | v7.4.4 | `search_transactions`, `get_lead`, `get_invoice_summary`, `get_metrics_snapshot` |
| Confirmation UI — Approve/Reject cards | v7.4.5 | Write tools return `pendingActions[]`; UI gates all writes |
| Write tools — CRM + transactions | v7.4.5 | `create_transaction`, `update_lead_status`, `link_transaction_to_lead` |
| Accounts tool + chat formatting | v7.4.5 | `get_accounts`; markdown rendered in sidebar |
| CRM lead ID fix — write now works | v7.4.6 | `get_lead` was missing `id` in SELECT; Brain couldn't pass UUID to `update_lead_status` |
| Personalized greeting | v7.4.6 | First name from `contact_name` → `business_name` → email prefix |
| Live page refresh after approve | v7.4.7 | `ll:refresh` CustomEvent dispatched after every approved action; CRM, Transactions, Invoices listeners added |
| Shift+Enter multiline input | v7.4.7 | Enter submits; Shift+Enter inserts newline; textarea auto-grows |
| Invoice read + write tools | v7.4.8 | `get_invoice` (by number/client/status) + `update_invoice_status` write tool |
| Multi-invoice support | v7.4.9 | Loop raised 3→6 rounds; one `get_invoice` call per number; description rewritten to prevent combining |
| `search_transactions` returns `id` | v7.4.9 | Enables `link_transaction_to_lead` to receive UUID from prior search |
| `create_transaction` required field guards | v7.4.9 | Missing vendor/amount/date returns error + asks user |
| Invoice schema fix — `clients(name)` join | v7.5.0 | `client_name` column doesn't exist; replaced with Supabase FK join |
| Invoice total computed from line items | v7.5.1 | `total_cents`/`amount_paid_cents` don't exist; all three invoice tools now use `calcTotal()` from `invoice_items` |
| CC payment exclusion from purchase analysis | v7.5.2 | EPAYMENT, ACH PMT, AUTOPAY, etc. excluded when user asks about purchases |
| Category partial match | v7.5.3 | `search_transactions` changed from `.eq()` to `.ilike()` — "Travel" now finds "Travel & Vacation" |
| Full category name list in system prompt | v7.5.3 | 12 categories listed with keywords; Brain passes correct strings |
| Search-before-create rule | v7.5.3 | Brain must check existing ledger before offering `create_transaction` |
| Conversation memory | v7.5.4 | Last 10 messages sent as history; Gemini chat seeded with prior context |
| Junk category exclusion from metrics | v7.5.4 | Internal Transfer + Credit Card Payment excluded from `get_metrics_snapshot` top categories |
| Per-account payment breakdown | v7.5.5 | `search_transactions` returns `source` + `account_breakdown[]`; explicit payment queries show per-card totals |
| Context-sensitive payment rules | v7.5.5 | Payments excluded from general analysis; included with breakdown when explicitly requested |
| Self-describing capabilities | v7.5.6 | CAPABILITIES block in system instruction; "what can you do?" returns accurate full list |
| Updated greeting | v7.5.6 | Invites "what can you do?" on open |
| BYOB setup CTA for unconfigured users | v7.5.7 | Setup card with Google AI Studio link + Control Center link replaces hidden sidebar |

---

## ✅ Completed — Security Hardening (All Passes Verified in Code)

| Pass | Item | File |
|------|------|------|
| 1 | `.env`, `*.sqlite`, `data/` added to `.gitignore` | Root `.gitignore` |
| 2 | `db.js` fails loudly on missing `SUPABASE_SERVICE_ROLE_KEY` | `api/db.js`, `api/server.js` |
| 3 | `isLocalDev` uses AND logic — dev bypass cannot activate on Vercel | `api/middleware/auth.js` |
| 4 | Admin guard (`requireRole('admin')`) on all beta-code routes | `api/routes/admin.js` |
| 5 | DELETE expenses includes `.eq("user_id", req.user.id)` | `api/routes/expenses.js` |
| 6 | Licensing middleware fail-closed — DB error → 503 | `api/middleware/licensing.js` |
| 7 | Discount math fixed: `discountPct = discount_cents / 10000` | `api/routes/invoices.js`, `api/routes/pay.js` |
| 8 | Duplicate catch-all SPA rewrite removed from `vercel.json` | `vercel.json` |
| 9 | `bypass_login=true` URL param removed | `web-react/src/components/AuthContext.jsx` |
| 10 | "EXTEND ACCESS" routes to Control Center | `web-react/src/App.jsx` |
| 11 | Broken "Download PDF" link removed from invoice email | `api/utils/mailer.js` |

---

## ✅ Completed — Infrastructure & Platform

| Item | Version | Notes |
|------|---------|-------|
| Professional Invoicing + PDF + E-Sign | v5.2.0 | |
| Executive Dashboard KPIs | v5.2.0 | |
| RLS fully activated on all tables | v5.2.0 | Verification pending (see Launch Gate) |
| Watchdog cron + UptimeRobot | v5.2.0 | |
| AI Brain base (Gemini 2.5 Flash, BYOB) | v5.2.0 | |
| Mobile UX sprint | v6.x | iOS dates, receipt upload, PWA session persistence, tap targets |
| Import dedup (exact + fuzzy + near-duplicate) | v7.3.2 | |
| Near-duplicate review modal | v7.3.2 | |
| Real-time lead intake (`/api/intake`) | v7.1.0 | |
| Intake key management (per-user `ll-xxxx` keys) | v7.1.0 | |
| Supabase Realtime lead notifications | v7.1.0 | |
| CORS + APP_URL + mailer from-address fixes | v7.3.5 | |
| Nav redesign — groups, no emojis | v7.4.0 | |
| LCC lazy load + system status panel | v7.4.0 | |
| Mark Paid on draft invoices | v7.3.9 | |
| Edit restored on paid invoices | v7.3.9 | |
| Invoice client override fix | v7.3.8 | |
| Save & Send Email button | v7.3.8 | |
| Update notification banner | v7.4.2 | |
| What's New button | v7.4.3 | |

---

## 🧠 Phase 2: AI Agentic Capabilities — Remaining

> **Status: Paused** — Brain is stable. Resuming after Fast Receipt Processing ships. Only easy bug fixes in the meantime.

- [x] **Step 4 — Edit Existing Transactions via AI** ✅ shipped v7.3.9
  - `update_transaction(id, fields)` — rename vendor, change category, fix notes/date/amount
  - Confirmation card with before/after diff

- [ ] **Step 5 — Invoice Creation** (deferred)
  - `create_invoice_draft(client_name, line_items, due_date)` write tool
  - Returns pending confirmation card with line item summary before creating

- [ ] **Step 6 — Brain Chart/Analysis Output Popup** (deferred)
  - Structured chart data returned alongside text when user requests visual analysis
  - AssistantSidebar renders Chart.js modal with Download CSV

---

## 📷 Phase 3: Computer Vision & RAG

- [x] **Fast Receipt Processing** ✅ shipped v7.5.9 — scan at top of transaction form, Gemini Vision auto-fills all fields, image saved as PDF
- [ ] RAG — index uploaded PDF receipts and contracts; extract serial #s, term dates, interest rates
- [ ] Smart Receipt Scanner (deferred) — OpenCV.js edge detection + perspective warp

---

## 🚀 Phase 4: Semantic Memory & Predictive Forecasting

- [ ] Semantic Search — pgvector embeddings for natural language ledger recall
- [ ] Burn Rate Alerts — proactive warnings when monthly velocity exceeds historical average

---

## 🏦 Phase 5: Enterprise Integrations & Account Management

- [ ] **User-Defined Accounts** — named accounts with type, institution, last 4; source dropdown reads from accounts table
- [ ] **Plaid Live Bank Sync** — blocked: Plaid approval + `cryptoUtil.js` real impl + `ENCRYPTION_KEY` in Vercel
- [ ] **Stripe Billing** — checkout, webhooks, subscription lifecycle, Customer Portal

---

## 🧩 Phase 6: Add-On Platform

Foundation shipped (intake keys + marketplace page).

- [ ] Photography Website Builder — Cloudflare Pages template pre-wired to Lumière intake
- [ ] Client Portal — invoices, quote approval, deliverable downloads
- [ ] Contract E-Sign — send/sign/store from CRM with photography templates
- [ ] Add-On Billing — Stripe per-add-on recurring charges

---

## 🔭 Backlog

- Rate limiting on `/subscription/redeem`
- Error tracking (Sentry / Logtail)
- Automated test suite (unit + integration)
- `mailer.js` — stream large attachments instead of buffering
- `admin.js` — cache daily report user mapping

---

## 🚩 Clean Up / Flagged

- **Validation Tests 3 & 4** — Re-run `POST /api/admin/beta-codes` and `DELETE` with a non-admin token to confirm 403. Requires a second test account. Code audit confirmed `requireRole('admin')` is in place — live smoke test only.
- **Test 9 / Daily report cron broken** — `GET /api/admin/daily-report` is mounted AFTER `authMiddleware` in `server.js`, so CRON_SECRET auth never fires — JWT check rejects first. Fix: extract cron routes into a dedicated router mounted before `authMiddleware`. Also: no Vercel cron scheduled to call it — daily report email has not been firing in production. Broken — needs a dedicated session to fix both the route ordering and the schedule.
- **Invoice PDF formatting** — PDF export has formatting issues. Flagged 2026-05-17. Not blocking launch — Good to Have fix for later sprint.
- **Client invoice history** — CRM should consolidate repeat clients (e.g. FotoFetch appears multiple times in invoice dropdown). Need single client record with full invoice + payment history view. Good to Have — Phase 5 or CRM sprint.

---

> All AI features use **Gemini exclusively** (BYOB model). No OpenAI or other providers.
