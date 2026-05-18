# Lumière Ledger — Changelog

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

---

## [v7.6.0] — 2026-05-17

### Auth hardening — Beta code gate + confirm password

#### Added
- **`web-react/src/App.jsx`** — `BetaCodeGate` component: authenticated users with no subscription record (Google OAuth users who skipped the code step) now hit a full-screen code entry page instead of a broken empty dashboard. Calls `POST /api/subscription/redeem`, then refreshes subscription in AuthContext. Includes "Sign out and use a different account" link.
- **`web-react/src/components/AuthContext.jsx`** — `subscriptionReady` boolean state: `false` until `fetchSubscription` resolves (success or error). Exported in context value. Resets to `false` on sign-out. Prevents the gate from flickering during initial load before the status check completes.
- **`web-react/src/pages/Login.jsx`** — Confirm Password field added to the email/password signup form. Inline mismatch indicator (red border + message) shown live as user types. Validation fires before `signup()` is called.

#### Fixed
- Google OAuth users with no subscription record now see the code gate instead of a broken app shell.

---

## [v7.5.9] — 2026-05-17

### Fast Receipt Processing — Scan at top, Gemini Vision auto-fill

#### Added
- **`api/routes/receipts.js`** — New `POST /receipts/extract` endpoint. Accepts image or PDF via multipart upload, sends it to Gemini Vision using the user's BYOB API key, returns extracted `vendor`, `amount`, `date`, `category`, `notes` as JSON. Mounted before the `/:table/:id` wildcard route.
- **`web-react/src/components/TransactionDrawer.jsx`** — Receipt scanner card moved to the **top** of the transaction form. "Scan or Upload Receipt" button (no `capture` attr — iOS surfaces "Scan Documents" natively). On file select: (1) sends to `/receipts/extract` for Gemini Vision extraction, (2) pre-fills vendor/amount/date/category/notes from result, (3) converts image to PDF client-side via jsPDF before storage. If no Gemini key is configured, still attaches the file without pre-fill. Remove button clears the attachment. `scanMsg` shows extraction status in amber/green.

#### Changed
- **`web-react/src/components/TransactionDrawer.jsx`** — Removed old receipt input from bottom of form. Added `scanning` and `scanMsg` state fields. `imageToPdf()` utility lives outside the component. Existing save + manual upload flows preserved.

---

## [v7.5.8] — 2026-05-17

### Import staleness badge — calendar-day fix + Import screen

#### Changed
- **`web-react/src/pages/Transactions.jsx`** — `daysSinceImport` now compares calendar dates in local time instead of raw elapsed milliseconds. "Updated today" fires only when the last import's `created_at` date matches today's date — not "within 24 hours." Also dropped the `expense_date` fallback: if a row has no `created_at`, it is skipped rather than using the transaction date (which is not an import timestamp).
- **`web-react/src/pages/Import.jsx`** — Added the same staleness badge to the Bank Data Import header. Queries Supabase directly on mount for the single most recent non-manual transaction `created_at`; no full expense load required. Badge shows green / yellow / red on the same 0 / ≤7 / >7 day thresholds as the Ledger.

---

## [v7.5.7] — 2026-05-17

### Brain — API key setup CTA for unconfigured users

#### Changed
- **`web-react/src/components/AssistantSidebar.jsx`** — Sidebar no longer hides entirely when no Gemini API key is configured. Button is still visible (dimmed). Opening the panel shows a setup card: explains BYOB architecture, links to Google AI Studio to get a free key, links directly to Control Center → Intelligence tab to enter it, and shows example questions so users understand the value before setting up.
- **`web-react/src/components/AssistantSidebar.jsx`** — Chat interface and input are gated behind `hasKey` — unconfigured users see only the setup card, not a broken chat.
- Prevents unconfigured users from hitting a raw 400 error mid-conversation, and eliminates shared token consumption — each user drives their own Gemini quota.

---

## [v7.5.6] — 2026-05-17

### Brain — self-describing capabilities

#### Added
- **`api/routes/brain.js`** — CAPABILITIES block added to system instruction. Covers: what the Brain can look up (transactions, metrics, invoices, leads, accounts, payment history), what it can change with user approval (create transaction, update lead, mark invoice, link transaction to lead), and what it cannot do yet (create invoices, upload receipts, access mileage logs directly, Plaid real-time sync, send emails, external accounting). When asked "what can you do?" Gemini recites this accurately rather than guessing.
- **`web-react/src/components/AssistantSidebar.jsx`** — Greeting updated to invite the capability question: "I have live access to your ledger, invoices, and CRM. Ask me anything, or say 'what can you do?' to see a full list of capabilities."

---

## [v7.5.5] — 2026-05-17

### Brain — context-sensitive payment handling + per-account breakdown

#### Fixed
- **`api/routes/brain.js`** — `search_transactions` now selects and returns `source` (account) on every transaction. Added `account_breakdown` to the response — an array of `{ account, total }` sorted by amount. Enables Gemini to present per-card payment totals without a second query.
- **`api/routes/brain.js`** — Payment exclusion rule refined: CC payments and internal transfers are excluded from *general* spending/purchase analysis only. When the user explicitly asks about credit card payments or how much they paid per account, the Brain uses `search_transactions` with the payment category and presents `account_breakdown` grouped by card/account. Previously the blanket exclusion made explicit payment queries return nothing useful.
- **`api/routes/brain.js`** — `search_transactions` tool description updated to document `account_breakdown` field so Gemini knows to use it for per-card grouping.

---

## [v7.5.4] — 2026-05-17

### Brain — conversation memory + metrics cleanup

#### Fixed
- **`web-react/src/components/AssistantSidebar.jsx`** — Each message to the Brain now includes the last 10 messages as conversation history. Root cause of follow-up questions losing context ("what about in 2026" had no idea the prior question was about Travel). History is sent as `{ role, text }[]` and converted to Gemini's `{ role, parts: [{ text }] }[]` format server-side.
- **`api/routes/brain.js`** — `/ask` handler now accepts `history[]` from the request body and seeds `model.startChat({ history: geminiHistory })` so Gemini carries prior context into each new message. History is sanitized to ensure it starts with a user turn and has no consecutive same-role entries (Gemini constraint).
- **`api/routes/brain.js`** — `get_metrics_snapshot` top category list now excludes "Internal Transfer", "Credit Card Payment", "Transfer", and "Payment" categories — these are ledger bookkeeping entries, not real business expenses. Previously they dominated the top spending list and distorted financial analysis.

---

## [v7.5.3] — 2026-05-17

### Brain — category partial match + search-before-create

#### Fixed
- **`api/routes/brain.js`** — `search_transactions` category filter changed from `.eq()` exact match to `.ilike()` partial match. Root cause of "You have not spent anything on travel" when the DB category is "Travel & Vacation" — Gemini passed "Travel", exact match returned 0 rows, Brain incorrectly reported no spending.
- **`api/routes/brain.js`** — System instruction updated with explicit category name list (Travel & Vacation, Camera & Equipment, Software & Subscriptions, etc.) so Gemini passes the right string rather than guessing. Partial match is a safety net; correct names are now in the prompt.
- **`api/routes/brain.js`** — Added SEARCH BEFORE CREATE rule: when a user mentions past purchases or spending, Brain must call `search_transactions` first. Only offers `create_transaction` if the search confirms no existing records. Previously the Brain jumped straight to record creation when a user described their purchases.
- **`api/routes/brain.js`** — Added retry guidance: if a category search returns 0 results, broaden the search (different keyword, no category filter, date range) before telling the user they have no spending.

---

## [v7.5.2] — 2026-05-17

### Brain — credit card payment exclusion from purchase analysis

#### Fixed
- **`api/routes/brain.js`** — System instruction updated with PURCHASE vs PAYMENT DISTINCTION rules. When the user asks about "biggest purchase" or spending analysis, Gemini now knows to exclude credit card payments, ACH transfers, and auto-pay transactions (vendors containing "EPAYMENT", "ACH PMT", "AUTOPAY", "BILL PAY", "PAYMENT", "TRANSFER") — these are balance transfers, not purchases. Previously, "AMEX EPAYMENT ACH PMT" was surfaced as the biggest single purchase.
- **`api/routes/brain.js`** — Removed stale `amount_paid_cents` reference from INVOICE RULES in system instruction (column doesn't exist — already fixed in v7.5.1 executor).

#### Added
- **`ROADMAP.md`** — Phase 2 Step 5 added: Brain Chart/Analysis Output Popup. When user requests a visual analysis, the Brain returns structured data; AssistantSidebar renders a Chart.js modal with Download CSV. Flagged 2026-05-17.

---

## [v7.5.1] — 2026-05-17

### Brain — invoice total computation fix: non-existent column references

#### Fixed
- **`api/routes/brain.js`** — `get_invoice_summary`, `get_invoice`, and `update_invoice_status` all referenced `total_cents` and `amount_paid_cents` columns that do not exist on the `invoices` table. Invoice totals are computed from `invoice_items(unit_price_cents, quantity)` + `tax_percent` + `discount_cents`. All three tools now SELECT the correct columns and compute totals via `calcTotal()` helper. Root cause of "column invoices.total_cents does not exist" error blocking all invoice Brain actions.
- **`api/routes/brain.js`** — Removed `amount_paid_cents` parameter from `update_invoice_status` tool declaration. Marking an invoice paid requires only `{ status: 'paid' }` — no amount field exists on the table.
- **`web-react/src/components/AssistantSidebar.jsx`** — `handleApprove` for `update_invoice_status` simplified to `PATCH { status }` only — removed conditional `amount_paid_cents` inclusion that would have sent a non-existent field to the API.

---

## [v7.5.0] — 2026-05-17

### Brain — invoice schema fix: client_name column does not exist

#### Fixed
- **`api/routes/brain.js`** — All three invoice tools (`get_invoice_summary`, `get_invoice`, `update_invoice_status`) were selecting `client_name` as a direct column. The `invoices` table has no such column — client info is stored in a separate `clients` table joined via `client_id`. Fixed all three SELECTs to use `clients(name)` join and all mappings to use `r.clients?.name`. Root cause of "error retrieving invoice details" on every Brain invoice lookup.

---

## [v7.4.9] — 2026-05-17

### Brain — reliability fixes: multi-invoice, loop depth, required fields, transaction IDs

#### Fixed
- **`api/routes/brain.js`** — Root cause of "mark 0428 and 1001 paid" failure: Gemini was combining both numbers into a single `get_invoice` call. Fixed by rewriting `get_invoice` tool description to explicitly state "ONE invoice number per call, never combine." System instruction updated with INVOICE RULES section that mandates a separate `get_invoice` call per number.
- **`api/routes/brain.js`** — Function calling loop raised from 3 → 6 rounds. A 2-invoice request needs up to 4 rounds (2× get_invoice + 2× update); the old cap caused silent mid-task abandonment.
- **`api/routes/brain.js`** — `create_transaction` executor now guards against missing `vendor`, `amount_dollars`, `date` — returns an error instructing Gemini to ask the user rather than creating a $0 record.
- **`api/routes/brain.js`** — `search_transactions` now selects and returns `id` field — enables `link_transaction_to_lead` to receive a valid UUID from a prior search result.

---

## [v7.4.8] — 2026-05-17

### Brain — invoice read + write tools

#### Added
- **`api/routes/brain.js`** — `get_invoice` read tool: looks up invoices by number (strips `#` prefix), client name, or status; returns `id`, `invoice_number`, `client`, `status`, `total_cents`, `due`. `update_invoice_status` write tool: verifies invoice ownership via DB lookup before returning pending action; sets `amount_paid_cents` to invoice total when marking paid unless overridden. System instruction updated with explicit multi-invoice and `#`-stripping guidance so Gemini handles "mark #2026-0428 and #1001 paid" correctly.
- **`web-react/src/components/AssistantSidebar.jsx`** — `handleApprove` case for `update_invoice_status`: patches `{ status, amount_paid_cents }` to `/api/invoices/:id`, dispatches `ll:refresh` with `scope: 'invoices'`.
- **`web-react/src/pages/Invoice.jsx`** — `ll:refresh` listener updated to also trigger on `scope: 'invoices'`.

---

## [v7.4.7] — 2026-05-17

### Brain — live refresh after actions, multiline input

#### Changed
- **`web-react/src/components/AssistantSidebar.jsx`** — After `handleApprove` succeeds, dispatches `window.CustomEvent('ll:refresh', { detail: { scope } })`. `update_lead_status` → `scope: 'leads'`; `create_transaction` → `scope: 'transactions'`; `link_transaction_to_lead` → both. Input replaced from `<input>` to `<textarea>` with `onKeyDown`: Enter submits, Shift+Enter inserts newline. Auto-grows up to 120px.
- **`web-react/src/pages/CRM.jsx`** — Added `ll:refresh` event listener; fires `loadLeads(true)` on `scope: 'leads'`.
- **`web-react/src/pages/Transactions.jsx`** — Added `ll:refresh` event listener; fires `loadData(true)` on `scope: 'transactions'`.
- **`web-react/src/pages/Invoice.jsx`** — Added `ll:refresh` event listener; fires `load()` on `scope: 'leads'` or `'transactions'`.
- **`web-react/public/version.json`** — Bumped to 7.4.7
- **`web-react/src/App.jsx`** — `CURRENT_VERSION` bumped to 7.4.7

---

## [v7.4.6] — 2026-05-17

### AI Brain — CRM write fix + greeting personalization

#### Fixed
- **`api/routes/brain.js`** — `get_lead` tool was not selecting `id` from the `leads` table. Gemini received lead data but no UUID, so `update_lead_status` always returned "I don't have a unique ID." Fixed: `id` added to SELECT and to the mapped response object. CRM write actions (mark as Completed/Booked/Lost/etc.) now work correctly.

#### Changed
- **`web-react/src/components/AssistantSidebar.jsx`** — Greeting message now uses the user's first name extracted from `settings.contact_name`, `settings.business_name`, or email prefix as fallback.
- **`web-react/public/version.json`** — Bumped to 7.4.6
- **`web-react/src/App.jsx`** — `CURRENT_VERSION` bumped to 7.4.6

---

## [v7.4.5] — 2026-05-17

### AI Brain — Phase 2 Step 2: Confirmation UI + account tool + markdown rendering

#### Added
- **`api/routes/brain.js`** — Three write tools added (`update_lead_status`, `create_transaction`, `link_transaction_to_lead`). Write tools never execute directly — they return `{ __pending: true, pendingAction }`. The `/ask` endpoint collects all pending actions and returns them alongside the text answer. `get_accounts` tool added with optional `year` filter.
- **`web-react/src/components/AssistantSidebar.jsx`** — Pending action confirmation cards rendered in chat. APPROVE routes by action type to the correct API call; REJECT dismisses with a "Cancelled" message. `renderMarkdown()` function added — converts `**bold**`, `*italic*`, `` `code` ``, and bullet lists to HTML. All assistant messages now rendered via `dangerouslySetInnerHTML`.

---

## [v7.4.4] — 2026-05-17

### AI Brain — Phase 2 Step 1: Function Calling

#### Changed
- **`api/routes/brain.js`** — `/ask` endpoint completely rewritten. Replaced context-stuffing (11 parallel DB queries + 3,000-token prompt dump) with Gemini function calling. The model now decides which data it needs and calls tools on demand: `search_transactions`, `get_metrics_snapshot`, `get_invoice_summary`, `get_lead`. Responses are faster, more accurate, and ~70% leaner on token usage. Includes a 3-round tool execution loop with parallel tool resolution. System instruction moved to model-level for consistency across turns.

---

## [v7.4.3] — 2026-05-17

### Intelligence tab — Tier 1 quota panel, What's New button

#### Changed
- **`web-react/src/components/control-center/IntelligenceTab.jsx`** — Performance Hub updated from hardcoded Free Tier limits (5 RPM, 250K TPM, 20 RPD) to correct Tier 1 limits (1K RPM, 1M TPM, 10K RPD). Label changed from "FREE TIER ACTIVE" to "TIER 1 ACTIVE". Project label updated to "StudioTracker". Added note clarifying these are reference limits, not live usage. Fixed Gemini version reference: "2.0 Flash" → "2.5 Flash".
- **`web-react/src/App.jsx`** — "WHAT'S NEW" button added to header right side. Appears once per version, dismissed via localStorage keyed to version string, reappears automatically on next deploy. Clicking opens ChangeLogModal.

---

## [v7.4.2] — 2026-05-16

### Update banner — fixed version tracking

#### Fixed
- **`web-react/src/App.jsx`** — `CURRENT_VERSION` was stuck at `"7.0.0"` since May 1 — the update banner has been dead for every release since. Updated to `7.4.2`. Poll interval changed from 60s to 5 minutes (previously ran every minute unnecessarily). Stale auto-reload dead code removed.
- **`web-react/public/version.json`** — Updated to `7.4.2`. This file must be updated on every deploy or the user banner cannot fire.
- **`web-react/src/App.jsx`** — Banner text changed from "🚀 REFRESH FOR UPDATES" to "UPDATE AVAILABLE — REFRESH". Emoji removed.
- **`CLAUDE.md`** — Deploy workflow now explicitly lists updating both version files as a required step with instructions. Banner behavior documented.

---

## [v7.4.1] — 2026-05-16

### LCC — Copy cleanup, intake URL, stale version string

#### Changed
- **`web-react/src/pages/Backup.jsx`** — LCC tab pills: all emojis removed. Tabs are text-only, matching the nav cleanup from v7.4.0.
- **`web-react/src/components/control-center/InfrastructureTab.jsx`** — "Studio License Lock" renamed to "License Activation". "Studio state restored" → "Ledger state restored". Stale `3.9.2-SAAS` architecture label replaced with current version `7.4.0`. Copy references to "studio ecosystem/archive" updated to "ledger".
- **`web-react/src/components/control-center/IntegrationTab.jsx`** — `INTAKE_URL` updated from `https://app.throughthelens.media/api/intake` to `https://www.lumiereledger.com/api/intake`. Emoji removed from intake URL display and empty-state card.

---

## [v7.4.0] — 2026-05-16

### Nav & LCC — UI Polish, Performance, System Status

#### Changed
- **`web-react/src/App.jsx`** — Nav dropdown rebuilt: all emojis removed, items grouped into labeled sections (Financials, Operations, Client Work, Settings). Reads as a professional finance tool.
- **`web-react/src/pages/Backup.jsx`** — LCC load completely restructured. On mount now fires only 2 API calls (health + settings) instead of 7–11. Heavy data (expenses, rules, admin) loads on demand per tab, not upfront. Eliminates the slow cold-load entirely.
- **`web-react/src/pages/Backup.jsx`** — Replaced 4 stat cards (Transactions, Gear, Invoices, CRM) with a System Status panel: Database connection, Email/SMTP status, last-checked timestamp, and a manual Refresh button. All sourced from the fast `/health` endpoint.
- **`web-react/src/pages/Backup.jsx`** — Added skeleton loader: if a tab takes longer than 800ms to load, animated placeholder bars appear so the page never looks broken or empty.

---

## [v7.3.9] — 2026-05-16

### Invoice — Mark Paid on Draft, Edit on Paid

#### Fixed
- **`web-react/src/pages/Invoice.jsx`** — Mark Paid button now appears on **draft** invoices (not just sent). Enables logging portal-paid clients (e.g., FotoFetch) without triggering an unwanted email send.
- **`web-react/src/pages/Invoice.jsx`** — Edit button now available on **paid** invoices. Previously disappeared after marking paid, preventing corrections and record access. All statuses (draft, sent, paid) now allow editing.

---

## [v7.3.8] — 2026-05-16

### Invoice — Client Override Fix, Duplicate Leads, Save & Send

#### Fixed
- **`web-react/src/pages/Invoice.jsx`** — Client name and email inputs now set `autoComplete="off"` to prevent browser autofill hijacking the field with a prior client (Boris). Both fields also clear `clientId` on manual change — previously, a leftover `clientId` from a prior session caused `handleCreateInvoice` to skip creating a new client and silently reuse the old one.
- **`web-react/src/pages/Invoice.jsx`** — CRM Import leads dropdown now shows shoot type and creation date alongside name (e.g. "FotoFetch — Commercial (2026-04-01)") so duplicate-named leads are distinguishable.

#### Added
- **`web-react/src/pages/Invoice.jsx`** — "SAVE & SEND EMAIL" button in the invoice form footer. Saves the draft then immediately triggers the send email confirmation flow — eliminates the two-step save → list → send workflow. "SAVE DRAFT" remains for cases where sending isn't needed yet.

---

## [v7.3.7] — 2026-05-16

### Remove Vercel Cron Jobs

#### Changed
- **`vercel.json`** — Removed all cron job entries (`/api/ping`, `/api/admin/watchdog`, `/api/admin/daily-report`). Uptime and scheduling handled by external monitoring system. Empty `"crons": []` retained to prevent accidental re-addition.
- **`CLAUDE.md`** — Vercel section updated to reflect crons removed; note added to not re-add without direction.

---

## [v7.3.6] — 2026-05-16

### Operational Docs — Roadmap Consolidation + Session Rules

#### Changed
- **`CLAUDE.md`** — Added `ROADMAP.md` to mandatory pre-session reads. Expanded Non-Negotiable Rules: roadmap review before every session, changelog update after every change, roadmap item check-off after completion. Added Out-of-Scope Request Protocol with four categories (Need, Broken, Clean Up, Good to Have).
- **`ROADMAP.md`** — Added Flagged Items section at bottom with four labeled categories for out-of-scope requests. This is the drop zone Claude uses when a requested change falls outside the active sprint.

---

## [v7.3.5] — 2026-05-16

### Domain Gap Fixes — CORS, Pay Portal URL, Mailer Fallback

#### Fixed
- **`api/server.js`** — Added `https://www.lumiereledger.com` and `https://lumiereledger.com` to `ALLOWED_ORIGINS`. Without this, all authenticated API calls from the new domain were blocked by CORS.
- **`api/routes/invoices.js`** line 236 — `APP_URL` fallback changed from `https://app.throughthelens.media` to `https://www.lumiereledger.com`. Pay portal links in invoice emails were pointing to the old domain.
- **`api/server.js`** line 115 + **`api/utils/mailer.js`** (all `fromEmail` fallbacks) — Hardcoded `support@lumiereledger.com` replaced with `support@throughthelens.media`. `lumiereledger.com` is not a verified Resend sending domain — using it causes silent delivery failure (API returns 200, nothing delivers).

---

## [v7.3.4] — 2026-05-14

### Email Pipeline Fix — Correct Sending Domain

#### Fixed
- **`api/routes/feedback.js`** — Added `console.log` of Resend result object so delivery status is visible in Vercel runtime logs. Previously blind — API returned 200 but no visibility into what Resend did with the email.
- **`RESEND_FROM`** (`.env`, `api/.env`, Vercel env var) — Reverted from `support@lumiereledger.com` to `Lumière Ledger <support@throughthelens.media>`. Root cause: `lumiereledger.com` is not a verified sending domain in Resend (requires paid upgrade). Resend silently drops all mail from unverified domains — API accepts the call and returns 200 but nothing delivers. Display name remains "Lumière Ledger"; only the sending domain changes.

---

## [v7.3.3] — 2026-05-14

### Deployment Hotfix — Cron + Docs

#### Fixed
- **`vercel.json`** — Removed sub-daily `/api/ping` cron (`*/5 * * * *`) that blocked all Vercel deployments on the Hobby plan. Ping now runs daily at 8am UTC (`0 8 * * *`), sharing the watchdog schedule. Sub-daily crons are a Pro-only feature and cause a fatal deploy error on Hobby.

#### Changed
- **`CLAUDE.md`** — Updated version to v7.3.3. Corrected cron schedule docs. Added deploy token reference section: `VERCEL_TOKEN` and `GITHUB_TOKEN` usage, webhook reconnect procedure, and the cron blocker warning for future sessions.
- **`SPEC.md`** — Updated version to v7.3.3, last updated date. Corrected Layer 2 monitoring entry from "hourly" to "daily at 8am UTC" to reflect Hobby plan constraint.

---

## [v7.3.2] — 2026-05-14

### Near-Duplicate Review System + Feedback Widget

#### Added
- **`supabase_schema_review_flags.sql`** — Idempotent migration adding `needs_review BOOLEAN` and `review_pair_id UUID` columns to `expenses`. Indexed for fast filtered queries. Run in Supabase SQL editor before deploying.
- **`api/routes/expenses.js`** — `PATCH /:id/resolve-review` endpoint. Resolves a near-duplicate flag with one of three actions: `keep_both` (clear flags, user confirmed they're different), `delete_this` (remove flagged row, clear pair), `delete_pair` (remove other row, keep this one). All operations are defense-in-depth filtered by `user_id`.
- **`api/routes/expenses.js`** — `POST /expenses/manual-merge` endpoint. Takes `keepId` + `deleteId`, verifies ownership, appends a merge note to the kept transaction's `notes` field, deletes the other row.
- **`api/routes/import.js`** — Near-duplicate detection on import (third pass after exact and same-amount fuzzy dedup). Criteria: vendor substring match (case-insensitive), date within ±1 day, amount diff ≤ $50 AND ≤ 40% of the lower amount. Matching pairs are tagged with `needs_review = true` and a shared `review_pair_id` UUID. Import summary reports near-duplicate flags in the errors array.
- **`api/routes/feedback.js`** — New route. `POST /feedback` sends user-submitted feedback (type, message, name, email, optional diagnostics) to `joshua.deuermeyer@gmail.com` via Resend. Auth required; not gated by licensing — any user can report issues.
- **`web-react/src/components/control-center/FeedbackTab.jsx`** — Feedback form component. Type selector (Bug / Idea / Question / General), message textarea, pre-filled sender info from auth context, optional diagnostic attachment (userAgent, href, timezone, online status), success/error states.

#### Changed
- **`api/server.js`** — Mounted `feedbackRouter` at `/feedback` after `authMiddleware` and before `licensingMiddleware`.
- **`web-react/src/pages/Transactions.jsx`** — Desktop table: added checkbox column (select-all in header, per-row checkboxes), orange left border + row highlight for `needs_review` rows, 🚩 badge in Type column that opens the review modal.
- **`web-react/src/pages/Transactions.jsx`** — Near-duplicate review modal: shows both flagged transactions side by side with vendor, amount, date, category, account, and notes. Three resolve actions: Keep Both / Delete This One / Delete Paired One. Closes on backdrop click.
- **`web-react/src/pages/Transactions.jsx`** — Multi-select floating action bar: appears when 2+ rows are checked. Shows selected count, "Merge Selected" button (only when exactly 2 are selected), and Clear. Merge prompts user which transaction to keep, then calls `/expenses/manual-merge`.
- **`web-react/src/pages/Transactions.jsx`** — Mobile card view: orange left border on `needs_review` rows, 🚩 tap button (top-right of card) opens the review modal.
- **`web-react/src/pages/Backup.jsx`** — Added 💬 Feedback pill tab in Ledger Control Center nav. Renders `FeedbackTab`. Added `feedback` to valid tab URL param list.
- **`CLAUDE.md`** — Updated to reflect Vercel free plan (daily crons only) and Supabase free plan (500MB DB, 1GB storage, 7-day inactivity pause).

---

## [v7.3.1] — 2026-05-14

### Infrastructure — Serverless Keep-Alive

#### Added
- **`api/server.js`** — `GET /api/ping` endpoint. Ultra-lightweight: no auth, no DB call, returns `{ ok: true, ts: timestamp }` instantly. Purpose: Vercel cron target to prevent function cold starts.
- **`vercel.json`** — Cron job `*/5 * * * *` hitting `/api/ping` every 5 minutes. Requires Vercel Pro plan (free plan supports daily crons only). Keeps the Express serverless function warm during active hours, eliminating the 800–2000ms cold-start penalty on first authenticated request.

---

## [v7.3.0] — 2026-05-14

### Performance Sprint — Cold Load & Bundle Optimization

#### Changed
- **`App.jsx`** — Converted all 14 page imports and `AssistantSidebar` from eager to `React.lazy()`. Wrapped public routes and authenticated routes in `<Suspense fallback={<PageSpinner />}>`. Initial JS bundle now excludes every page chunk; each page loads only when first navigated to. Estimated 40–60% reduction in initial parse cost.
- **`App.jsx`** — API health check poll interval reduced from 15s to 60s. Sub-minute status updates are not actionable for the user.
- **`App.jsx`** — Version check `useEffect` dependency array narrowed from `[user, location.pathname]` to `[user]`. Previously the 60-second timer was cancelled and restarted on every route change.
- **`vite.config.js`** — Added `build.rollupOptions.output.manualChunks`. Vendor libraries (`react`/`react-dom`/`react-router-dom`, `@supabase/supabase-js`, `chart.js`) now compile into separate named chunks. These chunks carry long cache TTLs and will not re-download on app deploys unless the library version changes.
- **`AuthContext.jsx`** — Added `subscriptionFetchedRef` guard to prevent the double `fetchSubscription` call that occurred on every session restore. `getSession()` and `onAuthStateChange` both fired on init, causing two parallel requests to `/api/subscription/status` and `/api/settings`. Ref resets on `SIGNED_OUT` so re-login always fetches fresh data.
- **`api/index.js`** — Added `fetchDashboardMetrics(year, force)`, `getDashboardMetricsCache(year)`, and `invalidateDashboardMetricsCache(year)` using the existing `getCached`/`setCache` infrastructure (5-minute TTL).
- **`DashboardV2.jsx`** — Dashboard now uses stale-while-revalidate via `getDashboardMetricsCache`. On re-navigation, cached KPIs render instantly while a background refresh runs silently. Cold load behavior (no cache) is unchanged.

---

## [v7.2.1] — 2026-05-13

### Documentation & Project Standards

#### Added
- **`CLAUDE.md`** — Project root instructions file. First file read by Claude in every session. Points to `SPEC.md`, states non-negotiable rules (changelog always updated, file scope discipline, no guessing), lists key planning files, current version, and deploy workflow.

#### Changed
- **`SPEC.md`** — Full update to v7.2. Added: Engineering Standards section (changelog rule, version numbering convention, commit format, file modification rules, deploy workflow), Multi-Tenant Architecture section, Mobile/PWA Requirements section. Updated: version to v7.2.0, Sources data pattern (new Amex keys, `formatSourceKey` fallback), `TransactionDrawer.jsx` and `AuthContext.jsx` descriptions, Acceptance Criteria (new v7.2.0 items), env vars table (`ENCRYPTION_KEY` and `REDIS_URL` flagged as missing), `cryptoUtil.js` flagged as stub.

---

## [v7.2.0] — 2026-05-13

### Mobile UX Sprint & Multi-Tenant Account Architecture

#### Fixed
- **Import clock integrity** (`Transactions.jsx`) — Days-since-import badge now ignores `source === 'manual'` entries. Adding a manual transaction no longer resets the clock to "Updated today." Clock reflects actual bank/CSV import activity only.
- **Calendar icon visibility** (`index.css`) — Replaced conflicting `filter: invert(1)` (which fought against `color-scheme: dark`) with `filter: brightness(0) invert(1)`. Forces pure white icon regardless of OS theme. Tap target padded to 18×18px minimum.
- **Amount field UX** (`TransactionDrawer.jsx`) — New transactions now open with an empty amount field instead of pre-filled `0.00`. `LOAD_TRANSACTION` reducer returns `initialState` when `tx.id` is null. Added `onFocus` handler to clear zero values on existing transactions.
- **Recurring flag layout** (`TransactionDrawer.jsx`) — "Tax Deductible" and "Recurring" checkboxes now render on a single line with `flexWrap: 'nowrap'`. Label text shortened to prevent overflow on narrow screens.
- **Receipt upload — gallery access** (`TransactionDrawer.jsx`) — Removed `capture="environment"` attribute which forced camera-only mode on iOS. Users can now select from photo library, Files app, iCloud Drive, or email attachments saved locally.
- **Missing doc threshold** (`Transactions.jsx`) — MISSING DOC badge now only surfaces on transactions where `amount_cents > 7500` ($75) AND `tax_deductible` AND no `receipt_link`. Applied consistently to both mobile card view and desktop Doc column. Reduces noise on low-value transactions.
- **PWA session persistence** (`AuthContext.jsx`) — Supabase client initialized with explicit `autoRefreshToken: true`, `persistSession: true`, `storageKey: 'lumiere-ledger-auth'`. Added `visibilitychange` event listener that calls `getSession()` on every app foreground. Eliminates forced logout when PWA is closed and re-opened.

#### Changed
- **Account source dropdown** (`TransactionDrawer.jsx`, `Transactions.jsx`) — Replaced hardcoded bank/card list with a dynamic dropdown built from the logged-in user's own imported `source` values via `useFilterOptions`. Each user sees only the accounts present in their ledger. New users with no imports see a hint to import or connect Plaid. Legacy source keys not in the user's data are surfaced as a fallback option when editing old records. `SOURCE_LABELS` map and `formatSourceKey()` helper added for human-readable display of known and unknown keys.
- **ACCOUNT_LABELS** (`Transactions.jsx`) — Extended with Delta Amex, Amex Gold, Amex Platinum, Amex Blue Cash keys for consistent display in filter dropdowns and table rows.

#### Planning
- **ROADMAP.md** — Added `🏃 ACTIVE SPRINT` section with NOW/NEXT/LATER priority queue. Added User-Defined Accounts (Phase 5) feature spec with implementation order. Marked all Phase 1 mobile patch items as complete.

---

## [v7.1.0] — 2026-05-06

### Website Lead Capture — Full Pipeline

#### New Features
- **`POST /api/intake`** — Public server-to-server endpoint. Validates `x-intake-secret` header against `intake_keys` table (falls back to `LUMIERE_INTAKE_SECRET` env var for legacy support). Resolves owning `user_id`, deduplicates clients by email, inserts lead with `status: "New Lead"`.
- **Client deduplication** — Email-based case-insensitive lookup before any insert. Returning clients link to existing record; no duplicate contact cards. `isReturning: true` appended to lead notes.
- **`intake_keys` table** — Per-user API key storage (`id`, `user_id`, `key`, `label`, `created_at`, `last_used_at`). RLS-protected. Service role bypasses RLS for server-side lookups. Index on `key` for fast per-request validation.
- **`GET/POST/DELETE /api/intake-keys`** — Authenticated CRUD. Keys generated as `ll-{24-char UUID slug}`. `last_used_at` updated on every valid intake request (fire-and-forget).
- **`useLeadsRealtime` hook** — Supabase Realtime `postgres_changes` subscription on `leads` filtered by `user_id`. Fires slide-in toast (bottom-right, 8s, click navigates to CRM) and badge counter on new INSERT.
- **Badge on nav** — Red dot badge on bottom nav Leads icon and dropdown CRM Pipeline link. Clears on navigation to `/crm`. `9+` cap for overflow.
- **IntegrationTab** — New Control Center tab (`?tab=integration`). Generate labeled intake keys, copy `LUMIERE_INTAKE_URL` + `LUMIERE_INTAKE_SECRET` env vars, view code snippet for Cloudflare Worker integration, revoke keys with confirm dialog.
- **AddOns page (`/addons`)** — Marketplace listing available add-ons with feature lists and CTAs. Coming-soon add-ons: Website Builder, Client Portal, Contract E-Sign. Linked from main nav dropdown.
- **TTLM `form.js` v2.0.0** — Complete rewrite of Cloudflare Pages Function. Success gate: Turnstile verification + owner Resend email. All secondary tasks (GAS, D1, customer confirmation, Lumière intake) are fire-and-forget via `context.waitUntil`. Form never fails due to downstream dependency.

#### Changed
- `server.js` — Mounts `intakeRouter` (public, before auth middleware) and `intakeKeysRouter` (authenticated, after auth middleware).
- `AuthContext.jsx` — Exports `supabase` client for use by `useLeadsRealtime` without creating a second client instance.
- `App.jsx` — Imports `AddOns` page, adds `/addons` route, adds 🧩 Add-Ons link to dropdown nav.
- `Backup.jsx` — Adds `IntegrationTab` import, adds `'integration'` to valid tab list, renders `IntegrationTab` for `activeTab === 'integration'`, adds 🔗 Integrations tab button.

#### Database
- New migration: `docs/supabase_schema_intake_keys.sql` — run in Supabase SQL Editor to activate multi-tenant intake keys.

#### Env Vars Added
- `LUMIERE_INTAKE_SECRET` — Legacy single-owner secret (backward compat, optional once DB keys are active).

---

## [v7.0.0] — 2026-04-14

### Rebrand to Lumière Ledger

- Full rebrand from internal name to **Lumière Ledger** (`lumiereledger.com`).
- Updated all UI copy, email templates, and admin tooling.
- Subscription licensing and SaaS admin layer launched.
- `SaasTab` added to Control Center — beta codes, subscriptions, engagement pulse.
- Version check hook added — in-app "Refresh for Updates" banner on new deploy.
- `ChangeLogModal` component for in-app release notes display.

---

## [v6.x.x] — 2026-Q1

### CRM Pipeline & Invoicing

- Full CRM pipeline — `New Lead → Quoted → Booked → Lost` kanban.
- Client management with linked lead history.
- Invoice builder — line items, tax, discount, PDF export, email delivery via Resend.
- Pay portal (`/pay/:token`) — public client-facing invoice payment page.
- Digital e-signature capture on invoices.
- CRM financials view — revenue per client, outstanding invoices.

---

## [v5.2.0] — 2025-Q4

### AI Intelligence Hub & Field Speed

- Gemini 2.5 Flash integration — BYOB (Bring Your Own Brain) API key model.
- AI Ledger Repair — batch retroactive categorization with 503 retry logic.
- AI Financial Assistant sidebar — contextual financial Q&A.
- 11+ bank CSV import profiles with auto-detection and dedup.
- Mileage tracker with IRS standard rate and Google Maps integration.
- Equipment registry with straight-line and Section 179 depreciation.
- Receipt upload to Supabase Storage with signed URL access.
- Schedule C tax mapping with PDF export.
- System reliability watchdog — hourly cron checks DB + SMTP, sends alert email on failure.
- UptimeRobot Layer 1 external HTTP monitoring.
- RLS fully activated — 40+ endpoints hardened.
- Admin diagnostic dashboard — service key validation, beta code management.

---

## [v5.0.0] — 2025-Q3

### Foundation & Invoicing

- Core transaction ledger CRUD with Supabase backend.
- Multi-tenant RLS isolation — each user sees only their own data.
- Auto-classification rules engine — vendor/notes pattern matching.
- Executive dashboard — gross/net/burn rate KPIs, charts.
- Plaid integration scaffolded (pending approval).
- Beta code access gating during testing phase.
