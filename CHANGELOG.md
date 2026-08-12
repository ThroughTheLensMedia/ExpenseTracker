# Lumière Ledger — Changelog

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

---

## [v7.23.5] — 2026-08-12

### Polish — Transfer badge shows yellow text

- **`web-react/src/pages/Transactions.jsx`** — Type column's "Transfer" badge now uses yellow text/border (`#eab308`) instead of the neutral gray `.tag` style, matching the green Income / orange Needs Review treatment so all three states are distinguishable at a glance.
- Update ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.23.4] — 2026-08-12

### Improved — Uncategorized negative transactions show "Needs Review" instead of a guessed label

- **`web-react/src/pages/Transactions.jsx`** — Type column: a negative-amount row with a blank/`Uncategorized` category (and not already identified as a transfer) now shows an orange "Needs Review" badge (`.tag.warn`) instead of confidently labeling it "Income". Prompted by finding real production rows (military retirement pay, VA benefits, EUR transfers) that had sat with blank categories and were only correctly summed as income by luck of the naive check, not by design — the app was guessing and calling it certain.
- **`api/utils/spendCategories.js`** + **`web-react/src/constants/spendCategories.js`** — widened `CC_PAYMENT_PATTERN` to also match `pymt` (previously only matched `pmt`), closing a real gap found on a second user's account where `CAPITAL ONE MOBILE PYMT` wasn't being caught by the existing pattern and was displaying as income.
- General approach: rather than only patching the specific vendor strings found during investigation (whack-a-mole), the Needs Review badge makes any future unrecognized negative-amount vendor string visible to the user instead of silently mislabeled, on top of the regex widening.
- Update ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.23.3] — 2026-08-12

### Fixed — Credit card payments mislabeled as income (monthly report + Transactions UI)

- **`api/routes/cron.js`** — `buildMonthlyReport()`'s `income` filter (line 182) was still a bare `(r.amount_cents || 0) < 0`, unlike the weekly digest's `weekIncome`/`ytdIncome` (line 358/364) which were fixed in v7.23.1 to use `isNonIncomeRow()`. The v7.23.1 fix only touched the weekly digest block — the monthly email report kept counting Credit Card Payment / Internal Transfer / Deposit rows as income the entire time. Now uses `isNonIncomeRow(r.category, r.vendor)` like the other two.
- **`web-react/src/constants/spendCategories.js`** (new file) — frontend mirror of `api/utils/spendCategories.js`'s `TRANSFER_CATS`/`isNonIncomeRow()`, following the same hand-synced pattern as `constants/billing.js`. Created because neither frontend site below had a category-aware check available to import — that's the actual reason they fell back to sign-only logic.
- **`web-react/src/pages/Transactions.jsx`** — Type column now shows "Transfer" (neutral) instead of "Income" (green) for negative-amount rows in a transfer category. Reported by Joshua: a `-$3,456.26` "AUTOPAY PAYMENT - THANK YOU" row categorized `Credit Card Payment` was showing green "Income."
- **`web-react/src/components/TransactionDrawer.jsx`** — the deduct checkbox's label ("Biz Income" vs "Tax Deductible") now also checks `isNonIncomeRow()` before showing "Biz Income" for a negative amount.
- **`CLAUDE.md`** — extended the Data Patterns income/spend row and added a new Security Rules entry documenting why the v7.23.1 fix didn't cover every call site, as a guardrail against the same drift recurring again.
- Update ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.23.2] — 2026-08-12

### Added — "Bus Exp" column + green income pill on Transactions ledger

- **`web-react/src/pages/Transactions.jsx`** — new "Bus Exp" column between Category and Amount showing a green ✓ when `tax_deductible` is true, `—` otherwise. Reuses the existing `tax_deductible` field rather than adding a new one.
- **`web-react/src/pages/Transactions.jsx`** — the Type column's "Income" pill now uses the `tag ok` class (same green styling as the Doc column's "View" receipt link) instead of the neutral `tag` class, so income rows are visually distinct at a glance.
- Update ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.23.1] — 2026-08-11

### Fixed — Real income silently excluded from weekly digest + dashboard income totals

- **`api/utils/spendCategories.js`** — `NON_SPEND_CATS` conflated two different concepts: real income categories (`Photo Income`, `Freelance Income`, `Reimbursement`, `Refund`, etc.) and pure transfer categories (`Internal Transfer`, `Credit Card Payment`, `Deposit`). Both `api/routes/cron.js` (weekly digest) and `api/routes/metrics.js` (dashboard) used this one set to skip a row entirely — for spend rows that's correct, but for income rows it silently dropped any transaction categorized as real income from `incomeCents`/`ytdIncome`. Confirmed against production data: a Venmo payment (expense id 19503, -$740.63, category `Photo Income`, dated 2026-04-30) was invisible to both the weekly digest and the dashboard because of this.
- Split into `INCOME_CATS` (real income — never excluded from income totals) and `TRANSFER_CATS` (excluded from both). `NON_SPEND_CATS` (spend-side exclusion) is unchanged — kept as the union for backward compatibility. Added `isNonIncomeRow()` — excludes only real transfers from income rollups.
- **`api/routes/cron.js`** — `buildWeeklyDigest()`'s `weekIncome`/`ytdIncome` filters now use `isNonIncomeRow()` instead of `NON_SPEND_CATS.has()`. Added `vendor` to the `expenses` select (needed for the vendor-pattern check).
- **`api/routes/metrics.js`** — the dashboard summary loop now branches: income rows are excluded via `isNonIncomeRow()`, spend rows via `isNonSpendRow()` (previously one check skipped the row before income/spend were even distinguished).
- Update ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.23.0] — 2026-08-06

### Added — Dedicated Clients page + hamburger nav link

- **`web-react/src/pages/Clients.jsx`** (new file) — client management gets its own first-class page instead of only living as a tab buried inside the Invoice page. Stat tiles (Total Clients, Lifetime Value, Outstanding), a searchable/sortable table (Name, Email, Phone, Open invoices, Paid invoices, Lifetime Value — sortable, a genuinely new "who are my best clients" view), and row actions: New Invoice, Edit, Email, Merge into..., Delete. A detail drawer shows every invoice for that client with its pipeline status and amount.
- **`api/routes/invoices.js`** — new `PATCH /invoices/clients/:id`, the first way to actually edit a client's own saved info. Previously the only options were replace-via-new-invoice, merge, or delete — there was no way to just fix a typo'd phone number. Also exposes `address` and `notes` for the first time anywhere in the UI — both were already accepted by the backend `ClientSchema` but had zero UI exposure until now.
- **`web-react/src/App.jsx`** — "Clients" added to the hamburger menu's Client Work section, routed to `/clients`.
- **`web-react/src/pages/Invoice.jsx`** — one small additive `useEffect` (new `?newInvoiceClientId=` query param support) so the new page's "New Invoice" button hands off cleanly to the Invoice page's creator drawer, pre-filled for that client. Nothing else in this file changed — the existing Clients tab inside Invoice.jsx stays exactly as it was, by design (kept both surfaces rather than removing the original).
- **Caught and fixed during testing:** the new `PATCH` endpoint used `.single()`, which throws a raw, confusing Postgrest error on a nonexistent client instead of a clean 404. Switched to `.maybeSingle()`. Verified against real data before and after the fix.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, ROADMAP.md, CLAUDE.md

---

## [v7.22.3] — 2026-08-06

### Fixed — Mileage Tracker: mode-switch data loss + Edit moved into main form

- **`web-react/src/pages/Mileage.jsx`** — Date/Trip Name/Notes were tracked as two separate sets of state, one per mode (`manualDate`/`tripDate`, etc.), so switching between Maps Autopilot and Manual Entry appeared to wipe whatever was already typed even though nothing was actually lost. Merged into shared `formDate`/`formName`/`formNotes` used by both forms — switching modes now preserves input in both directions. `manualMiles` (typed) and `calculatedMiles` (Maps-derived) stay separate, since they're fundamentally different values.
- **Edit now opens in the main "Log New Trip" card** instead of a cramped inline table row — same form Copy already uses, so Joshua can attach or change an invoice link while editing (previously only available when adding). Always lands in Manual Entry mode for the same reason Copy does (Maps Autopilot addresses aren't reliably re-seedable into a live Autocomplete). Save now branches `PUT` vs `POST` on `editingId`, same pattern as `TransactionDrawer.jsx`. Removed the old inline-row edit UI and its dedicated `editDate`/`editMiles`/`editPurpose` state entirely.
- **Invoice auto-restore on Edit:** if a trip's notes end in the app's own `Invoice #123 — Name` marker, Edit matches it back to a real invoice and pre-selects it in the dropdown, stripping the ref out of the visible notes (it's regenerated from the dropdown on save, same as before). Prevents silently dropping a real invoice link just from fixing a typo or the mileage number. Falls back to a blank dropdown (with the raw text still visible in notes) if no match is found. Copy's behavior is unchanged — it still blanks date and invoice, since it's always creating a new day's entry, not correcting one.
- The "Maps Autopilot" toggle is disabled while editing (with a tooltip) so a mid-edit mode switch can't leave the form in an inconsistent state.
- No backend or schema changes — reuses the existing `PUT /mileage/:id` and `POST /mileage` routes.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.22.2] — 2026-08-06

### Added — Mileage Tracker: duplicate trip entry

- **`web-react/src/pages/Mileage.jsx`** — new **Copy** button on each Trip History row. Populates the Manual Entry form with the source trip's name, miles, and notes (a Maps Autopilot trip's route string is folded into notes rather than dropped, since addresses aren't reliably re-seedable into a live Google Places Autocomplete). Date and Link to Invoice are left blank for the user to fill in fresh. Prompted by multi-day shoots at the same client/location, where every field but the date repeats.
- Added a date-required guard to `handleAddManualTrip` (and disabled the Log This Trip button on a blank date) since duplicate now clears that field intentionally.
- No backend or schema changes — reuses the existing `POST /mileage` create path, so a duplicated trip is always a new row; the source trip is untouched.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.22.1] — 2026-08-06

### Added — Client detail drawer: invoice pipeline + lifetime paid

- **`web-react/src/pages/Invoice.jsx`** — a client's name in the Clients tab is now clickable, opening a detail drawer with two stat cards (**Total Paid** — lifetime sum of their `paid` invoices, **Outstanding** — sum of `sent`-but-unpaid invoices) and a list of every invoice for that client (number, date, status badge, amount), newest first. Clicking an invoice row opens the existing full invoice preview (`handlePreview`) — no new preview UI needed, reused as-is. Direct follow-up to v7.22.0's Clients table — the table showed an invoice *count* but no way to see the invoices themselves or how much a client had actually paid over time.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, ROADMAP.md

---

## [v7.22.0] — 2026-08-06

### Added — Clients tab overhaul: list view, merge, delete, direct email

- **`web-react/src/pages/Invoice.jsx`** — the Clients tab was a card grid showing only name/email with no way to delete, edit, or email a client. Replaced with a sortable/filterable table (name, email, phone, invoice count) with per-row actions: New Invoice (existing), Email, Merge into..., Delete. Prompted by production data showing real duplicate client records (e.g. the same person's name typed slightly differently on separate invoices, each freehand entry creates a new row with zero dedup) with no cleanup tool available.
- **`api/routes/invoices.js`** — three new endpoints:
  - `DELETE /invoices/clients/:id` — deletes a client, but blocks with a clear `400` (invoice count in the message) if any invoices are still attached, since `invoices.client_id`/`leads.client_id` are `ON DELETE SET NULL` and a silent delete would blank out real invoice/lead history.
  - `POST /invoices/clients/merge` — the actual duplicate-cleanup tool: reassigns every invoice **and lead** from a duplicate client onto the canonical one, then deletes the duplicate. Reassigns before deleting so a failed reassignment never orphans data.
  - `POST /invoices/clients/:id/email` — freeform subject/message email to a client, not tied to any invoice. Reuses the existing invoice-email branding shell (studio logo/name header, footer) and the existing `queueInvoiceEmail` Resend/retry plumbing — `sendInvoiceEmail` was already fully generic, no mailer changes needed.
- **Fixed a real pre-existing bug found while building this:** `fetchAllInvoices` (`web-react/src/api/index.js`) only ever fetched the first 50 invoices — it called `GET /invoices` once with no pagination, despite the route supporting `limit`/`offset`. Any account with more than 50 invoices was silently missing rows everywhere that function is used. Now pages through the full result set, same pattern as `fetchAllExpenses`. Added `fetchAllClients` alongside it for the same reason.
- **Verified against live production data before shipping:** ran the guarded delete against a real zero-invoice test client (succeeded) and a real client with an invoice attached (correctly blocked), ran a real merge between two duplicate client records and confirmed via direct DB query that the lead moved and the duplicate was gone, and sent a real test email end-to-end through Resend.
- **Also landed in this release, previously applied to production but never committed:** `api/migrations/016_scope_invoice_number_unique_per_user.sql` — `invoices.invoice_number` had a database-wide `UNIQUE` constraint instead of one scoped per user, so two unrelated accounts could never use the same invoice number (e.g. every new user's suggested first invoice number, `INV-1001`, could only ever belong to one account total). Replaced with `UNIQUE (user_id, invoice_number)`.
- **Not built (flagged for later):** client creation still doesn't dedup by email when a name/email is typed freehand into the invoice form — `api/routes/intake.js`'s lead-intake endpoint already has the right case-insensitive lookup pattern to mirror there. Merge is the cleanup tool for now; this would stop new duplicates from being created in the first place.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, ROADMAP.md, CLAUDE.md

---

## [v7.21.3] — 2026-08-05

### Changed — Brain reasoning: explicit low temperature

- **`api/utils/gemini.js`** and **`api/routes/brain.js`** — both Gemini model calls now set `generationConfig: { temperature: 0.2 }` (previously unset, running on the API default of ~1.0). Lower temperature reduces the model's tendency to guess on tool selection and numeric answers instead of following the deterministic instructions already in the tool schemas/prompts.
- No other behavior changed — tool declarations, the function-calling loop, and RAG doc injection are untouched.
- Investigated and deferred: a "thinking budget" config was also considered, but the installed SDK (`@google/generative-ai@0.24.1`) doesn't support it and reached end-of-life Aug 31, 2025. Migrating to the successor `@google/genai` package (needed for thinking-budget tuning, verified Gemini 3.x support, and a future user-selectable model picker) is tracked as its own item in `ROADMAP.md`.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, ROADMAP.md, CLAUDE.md

---

## [v7.21.2] — 2026-08-05

### Changed — View receipt from the edit drawer

- **`web-react/src/components/TransactionDrawer.jsx`** — added a "View" button next to an attached receipt in the edit drawer, using the same `/api/receipts/signed-url` fetch pattern already used on the Transactions ledger. Previously the drawer only showed the filename/link with no way to open the actual file — you had to close the drawer and view it from the ledger instead.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.21.1] — 2026-07-21

### Changed — Unmerge action for vendor merges

- **`api/routes/metrics.js`** — each recurring vendor now returns `mergedFrom`, the list of vendor name variants merged into it (from `vendor_aliases`), so the UI can distinguish a merged vendor from an untouched one.
- **Operational Intelligence table** — merged variants now show as small removable chips under the canonical vendor name (e.g. "starlink internet ✕" under "Starlink"). Clicking the ✕ calls the existing `DELETE /api/vendors/alias/:vendor_key` endpoint (added v7.20.1, unused until now) and splits that variant back into its own row.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.21.0] — 2026-07-21

### Changed — Phase 3: Billing Cycle field + vendor merging in the UI

- **`web-react/src/components/TransactionDrawer.jsx`** — new "Billing Cycle" dropdown (Monthly/Quarterly/Annual), shown only when "Recurring" is checked. Setting this on an annual/quarterly charge (e.g. a domain or insurance renewal) tells the dashboard its real cadence instead of letting it guess from occurrence count.
- **`api/routes/expenses.js`** — `ExpenseBaseSchema` now accepts `billing_cycle` (`monthly`/`quarterly`/`annual`, optional).
- **Dashboard Operational Intelligence table** (`OpIntellComponents.jsx`, `OperationalIntelligenceSection.jsx`) — new inline **MERGE** action per vendor row: type a canonical name and save to combine name variants (e.g. "Starlink Internet" → "Starlink", "Apple Services"/"Apple iCloud" → "Apple") into one rollup, via the `PUT /api/vendors/alias` endpoint added in v7.20.1. Table refreshes via the dashboard's existing metrics refetch instead of a full page reload.
- This completes the 3-phase Operational Intelligence accuracy fix (v7.20.1 schema + cadence math → v7.20.2 cadence labeling → v7.21.0 the UI to actually set them) prompted by Hover showing as $34/mo instead of ~$2.83/mo, and Starlink/Apple appearing as multiple unrelated vendors.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md, ROADMAP.md

---

## [v7.20.2] — 2026-07-21

### Fixed — Operational Intelligence bug from v7.20.1 + annual/quarterly charge labeling

- **Fixed a real bug shipped in v7.20.1:** `api/routes/metrics.js`'s recurring-vendor "review" flag referenced the old `avgCost` variable name after it was renamed to `avgCostPerOccurrence` during the cadence-math rewrite — a `ReferenceError` on every request that reached that line. Caught before it hit a real user session; fixed as part of this release.
- **New: cadence badge on the Operational Intelligence vendor table** (`OpIntellComponents.jsx`) — per Joshua's feedback that a $2.83/mo figure for an annual Hover renewal looked identical to a real monthly subscription like T-Mobile. Vendors now show an **ANNUAL**/**QUARTERLY**/**UNCONFIRMED** badge next to their monthly-equivalent figure whenever it isn't a real month-to-month charge, with a tooltip explaining the estimate. `api/routes/metrics.js` now returns a `cadenceLabel` per vendor (explicit `billing_cycle` wins; otherwise inferred from detected cadence days; `Unconfirmed` when there's only one charge on record and nothing to go on yet).
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.20.1] — 2026-07-21

### Changed — Recurring vendor spend is now cadence-aware (backend, Phase 1 + 2 of Operational Intelligence accuracy fix)

- **Root cause (confirmed via code + live schema):** the dashboard's Operational Intelligence recurring-vendor table divided total spend by number of occurrences and called it "avg monthly," with no concept of actual billing cadence — an annual domain renewal (Hover, $34/yr) showed as $34/**mo**, a 12x overstatement. There was also no way to merge vendor name variants (e.g. "Starlink" and "Starlink Internet" showing as two unrelated line items) since grouping was by exact vendor text.
- **`api/migrations/015_billing_cycle_and_vendor_aliases.sql`** (applied to production) — adds nullable `expenses.billing_cycle` and a new `vendor_aliases` table (RLS matching the existing `account_aliases` pattern).
- **`api/utils/recurringVendors.js`** (new) — shared `deriveCadenceDays()`/`monthlyEquivalentCents()`: an explicit `billing_cycle` wins if set; otherwise cadence is derived from the real gap between a vendor's actual charge dates when there are 2+ occurrences; otherwise falls back to the original total/count math unchanged — verified byte-identical for any vendor nobody has touched, so nothing shifts for existing users until they act.
- **`api/routes/metrics.js`** — recurring-vendor calc now uses the shared cadence helper, and resolves each vendor through `vendor_aliases` before grouping so merged vendors roll up together.
- **`api/routes/cron.js`** — the v7.20.0 weekly digest forecast now shares the same cadence helper instead of its own copy (was calculating identically but independently — same "two routes disagree" class the v7.14.0 dashboard audit already fixed once).
- **`api/routes/vendors.js`** — new `PUT`/`DELETE /api/vendors/alias` endpoints for merging/un-merging vendor name variants, mirrors `PUT /api/accounts/alias` exactly.
- **Not yet built (Phase 3):** a "Billing Cycle" field in the Transaction Drawer and a vendor-merge action in the dashboard UI — this release is backend-only; nothing is user-facing until Phase 3 ships.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.20.0] — 2026-07-21

### Changed — Weekly digest now forecasts upcoming recurring subscription charges

- **New "Upcoming Recurring Bills" card** in the weekly digest email, shown when at least one subscription is projected to charge again within the next 7 days. Omitted entirely when there are none, matching the existing conditional-card pattern (Mileage Needs Review).
- **`api/utils/spendCategories.js`** — extracted `KNOWN_SUBSCRIPTION_VENDORS` (the keyword list used to detect subscriptions like Adobe/Netflix/Spotify) out of `api/routes/metrics.js` into the shared category util, so the dashboard's Subscriptions Radar widget and the new digest forecast agree on what counts as a subscription instead of maintaining two independent lists.
- **`api/routes/cron.js`** — new `projectUpcomingSubscriptionCharges()`: pulls the trailing 365 days of expenses, groups by vendor, and includes only vendors flagged as a subscription (per-row `is_subscription` flag or a known-vendor keyword match) — a frequently recurring but non-subscription vendor (e.g. weekly Amazon shopping) is deliberately excluded. Cadence is derived from the actual gap between real charge dates when a vendor has 2+ occurrences in the window; a vendor seen only once (e.g. an annual renewal like Amazon Prime) assumes a 365-day cadence since there's no gap yet to measure.
- **`api/utils/mailer.js`** — `sendWeeklyDigestEmail()` renders the new card, listing each upcoming vendor with its expected date and last-charged amount.
- Also fixed as part of this diagnosis: the weekly digest's Income figure previously counted internal transfers between the user's own accounts, and Missing Receipts counted the user's entire history instead of just the current tax year — see v7.19.3 below.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.19.3] — 2026-07-21

### Fixed — Weekly digest email miscounted income and missing receipts

- **Income included internal transfers (confirmed via `buildWeeklyDigest()` in `api/routes/cron.js`):** the expense side of the digest already excludes `NON_SPEND_CATS` (transfers, refunds, credit card payments) via `spendCategories.js`, but the income side never applied the same filter — any negative-amount row, including money moved between the user's own accounts, was counted as real income. This inflated both the weekly Income figure and the YTD net used for the "Set Aside for Q_" tax estimate. Fixed by applying `NON_SPEND_CATS` to income the same way it's already applied to expenses, both weekly and YTD.
- **Missing Receipts count had no date scope:** the query counted every deductible transaction over $75 with no receipt across the account's *entire history*, not the current tax year — so a long-time user saw a lifetime backlog number every week instead of a manageable current-year figure. Scoped to the current calendar year (`yearStartStr` → today), matching the tax set-aside calculation's existing year boundary.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.19.2] — 2026-07-21

### Fixed — SaaS admin dashboard hardcoded-values cleanup

- **`isAdmin` check** — `SaasTab.jsx` gated the whole admin console on a hardcoded login email string. Now checks `user.id === ADMIN_UUID` (new export in `web-react/src/constants/billing.js`), matching the single-source-of-truth pattern from the v7.10.11 hardcoded constants audit.
- **`PLAN_OPTIONS` dropdown** — was missing `sync_monthly`/`sync_annual`, both real live Stripe-configured tiers. There was no way to set a user to Sync from the Edit Session panel without direct SQL. Added.
- **Duration constants** — `90`-day invite validity and extend duration were repeated 3x as raw literals in `SaasTab.jsx`. Extracted to `INVITE_VALID_DAYS`/`EXTEND_DAYS`.
- **Plaid billing estimate** — the admin "Monthly Est." column showed `accounts × $0.50` only. Per `PLAID_BILLING_SPEC.md`, every real Plaid invoice also carries a 2.9%+$0.30 Stripe processing fee on that subtotal — the estimate was quietly under-counting what Plaid users are actually charged. Now included, with the tooltip breakdown updated to show all three line items.
- **Tier colors** — `TIER_COLORS` mapped both `free` and `sync` to the same gray `secondary` tag, making a paying Sync member look unpaid at a glance. Added a new `.tag.accent` CSS class (`index.css`) built on `var(--accent)` so Sync gets its own brand-consistent color.
- `PLAN_COST` price map left unchanged — confirmed as a deliberate display-only estimate, not tied to live Stripe price IDs, per Joshua's direction (no reason to over-engineer this).
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, ROADMAP.md

---

## [v7.19.1] — 2026-07-20

### Fixed — SaaS admin "Edit Session" save crashed on every user

- **Root cause (confirmed via schema inspection, not guessed):** `api/routes/admin.js`'s `PATCH /admin/subscriptions/:userId` has always attempted `UPDATE user_subscriptions SET display_name = ...`, but that column never existed on `user_subscriptions` — it threw a Supabase "column not found in schema cache" error before the rest of the update (plan_type, status, expires_at) could run. This affected every user edit from the SaaS Management tab, not just the one reported (Emma Deuermeyer, expired → Lifetime).
- **`api/migrations/014_add_display_name_to_subscriptions.sql`** (applied to production) — adds `display_name TEXT` to `user_subscriptions`. No code changes needed — the GET route (line 315-321) and PATCH route (line 358-364) already read/wrote this column correctly; they were just failing because it didn't exist.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md

---

## [v7.19.0] — 2026-07-14

### Changed — Failed mileage auto-calculation no longer drops the trip

- **Root cause of the reported "Brain can't log the trip" bug (confirmed via Vercel runtime logs, not guessed):** `REQUEST_DENIED — You must enable Billing on the Google Cloud Project` — the Google Cloud project behind `GOOGLE_MAPS_SERVER_KEY` didn't have billing enabled, so every Distance Matrix call was rejected outright. Diagnosed by adding explicit logging to `api/utils/googleMaps.js` and `api/routes/brain.js`'s `log_mileage_trip` handler (prior commit) — that logging is what surfaced the real error instead of a generic failure.
- **`api/migrations/013_mileage_logs_needs_review.sql`** (applied to production) — adds `needs_review` boolean to `mileage_logs`, default `false`.
- **`api/routes/brain.js`** — when the Distance Matrix lookup fails and no exact mile count was given, `log_mileage_trip` no longer drops the trip and returns an error. It now still logs the trip (as 0 mi, `needs_review: true`) so it isn't lost, with a pending-confirmation card telling the user it needs a manual mileage update. Still requires Approve/Reject like every other write tool — nothing saves without confirmation.
- **`api/routes/mileage.js`** — schema accepts the new optional `needs_review` field.
- **`api/routes/cron.js` / `api/utils/mailer.js`** — the weekly digest's mileage follow-up card (added v7.18.0) is now "Mileage Needs Review" and catches AI-logged trips that are missing a business-purpose note **or** flagged `needs_review` (mileage couldn't be calculated), not just the note case.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.18.0] — 2026-07-13

### Changed — AI Brain now auto-calculates mileage + weekly digest follow-up for undocumented trips

- **New `api/utils/googleMaps.js`** — `getDrivingDistanceMiles(origin, destination)` calls Google's Distance Matrix REST API server-side via plain `fetch` (no new npm dependency). Requires a new **server-side** env var `GOOGLE_MAPS_SERVER_KEY` (Distance Matrix API enabled, same Google Cloud project as the existing `VITE_GOOGLE_MAPS_API_KEY`) — the existing client key is HTTP-referrer-restricted to the app's domain and can't be called from Node. Fails closed with a clear error (not a crash) if the key is unset or an address can't be resolved.
- **`api/routes/brain.js`** — the `log_mileage_trip` tool (added v7.17.0) no longer asks the user for an exact mile count. It now calculates the driving distance itself from the stated origin/destination, doubling it for round trips, and shows the computed number on the confirmation card for the user to review before approving. `miles` is now an optional override only for when the user states their own exact number. Also now asks for a short business-purpose note (client/shoot name) up front, since that data is used by the new weekly digest follow-up below.
- **Migration `api/migrations/012_mileage_logs_source_notes.sql`** (applied to production) — adds `source` (default `'manual'`) and nullable `notes` columns to `mileage_logs`, mirroring the existing `expenses.source` pattern. Distinguishes AI-logged trips from manual entries and stores the business-purpose text separately from the combined display `purpose` string, so it can be checked without parsing.
- **`api/routes/mileage.js`** — `MileageSchema` accepts the new optional `source`/`notes` fields; manual entries from `Mileage.jsx` are unaffected (fields simply default).
- **`api/routes/cron.js` / `api/utils/mailer.js`** — the weekly digest email ("Your week at a glance") now includes a new card, "Mileage Needs a Note," when one or more AI-logged trips that week have no business-purpose note — nudging the user to add one on the Mileage page for accurate tax records. Follows the exact same conditional-card pattern as the existing Missing Receipts card; the card is omitted entirely when the count is 0.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx, CLAUDE.md, SERVICES.md

**Deploy note:** `GOOGLE_MAPS_SERVER_KEY` must be generated in Google Cloud Console (same project as the existing Maps key, Distance Matrix API enabled) and added to Vercel Production before the auto-calculation goes live — until then the tool fails closed (asks for exact miles) rather than breaking.

---

## [v7.17.0] — 2026-07-13

### Added — AI Brain mileage logging + Fixed — PWA hamburger menu off-screen

- **`api/routes/brain.js`** — new 12th agentic tool `log_mileage_trip`. Follows the same pending-confirmation pattern as the other 5 write tools (never writes directly). Requires origin, destination, round-trip flag, date, and exact mile count; if the mile count is missing, the system prompt instructs Gemini to ask the user for it or point them to the Mileage page's map-based route calculator rather than estimate — mileage feeds tax deduction totals, so a guessed number was not acceptable. Approving the pending action posts to the existing `POST /mileage` endpoint — no new backend routes or external dependencies (no server-side Google Maps call was added; that calculation still lives client-side in `Mileage.jsx` as before).
- **`web-react/src/components/AssistantSidebar.jsx`** — added the `log_mileage_trip` branch to `handleApprove`.
- **`web-react/src/index.css` / `App.jsx`** — fixed the PWA hamburger (`.mobile-toggle`) menu button being pushed off-screen on mobile. Root cause: the v7.11.0 brand-font pass switched the header title to the wider "Fraunces" serif display font, and an inline style on top of that forced it even larger (`1.8rem`/weight `950`) with `white-space: nowrap`; the header had no `flex-wrap` and the toggle had no `flex-shrink: 0`, so the wider nowrap title crowded the toggle out of the visible row on narrow viewports. Moved the title's inline styles into a new `.header-title` CSS class (inline styles can't be overridden by media queries), added a `max-width: 768px` rule shrinking that title, added `flex-wrap` to the header and `flex-shrink: 0` to `.mobile-toggle` at that same breakpoint. Verified in an isolated render at both mobile (375px) and full width — toggle stays visible and clickable in both.
- Update CHANGELOG.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.16.1] — 2026-07-06

### Fixed — AI Brain gave fabricated credit card payment totals

- **`api/routes/brain.js`** — `search_transactions` only accepted a single category filter per call. Answering "how much have I paid to credit cards this year" requires combining two categories (`Credit Card Payment` + `Internal Transfer`), which the system prompt asked Gemini to do via two separate tool calls, then manually add the results together in the reply text. Confirmed via direct SQL against production that the numbers Gemini reported (e.g. "Apple Card: $302.28") didn't match the real ledger at all (actual: -$1,748.15) — the model was fabricating plausible-looking numbers rather than doing reliable multi-step arithmetic.
- `category` now accepts a comma-separated list (e.g. `"Credit Card Payment,Internal Transfer"`), matched via a single Supabase `.or()` filter — the total and per-account breakdown are computed once, deterministically, in code. System prompt updated to require one combined call and to report the tool's numbers verbatim, never recomputed by hand. Verified against production: real combined total for 2026 is $50,309.58 across 51 transactions, matching the sum of the two categories queried separately.
- Update CHANGELOG.md, ROADMAP.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.16.0] — 2026-07-06

### Added — Persistent AI Brain conversation memory

- **New table `brain_messages`** (`api/migrations/011_brain_messages.sql`) — `user_id`, `role`, `content`, `created_at`, RLS-scoped to the owning user. Applied directly to production via Supabase MCP.
- **`api/routes/brain.js`** — new `GET /messages?limit=50` returns persisted history (chronological) for the frontend to hydrate on load. `POST /ask` no longer trusts a client-supplied `history` array for Gemini context — it now fetches the last 10 messages from `brain_messages` server-side, so a reload or a second browser session sees identical, correct history instead of a browser-local-only window. Both sides of each exchange are persisted after the answer is computed (awaited, not fire-and-forget — Vercel can freeze a function immediately after the response is sent, so an un-awaited insert risked silently never completing); a failed insert is logged but never breaks the chat response.
- **`web-react/src/components/AssistantSidebar.jsx`** — hydrates `messages` from `GET /brain/messages` on mount; the greeting only shows for a genuinely new user (empty history). Removed the client-side `history` param from the send flow — the server is now the sole source of conversation context.

---

## [v7.15.5] — 2026-07-06

### Completed — Gemini key encryption migration run + temp route removed

- **Migration executed against production**, verified via direct SQL: both users with a BYOB Gemini key (`49e7efcb-...` and `1fd43a56-...`) now have `gemini_api_key` in `<nonce>:<cipher>` format (109 chars), 0 plaintext rows remain, 0 failures. The v7.15.0 encryption rollout (shipped but never run) is now fully complete.
- **`api/routes/admin.js`** — temporary `POST /admin/encrypt-gemini-keys` route removed now that the one-time migration is confirmed done, per the standing rule against leaving one-off admin migration endpoints live in production (same cleanup discipline as the v7.10.18 Plaid webhook backfill route removal).
- Update CHANGELOG.md, ROADMAP.md, ChangeLogModal.jsx, version.json, App.jsx

---

## [v7.15.4] — 2026-07-06

### Added — Temporary admin route to run the Gemini key encryption migration

- **`api/routes/admin.js`** — `POST /admin/encrypt-gemini-keys` (admin-only, supports `?dry_run=1`). `ENCRYPTION_KEY` is marked Sensitive in Vercel and can't be exported for a local script run, so this runs the same logic as `api/scripts/encrypt-existing-gemini-keys.js` (shipped v7.15.0, never executed) server-side, where the Sensitive env var is already usable. Same precedent as the v7.10.17 Plaid webhook backfill route. **Temporary — remove once the live run confirms 0 failures.**

---

## [v7.15.3] — 2026-07-06

### Hardened — Fail closed on settings-query errors + re-enabled weekly digest

- **`api/routes/cron.js`** — both `/cron/weekly-report` and `/cron/reengagement-report` now check the `error` field on their `settings` queries and refuse to send (fail closed, HTTP 500 with logged detail) rather than silently proceeding with an empty settings map — the exact failure mode that caused the 2026-07-06 resend incident. The de-dupe stamp upsert after a real send is also checked; if it fails to save, this is now logged loudly (`stampError`) instead of silently risking a repeat on the next ping.
- **Weekly digest live sending re-enabled** (the temporary pause from v7.15.2 is lifted) — root cause fixed via the v7.15.2 migration. **Verified post-deploy:** the database record shows `last_weekly_digest_sent_at = 2026-07-06 12:09:43 UTC` — the one send that landed in the gap between the migration and the v7.15.2 pause deploying, the first time that stamp ever saved successfully. A manual verification call afterward was correctly blocked ("already sent this week"), confirming the de-dupe guard holds. Admin-only gate (`ADMIN_UUID` filter, v7.13.2) remains in place underneath.

---

## [v7.15.2] — 2026-07-06

### Fixed — Actual root cause of the weekly digest resend incident

- **The real bug**: `settings` was missing 6 columns Phase B/Money Story code depends on — `estimated_tax_rate`, `weekly_digest_optout`, `reengagement_email_optout`, `last_weekly_digest_sent_at`, `last_reengagement_sent_at`, `money_story_optout`. They were referenced in code (v7.13.0–v7.15.1) but never migrated into the actual database. The `force`-flag fix in v7.15.1 was real but not sufficient — the settings `SELECT` in `/cron/weekly-report` errored silently on the nonexistent columns (unchecked), so the de-dupe map was always empty and every ping kept sending regardless of the flag logic. Confirmed via direct database inspection after the v7.15.1 fix failed to stop the resends (100+ emails sent).
- **Migration applied directly to production** (`add_missing_settings_columns_v7_15_2`, idempotent `ADD COLUMN IF NOT EXISTS`) — adds all 6 columns with sensible defaults. This also fixes two other silent failures: the tax set-aside rate in Profile settings was never actually persisting, and the digest/re-engagement opt-out checkboxes did nothing.
- **`api/routes/cron.js`** — `/cron/weekly-report` live sending is temporarily paused (early return, `?preview=1` still works) as an extra safety net pending Joshua confirming one real send correctly de-dupes on a second ping, now that the underlying data layer is fixed.

---

## [v7.15.1] — 2026-07-06

### Fixed — Weekly digest sending every ~5 minutes (real production incident)

- **`api/routes/cron.js`** — the `/cron/weekly-report` de-dupe guard (`last_weekly_digest_sent_at`) was gated behind `!force`, the same flag used to bypass the Monday-only day check. An UptimeRobot monitor URL with `?force=1` in it (recommended for manual testing) bypassed the de-dupe too, causing a real email to send to Joshua roughly every 5 minutes for over an hour before being caught — confirmed via Vercel runtime logs (12+ real Resend dispatches in one hour). De-dupe now always applies regardless of `force`; `force` only ever bypasses the day-of-week check.
- **`api/utils/mailer.js`** — brightened low-contrast text in the weekly digest and re-engagement email templates. Footer text (`#334155`/`#475569` on a `#0f172a` background) was nearly unreadable; row labels (`#94a3b8`) and description lines (`#64748b`) were borderline. Brightened to `#cbd5e1` (labels) and `#94a3b8` (descriptions/footer) for real contrast against the dark background.

---

## [v7.15.0] — 2026-07-06

### Security — BYOB Gemini API keys now encrypted at rest

- **`api/utils/cryptoUtil.js`** — new `decryptOrPlain()` helper: decrypts if the value is in encrypted form, otherwise passes it through unchanged. Lets the migration roll out with zero downtime — code ships first, works correctly on both migrated and not-yet-migrated rows.
- **`api/routes/settings.js`** — `POST /` now encrypts `gemini_api_key` before every upsert (same libsodium/`ENCRYPTION_KEY` pattern already used for Plaid tokens); `GET /` and the POST response both decrypt it back before returning to the frontend, so `IntelligenceTab.jsx` needs no changes.
- **6 downstream read sites** updated to decrypt before use: `api/routes/brain.js` (chat + ledger repair), `api/routes/receipts.js`, `api/routes/documents.js`, `api/routes/import.js` (silent-mode auto-clean), `api/routes/emailInbound.js`.
- **`api/scripts/encrypt-existing-gemini-keys.js`** (new) — one-time migration for keys already in the database, mirroring the existing `rotate-plaid-tokens.js` runbook shape. Idempotent (decrypt-tests each row first, skips already-migrated ones), `--dry-run` supported. **Needs to be run once against production** — see ROADMAP.md AI Brain section for the exact command.
- Found and corrected a detail from the v7.14.0 audit: `ai_silent_mode` is actually read (by `import.js`'s silent auto-clean on CSV import) — only `ai_coaching_mode` is fully inert.

---

## [v7.14.0] — 2026-07-06

### Added — A2: Deductions found ≈ tax savings dashboard hero stat

- **`api/routes/metrics.js`** — `/api/metrics/summary` now returns `snapshot.ytdDeductibleCents`, computed with the exact same formula tax.js uses for Schedule C (`amount × business_use_pct/100` when `tax_deductible`) — single source of truth, no second calculation to drift out of sync.
- **`DashboardV2.jsx`** — 5th executive-snapshot KPI card: "$X deductions found (YTD) ≈ $Y off your tax bill", using the same `estimated_tax_rate` setting as the B1 Tax Set-Aside widget.

### Fixed — Dashboard data-consistency audit

- **`api/utils/spendCategories.js`** (new) — extracted the transfer/refund exclusion logic that `cron.js`'s weekly digest already had (`NON_SPEND_CATS`, 16 categories) into a shared module. `metrics.js` previously used a much narrower 5-keyword substring filter, so rows like "Refund" or "Reimbursement" were excluded from the weekly digest but silently included in the dashboard's YTD income/spend/net — now both agree.
- **`OpIntellComponents.jsx`** — replaced manual `.toLocaleString()` cents formatting with a safe `Intl.NumberFormat` helper; a missing/undefined cost value previously rendered as `$NaN`.
- **Verified not a bug:** Operational Intelligence's "Expense Pressure" (all recurring vendors) vs. Subscriptions Radar (subscriptions only) are intentionally distinct, clearly-labeled metrics.
- **Flagged for Joshua's direction (not changed):** `tax.js`'s Schedule C summary applies no category exclusion at all, unlike the dashboard/digest — see ROADMAP.md Clean Up section.

---

## [v7.13.3] — 2026-07-06

### Added — `?preview=1` true dry-run mode for both new cron endpoints

- **`api/routes/cron.js`** — `GET /cron/weekly-report?preview=1` and `GET /cron/reengagement-report?preview=1` now compute and return full results without sending any email to anyone, not even admin, and without stamping the de-dupe timestamps. Matches `monthly-report`'s existing `?preview=1` query-param convention, but is a true no-send dry run rather than an admin-only real send — closes the gap that let a manual auth-verification curl on 2026-07-06 send real emails. The admin-only production gate (weekly-report) and the disabled-by-default gate (reengagement-report) from v7.13.2 are unchanged for live/non-preview calls.

---

## [v7.13.2] — 2026-07-06

### Changed — Restrict weekly digest + disable re-engagement automation

- **`api/routes/cron.js`** — while verifying the new cron endpoints against a live-loaded `CRON_SECRET`, the manual auth test (no `?preview=1` existed on either new endpoint, unlike `monthly-report`) sent a real weekly digest to Joshua and real re-engagement emails to 17 real inactive users. Per Joshua's direction: `/cron/weekly-report` now filters its user list to `ADMIN_UUID` only (real users get nothing until explicitly reopened); `/cron/reengagement-report` returns early with an "automation disabled" message — Joshua is handling re-engagement manually. Both gates are commented with the date and reason, and are meant to be removed once ready to go live for real users.

---

## [v7.13.1] — 2026-07-05

### Fixed — Weekly digest duplicate-send risk + Operational Intelligence dollar mismatch

- **`api/routes/cron.js`** — `GET /cron/weekly-report` only checked "is today Monday", with no guard against firing repeatedly within that day. Since UptimeRobot's free plan is interval-based polling (no true weekly cron support), a monitor pinging every 5 min–1 hr on a Monday would have sent every user the same digest dozens of times. Added a per-user `settings.last_weekly_digest_sent_at` guard (5-day window), matching the de-dupe already protecting the re-engagement email. Found while scoping the UptimeRobot monitor setup for the new B3/B4 cron endpoints — confirmed the account is on the free tier, so this needed fixing before those monitors go live.
- **`web-react/src/components/dashboard/OperationalIntelligenceSection.jsx`** — "Approx Monthly Expense" summed every non-ignored flagged vendor row (subscriptions, review, duplicate, unused all mixed together), while "Active Subscriptions" counted subscriptions only — two stats in the same panel computed from different row sets. A vendor flagged "review" but not a subscription (e.g. Hover, $34/mo) inflated the dollar total without being in the subscription count above it. Surfaced because the new Subscriptions Radar widget (v7.13.0) sits next to it and computes both figures from the same subscription-only set, exposing the $34/mo gap side by side on the dashboard. Scoped `monthly_total`/`annual_total` to subscription rows only, matching `active_count`.

---

## [v7.13.0] — 2026-07-02

### Added — Phase B retention features (B1–B5)

- **`web-react/src/components/dashboard/TaxSetAsideWidget.jsx`** (new) — "Set aside $X for Q3" dashboard widget. `ytdNet × estimated_tax_rate`; deadline dates match the existing quarterly logic in `api/routes/brain.js`. New `settings.estimated_tax_rate` field (default 30%), editable in `ProfileTab.jsx`.
- **`web-react/src/components/dashboard/SubscriptionsRadarWidget.jsx`** (new) — "$X/mo across N subscriptions" summary widget with top-3 vendors. Reuses `metrics.analytics.recurringVendors`, already fetched for Operational Intelligence — no duplicate network call.
- **`DashboardV2.jsx` / `DashboardTab.jsx`** — both new widgets wired into `dashboard_config.widgets` (default on) and role presets, same pattern as existing widgets.
- **`api/routes/cron.js`** — two new endpoints: `GET /cron/weekly-report` (money in/out, missing-receipt count, tax set-aside; self-checks for Monday, `?force=1` to override) and `GET /cron/reengagement-report` (14+ day inactive users via `user_daily_activity`, 30-day de-dupe guard via `settings.last_reengagement_sent_at`). Both respect new opt-out settings and follow the existing `isCronAuthorized()` pattern.
- **`api/utils/mailer.js` / `emailQueue.js`** — new `sendWeeklyDigestEmail()` and `sendReEngagementEmail()`, modeled on the existing monthly-report template styling.
- **`ProfileTab.jsx`** — new "Email Notifications" section with opt-out checkboxes for the weekly digest and re-engagement email.
- **`api/routes/invoices.js`** — PATCH now returns `firstInvoicePaid: true` when marking an invoice `paid` results in exactly 1 paid invoice for that user. `Invoice.jsx` shows a one-time in-app celebration (`InvoicePaidCelebration.jsx`) — no email, per design decision.
- **Ops note:** two new UptimeRobot monitors need to be added for the weekly-report and reengagement-report cron endpoints (same auth pattern as the existing daily/monthly/watchdog monitors).

---

## [v7.12.0] — 2026-07-02

### Added — Money Story + Home trust pass + UI micro-polish (A1/A3/D5 of Growth & Polish)

- **`web-react/src/components/MoneyStoryModal.jsx`** (new) — after every successful CSV import, Plaid connect, or sync: "$X likely deductions / Y recurring subscriptions / Z flagged for review." Pulls `/tax/summary` + `/metrics/summary`; flagged count from the import/sync response. Stat cards deep-link to Tax / Dashboard / Transactions. "Don't show again" persists `money_story_optout` to settings (cross-device); modal self-suppresses if opted out.
- **`web-react/src/components/ModalShell.jsx`** (new) — shared rich-modal shell extracted from OnboardingChecklist (D6).
- **`Import.jsx` / `PlaidLink.jsx`** — trigger Money Story on successful import (`inserted+merged>0`), first connect (`synced>0`), and manual sync (`added>0`). `OnboardingChecklist.jsx` data-import page now mentions the Money Story.
- **`Home.jsx`** — trust pass: CSS product mockup with browser chrome + KPI cards + bar chart (labeled "illustrative data"); founder's note ("You focus on the shot. We'll focus on the finances."); "Made For How You Work" persona scenario cards (illustrative — intentionally not fake named testimonials, per FTC fake-review rule; swap in real quotes later); security strip (RLS isolation, encrypted bank tokens, BYOB AI, SOC 2 infra) linking to `/security-policy`; SECURITY footer link.
- **`index.css`** — D5: `.skeleton` shimmer loader, `.empty-state`, opt-in `.card-hover`, semantic amount colors (`.amt-income/.amt-expense/.amt-danger/.amt-deduction`).
- **`Transactions.jsx` / `Accounts.jsx`** — real empty states with "Import a CSV or connect your bank" CTA → `/import`.

---

## [v7.11.1] — 2026-07-02

### Fixed — Fraunces font not loading in production

- **`vercel.json`** — the static-asset rewrite whitelist didn't include `fonts/` or `.woff2`, so `/fonts/Fraunces-latin-var.woff2` fell through to the SPA fallback and returned `index.html` (HTTP 200 + HTML). Browsers silently fell back to Georgia serif. Confirmed by curling production: `content-type: text/html` on the font URL. Added `fonts/.*` and `.*\.woff2` to the whitelist. Local dev/preview was unaffected (Vite serves `public/` directly), which is why v7.11.0 verification passed.

---

## [v7.11.0] — 2026-07-02

### Added — Brand pass (D1–D4 of the Growth & Polish Initiative)

- **`web-react/public/fonts/Fraunces-latin-var.woff2`** (new) + **`index.html`** — self-hosted Fraunces variable font (18KB, latin subset, preloaded). No CDN — privacy story stays clean.
- **`web-react/src/index.css`** — new `--display` font var applied to `.title`, `h1`–`h3`; accent refined `#2f6bff` → `#4c7dff` (`--accent2: #2a55d9`, new `--accent-glow`); all 15 hardcoded accent-blue values replaced with `var(--accent)` / `color-mix()` so future accent changes are one-line; new `.money` utility (mono + tabular-nums) and tabular-nums on `.stat .v`, `.txnCard .amt`, `.mono`.
- **`lucide-react`** (new dependency) — replaced ~25 emoji UI icons with SVG icons across `App.jsx` (bottom nav), `Home.jsx` (feature grid + AI prompts), `OnboardingChecklist.jsx` (feature grid, roles, setup steps, data-import cards, resume button), `Accounts.jsx` (type groups, hide/show eye, Reconnect/Sync buttons), `AddOns.jsx`, `Assets.jsx` (receipt links), `PayInvoice.jsx` (status icons, attachment/signed badges). Assets category emoji kept — they render inside native `<option>` elements where SVG can't go. 🚩 ledger flag kept deliberately.
- **`ModalContext.jsx`** — branded alert/confirm modal now fully on-theme: Fraunces header, theme accent vars replacing off-palette indigo, `BrainCircuit` icon replacing 🧠.
- **`OpIntellComponents.jsx`** — currency cells/KPIs use the `.money` class for aligned digits.
- **`ROADMAP.md`** — new "Growth & Polish Initiative" section: Phase A (Money Story, deductions hero stat, Home trust pass), Phase B (tax set-aside, subscriptions radar, weekly digest, re-engagement email, first-payment celebration), Phase C (P&L view, receipt auto-match), D5/D6 design follow-ups.

---

## [v7.10.21] — 2026-07-01

### Fixed — Annual Security Review: overly-permissive RLS policy

- **`api/tests/user-daily-activity-rls-fix.sql`** — `user_daily_activity` had two RLS policies: the correct one (`auth.uid() = user_id`) and a second named `"Service role full access"` with `qual: true` — unconditionally permissive to any caller, not actually scoped to the service role (RLS policies don't inspect caller role by name; `service_role` already bypasses RLS entirely via `BYPASSRLS`, so the policy was redundant for its own stated purpose). Postgres RLS OR's multiple permissive policies together, so the `true` policy would win over the correct one for any future code path using the anon client here. Current exploitability was zero — every existing call site (`activity.js`, `cron.js`, `admin.js`) already uses the service-role client — but this closes a real latent gap. Dropped the redundant policy; the correct per-user one remains.
- Full dependency major-version audit re-confirmed: same deferred majors as the quarterly review (`plaid`, `stripe`, `zod`, `express`, others), nothing new to safely bump.
- Logged as completed annual review in `security_reviews` table.
- **Still needs Joshua's own review** (not something I can verify from code): Stripe/Plaid Terms of Service for payment-processor policy changes, and Google OAuth consent screen re-verification status in Google Cloud Console.

---

## [v7.10.20] — 2026-07-01

### Fixed — Quarterly Security Review (npm outdated + Code Drift Audit)

- **Dependency updates** — `npm update` in both `api/` and `web-react/`: all bumps landed within existing `package.json` semver ranges (only `package-lock.json` changed). Majors intentionally deferred and unchanged (`plaid` 29→43, `stripe` 17→22, `zod` 3→4, `express` 4→5, others) — all high-risk breaking changes on live production surfaces, need dedicated testing passes, not a quarterly-review drive-by.
- **Code Drift Audit — phantom tables**: no real phantom tables found, but the audit checklist's own grep (`SecurityReviewTab.jsx`) only matched single-quoted `.from('table')` calls — silently missing every double-quoted one (`"clients"`, `"vendor_settings"`, `"invoice_items"`, etc.) every quarter until now. Fixed the grep to catch both quote styles. Also confirmed `documents`/`receipts` hits are `.storage.from()` Storage bucket refs, not DB tables — false positives, documented in the checklist note so future runs aren't confused by them.
- **Code Drift Audit — silent DB failures**: fixed 7 of the ~20 flagged call sites, prioritized by real risk — the ones where a silent failure would report success to a user/system while nothing actually happened: `expenses.js` (duplicate-review resolve endpoint, retroactive Plaid-link merge, manual merge-duplicates endpoint), `stripe.js` (payment-succeeded renewal — billing-critical), `plaid.js` (the new v7.10.16 webhook handler's own DB updates), `admin.js` (`/admin/import-all`'s wipe-before-restore — a failed delete followed by insert would have silently duplicated every row), `brain.js` (AI ledger-repair batch, was reporting fake success counts), `emailInbound.js` (pending-receipt insert — was telling users their receipt was safely saved even when the DB write failed, the exact failure mode this pipeline exists to prevent). Remaining lower-risk sites (cleanup deletes, cosmetic vendor auto-correction) left as-is, tracked in `ROADMAP.md`.
- **Code Drift Audit — stale hardcoded value lists**: found and fixed a real gap in `admin.js`'s subscription-edit endpoint — `sync_monthly`/`sync_annual` were missing from the "Stripe-managed plan" list, so admin-editing a Sync-plan user's `plan_type` would have incorrectly set a fake 999-day `expires_at` instead of nulling it (Stripe-managed).
- Logged as a completed quarterly review in the `security_reviews` table.

---

## [v7.10.19] — 2026-07-01

### Fixed — Monthly npm audit (Security Review)

- **`api/`** — fixed 2 high-severity vulnerabilities: `form-data` (CRLF injection via unescaped multipart field/filenames, transitive via `plaid` → `axios`, 4.0.5 → 4.0.6) and `multer` (DoS via deeply nested field names + incomplete aborted-upload cleanup, 2.1.0 → 2.2.0). Both non-breaking — `npm audit fix`, no `package.json` changes needed, only `package-lock.json`. Verified `receipts.js`/`pwa.js`/`plaid.js` still load correctly after the bump. `file-type` moderate vuln remains — known, deferred (ESM-only v22 requires a `receipts.js` refactor, near-zero real risk).
- **`web-react/`** — all 5 vulnerabilities cleared (`@babel/core`, `dompurify`, `esbuild`, `js-yaml`, `vite`/`launch-editor`) via `npm audit fix`. Verified production build still succeeds.

---

## [v7.10.18] — 2026-07-01

### Removed — Temporary Plaid webhook backfill endpoint

- **`api/routes/admin.js`** — `POST /admin/backfill-plaid-webhooks` removed. Confirmed via a live dry-run + real run: all 8 active connections (Credit One Bank, Capital One ×2, Navy Federal, America First Credit Union, American Express, Venmo, USAA) successfully registered the webhook. Plaid connection health events now flow in real time for every existing connection, not just new ones.

---

## [v7.10.17] — 2026-07-01

### Added — Temporary admin endpoint for Plaid webhook backfill

- **`api/routes/admin.js`** — `POST /admin/backfill-plaid-webhooks` (admin-only, supports `?dry_run=1`). Runs the same backfill as `api/scripts/backfill-plaid-webhooks.js` but server-side in production, because `ENCRYPTION_KEY` is marked **Sensitive** in Vercel — a write-only flag that means the value can never be copied back out of the dashboard, so the standalone local script couldn't decrypt tokens without it. Running server-side uses the value Vercel already injects at runtime without ever needing to expose it.
- **Temporary** — remove this route once the backfill is confirmed run. Tracked in `ROADMAP.md`.

---

## [v7.10.16] — 2026-07-01

### Added — Plaid webhook for real-time connection health

- **Root cause this fixes**: `needs_reauth` detection (v7.10.9) only ran during a sync, polling `itemGet`'s `item.error` field — confirmed during the Venmo investigation that Plaid's internal item state can diverge from that field, so failures weren't always caught. This gets pushed the moment Plaid knows about it instead.
- **`api/routes/plaid.js`** — new `plaidWebhookHandler`, verified via Plaid's JWT signature scheme (`Plaid-Verification` header, ES256, key fetched via `webhookVerificationKeyGet` and cached, replay-protected to 5 minutes, body-hash checked against the raw request bytes). Handles `ITEM` webhook codes: `ERROR` (sets `needs_reauth` only if the error code is reauth-worthy), `PENDING_EXPIRATION`/`USER_PERMISSION_REVOKED` (always reauth-worthy), `LOGIN_REPAIRED` (clears the flag). `webhook: PLAID_WEBHOOK_URL` added to both `linkTokenCreate` calls so all new/reauthed items register it automatically.
- **`api/server.js`** — `POST /api/plaid/webhook` mounted before `authMiddleware` (public — Plaid calls it directly, no user session). Captures the raw request body alongside the parsed JSON since the JWT verification needs to hash the exact raw bytes.
- **`api/scripts/backfill-plaid-webhooks.js`** (new) — one-time script to register the webhook on every existing active connection via `itemWebhookUpdate`, since they predate this feature. Supports `--dry-run`. **Needs to be run once** — see runbook note below.
- No new dependencies — reused `jsonwebtoken` and Node's built-in `crypto` (JWK → PEM import), both already in the project.

---

## [v7.10.15] — 2026-07-01

### Fixed — Broken Vercel dashboard links in Security Review checklist

- **`web-react/src/components/control-center/SecurityReviewTab.jsx`** — 3 links (Runtime Logs, Deployments, Env Variables) used the wrong Vercel org slug (`through-the-lens-media` instead of `throughthelensmedias-projects`), 404ing every time. Found while running the weekly Security Review checklist.

---

## [v7.10.14] — 2026-07-01

### Added — Cloudflare Turnstile on signup

- **`web-react/index.html`** — added Turnstile script tag.
- **`web-react/src/pages/Login.jsx`** — Turnstile widget rendered on the signup form only (imperative `window.turnstile.render()`, polls briefly for the async script to load). Submit is disabled until a token exists; `/api/verify-turnstile` is called before `supabase.auth.signUp()` fires; widget resets after every attempt since tokens are single-use.
- **`api/server.js`** — new public `POST /api/verify-turnstile` endpoint, verifies against Cloudflare's `siteverify` API using `TURNSTILE_SECRET_KEY`. **Fails open** (allows signup through) if the env var isn't set, so a missing key can never break real signups — it just means the check is inactive until configured.
- **Requires action**: add `TURNSTILE_SECRET_KEY` to Vercel's env panel (Production scope) for this to actually take effect — the site key is already hardcoded in `Login.jsx` (it's meant to be public).
- Note: Turnstile only stops bots that load the real signup page — it doesn't stop a script calling Supabase's auth API directly, bypassing the frontend. The email-confirmation gate shipped in v7.10.13 is what actually neutralizes that pattern.

### Added — Admin SaaS panel split into tabs

- **`web-react/src/components/control-center/SaasTab.jsx`** — split the single long-scroll panel into 3 tabs (Active Members / Invite Codes / Engagement Pulse) using the same underline-tab pattern already used by System Logs' Receipt Sessions / All Events toggle, for visual consistency.

---

## [v7.10.13] — 2026-07-01

### Fixed — Spam/bot signups getting full active accounts with no verification

- **Root cause**: `user_subscriptions` has column defaults `plan_type = 'free_beta'`, `status = 'active'`. The `handle_new_user()` trigger fired unconditionally on every `auth.users` insert — meaning any signup, confirmed or not, got a fully working 30-day trial account instantly. Confirmed via direct DB query: 4 scripted signups (`shunt_<timestamp>_<hex>@gptmail.ca` pattern) all had `email_confirmed_at = null` yet all showed `status: active` on `free_beta`.
- **`api/migrations/010_gate_trial_on_email_confirmation.sql`** — `handle_new_user()` now only grants the trial when `email_confirmed_at IS NOT NULL`. A second trigger (`on_auth_user_confirmed`, `AFTER UPDATE OF email_confirmed_at`) catches email/password signups, which have `email_confirmed_at = NULL` at insert time and only get it set later when the user clicks the confirmation link. OAuth signups (Google) already arrive pre-confirmed, so they're unaffected. Idempotent via `ON CONFLICT (user_id) DO NOTHING`.
- **`api/routes/subscription.js`** — `/subscription/redeem` switched from `.update()` to `.upsert()` so redeeming a beta code still works even if a user redeems before their email confirmation has landed (no subscription row would otherwise exist yet to update).
- Confirmed with Joshua: self-serve Stripe checkout (no invite code) remains untouched by this — real confirmed users still get the same automatic trial as before, this only blocks unconfirmed/bot signups.

---

## [v7.10.12] — 2026-07-01

### Fixed — Monthly/weekly reports and watchdog were querying a table that doesn't exist

- **Root cause**: confirmed via Vercel runtime errors — `/cron/monthly-report`, `/admin/daily-report`, `/admin/weekly-report`, and `/cron/watchdog` all queried a `profiles` table that was never created in this Supabase project (only `user_roles` exists, and it has no email/display_name columns). The monthly report cron threw a fatal `PGRST205` on every run and never sent; the watchdog health check was failing on every invocation with a false "DATABASE ERROR".
- **`api/utils/userDirectory.js`** (new) — `listAllUsers()` uses Supabase's own Auth admin API (`supabase.auth.admin.listUsers()`) as the real source of truth for user id/email/display name, instead of a nonexistent table.
- **`api/routes/cron.js`**, **`api/routes/admin.js`** — all 4 call sites now use `listAllUsers()`. Watchdog's table-reachability ping switched to the real `user_roles` table.

### Fixed — Activity tracking race condition (recurring since March 2026)

- **`api/routes/activity.js`** — `POST /activity/pulse` used a select-then-insert-or-update pattern with no protection against concurrent requests (e.g. multiple open tabs pulsing at once). Two requests could both see "no row yet" and both try to insert, and the second would hit the unique constraint on `(user_id, activity_date)` and fail with a 500. Fixed by catching the specific unique-violation error and falling back to an increment instead of failing the request.

---

## [v7.10.11] — 2026-07-01

### Fixed — Sync-plan users showed as "free" tier in the UI

- **Root cause**: `deriveTier()` existed as 4 independent copies (`api/routes/stripe.js`, `api/middleware/licensing.js`, `web-react/src/components/AuthContext.jsx`, `web-react/src/components/control-center/SaasTab.jsx`). The frontend copies (AuthContext, SaasTab) never recognized `sync_monthly`/`sync_annual` plan types and fell through to `'free'`, while the backend billing logic in stripe.js correctly resolved them to `'sync'` — so Sync-plan subscribers saw wrong upgrade prompts and wrong tier badges in the UI even though billing was correct.
- **`web-react/src/constants/billing.js`** (new) — single shared `deriveTier()` + `PLAID_EXEMPT_IDS`, imported by `AuthContext.jsx` and `SaasTab.jsx` instead of each keeping its own copy.
- **`api/routes/stripe.js`** — `deriveTier()` also now maps legacy `monthly`/`annual` plan_type values to `core` (matching SaasTab's prior behavior, preserving the one existing legacy subscriber's display).
- **`api/middleware/licensing.js`** — left its own separate `deriveTier()` untouched and documented why: it intentionally treats Sync the same as free for SaaS feature quotas (Sync only pays for Plaid access, not expanded limits) — added a comment so it isn't "fixed" into a `TIER_LIMITS` crash by mistake later.

### Added — Shared constants files to prevent hardcoded-value drift

- **`api/constants.js`** (new) — single source of truth for `ADMIN_UUID`, `MICHELLE_UUID`, and `PLAID_BILLING_EXEMPT`. Previously the admin UUID was hardcoded independently in 6 places (`plaid.js`, `stripe.js`, `auth.js`, `intake.js`, `cron.js`, `SaasTab.jsx`) and the Plaid-exempt list in 3 places — all now import from this file. Confirmed exemption policy unchanged: only Joshua and Michelle are exempt from the $0.50/account Plaid fee, everyone else pays.
- **`web-react/src/constants/billing.js`** (new) — frontend counterpart holding `PLAID_EXEMPT_IDS` (mirrors `api/constants.js` — no shared package across the frontend/backend boundary exists, so these two must be kept in sync by hand).

### Fixed — Feedback emails could silently fail to deliver

- **`api/routes/feedback.js`** — fallback `from` address was `support@lumiereledger.com`, an **unverified** Resend sending domain (Resend returns 200 and silently drops the email). Every other mailer in the app already correctly falls back to `support@throughthelens.media`, the verified domain — feedback.js was the one file still pointing at the wrong one.

---

## [v7.10.10] — 2026-07-01

### Fixed — "What's New" badge re-lighting after being read

- **`web-react/src/App.jsx`** — Root cause: `handleWhatsNewClick()` stamped `localStorage.ll_whats_new_seen` with a stale hardcoded `CURRENT_VERSION = "7.8.56"`, completely disconnected from the real `CURRENT_VERSION` used by the version-check effect to decide whether to show the badge. Every click stored the wrong value, so the next check (`seen !== CURRENT_VERSION`) was always true and the badge lit right back up. Fix: hoisted `CURRENT_VERSION` to a single module-level constant so the check and the dismiss handler always agree.

---

## [v7.10.9] — 2026-07-01

### Fixed — Plaid Amex duplicate transactions

- **`api/routes/plaid.js`** — Root cause: on every pending→posted transition, the old "removed" handler decided delete-vs-unlink using `hasUserData` (notes/receipt/tax_deductible), but auto-generated sync notes made that check always true — the old pending row was never deleted, and a new posted row was inserted alongside it, permanently. Fix: when Plaid's `added` transaction includes `pending_transaction_id`, merge it into the existing row in place (new `plaid_transaction_id`/date/amount, vendor upgraded only if still auto-generated) instead of inserting a new row. Nothing with user data is ever deleted.
- **Backfill** — Ran the new duplicate-detection query against the live Amex connection: found 25 duplicate pairs dating back to 2026-06-01 (all pending→posted duplicates from this bug), flagged via `needs_review`/`review_pair_id` for manual review/merge in the Transactions page. No rows deleted.

### Added — Auto duplicate detection on Plaid sync

- **`api/routes/expenses.js`** — Extracted the `scan-dupes` pairing logic into a shared `scanForDuplicates()` helper.
- **`api/routes/plaid.js`** — Every sync now auto-runs the duplicate scan on any account with new activity, flagging possible duplicates with the existing 🚩 badge + Near-Duplicate Review Modal in Transactions — no new UI, early-warning safety net on top of the merge fix above.

### Added — Plaid connection health / reconnect flow

- **`api/tests/plaid-item-health-migration.sql`** — Added `needs_reauth` and `last_item_error` columns to `plaid_connections` (idempotent).
- **`api/routes/plaid.js`** — Every sync now calls Plaid's `itemGet` per connection and stores the real item error state, instead of connections silently sitting broken with no signal (root cause of Venmo going stale with zero visibility — its item was stuck in Plaid's internal "Retrying" state with no error surfaced anywhere). `create-link-token` now supports update mode via `{ connection_id }` to re-auth an existing item without a new connection or re-triggering the billing gate.
- **`web-react/src/pages/Accounts.jsx`** — Shows a "⚠️ Reconnect" badge on any Plaid account needing re-auth, with a one-click button that reopens Plaid Link in update mode.
- **`api/routes/accounts.js`** — `/accounts/summary` now returns `needs_reauth`/`last_item_error` per connection.

---

## [v7.10.8] — 2026-06-15

### Cleanup

- **`web-react/src/components/MonthlyInsightsModal.jsx`** — Deleted. Monthly summary modal removed entirely.
- **`web-react/src/App.jsx`** — Removed import, state, trigger `useEffect`, and render of `MonthlyInsightsModal`.

---

## [v7.10.7] — 2026-06-12

### Categories — Bug Fixes & UX

- **`api/routes/categories.js`** — Fixed orphan delete: `category = ''` instead of `null` (column is NOT NULL); fixed Express route ordering (`/orphan` before `/:id`).
- **`web-react/src/components/control-center/CategoriesTab.jsx`** — Parallel delete via `Promise.allSettled`; re-fetches from DB after delete to confirm actual state; surfaces failed deletes by name.
- **`web-react/src/pages/Backup.jsx`** — Admin pill moved to end of nav, beside Infrastructure.

---

## [v7.10.6] — 2026-06-11

### User-Managed Categories

- **`api/migrations/009_user_categories.sql`** — New `user_categories` table with RLS. Stores per-user custom categories with a `type` column (`expense | income | misc_income`). Unique constraint on `(user_id, name)`.
- **`api/routes/categories.js`** — New route: GET list, POST create, PUT rename (also updates matching expense rows), DELETE (returns 409 with count if transactions use it; `?force=true` to confirm).
- **`api/routes/expenses.js`** — Added `GET /expenses/distinct-categories` — returns unique non-null category strings for the user (used by the import banner in CategoriesTab).
- **`api/server.js`** — Mounted `/api/categories` route.
- **`web-react/src/components/CategorySelect.jsx`** — Now accepts `customCats` prop (array of `{ id, name, type }`) and renders them under the correct optgroup with a ✦ marker. `showCustom` now surfaces a `+ New Category…` option instead of the old `✚ Custom Category…` sentinel.
- **`web-react/src/components/TransactionDrawer.jsx`** — Fetches custom categories on mount. Replaces freeform text input with an inline new-category form (name + type select). Legacy freeform values show a one-click "Save it" prompt.
- **`web-react/src/pages/Transactions.jsx`** — Category filter dropdown now merges custom categories under the correct optgroup (with ✦ marker).
- **`web-react/src/components/control-center/CategoriesTab.jsx`** — New LCC tab: built-in categories listed read-only; custom categories have inline rename + delete (with transaction count warning). `+ Add` form at bottom of each section. Import banner for legacy freeform categories.
- **`web-react/src/pages/Backup.jsx`** — Added Categories pill and `<CategoriesTab />` render.

---

## [v7.10.5] — 2026-06-10

### Plaid Balance API — Backend 10-Day Throttle

- **`api/routes/plaid.js`** — `GET /plaid/balances` now checks `last_balance_sync` and `cached_balances` on the `plaid_connections` row before calling Plaid. If within 10 days, the DB cache is returned directly — no paid Plaid call. When Plaid IS called, the result is written back to the DB so all devices and sessions share the same throttle window.
- **`web-react/src/pages/Accounts.jsx`** — Removed the balance cache clear that fired after every transaction sync. Transaction sync and balance refresh are independent operations.
- **Supabase migration** — Added `last_balance_sync TIMESTAMPTZ` and `cached_balances JSONB` columns to `plaid_connections` (idempotent `IF NOT EXISTS`).

---

## [v7.10.4] — 2026-06-10

### PWA AI Fix, Onboarding Re-entry, Branding Cleanup

- **`AssistantSidebar.jsx`** — Input area and 🚀 send button now clear the 72px mobile bottom nav bar. Added `paddingBottom: calc(20px + 72px + env(safe-area-inset-bottom, 0px))` to the input wrapper.
- **`App.jsx`** — "Setup Guide" item added to hamburger menu; dispatches `ll:reopen-onboarding` event. Only visible while onboarding is still in progress. Bottom nav "Studio" label renamed to "Dashboard". "Business Profile" menu item renamed to "Profile".
- **`OnboardingChecklist.jsx`** — Step title changed from "Set Up Business Profile" to "Set Up Your Profile".
- **`ProfileTab.jsx`** — Heading changed from "Business Profile Branding" to "Profile Branding". Subtitle "Studio identity" → "Your identity".
- **`Backup.jsx`** — System Status panel is now admin-only.
- **`ROADMAP.md`** — AI Brain: Combine Similar Transactions added to Good to Have backlog.

---

## [v7.10.3] — 2026-06-09

### Security Review — Code Drift Audit Added to Quarterly Tier

- **`web-react/src/components/control-center/SecurityReviewTab.jsx`** — Quarterly Deep Review checklist now includes 3 Code Drift Audit items with copyable grep commands: phantom table detection (`.from()` vs live schema), silent DB failure detection (unchecked `{ error }` on writes), and stale hardcoded value lists (legacy plan types). Each item notes the production bug class it would have caught (v7.10.0–v7.10.2).

---

## [v7.10.2] — 2026-06-09

### Stripe Webhook — Error Checking on Subscription Writes

- **`api/routes/stripe.js`** — `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` handlers now destructure `{ error }` from the `user_subscriptions` write and throw on failure. Previously a failed write returned 200 to Stripe (no retry, silent billing state corruption). Now a failed write returns 500 → Stripe retries the event for up to 3 days.

---

## [v7.10.1] — 2026-06-09

### SaaS Admin — Display Name Save Fix

- **`api/routes/admin.js`** — PATCH /subscriptions: fixed display name save; was writing to non-existent `profiles` table, now correctly writes `display_name` to `user_subscriptions`. GET /subscriptions: removed stale `profiles` join that always returned empty; `display_name` now read directly from `user_subscriptions` row.
- **`ROADMAP.md`** — Added 4 code audit findings as Clean Up items: silent DB failures in expenses.js and plaid.js, unchecked Stripe webhook errors (high risk), stale profiles references in cron.js.

---

## [v7.10.0] — 2026-06-09

### SaaS Admin — Tier Badge Fix, Display Name Save Fix, Notes in Edit Modal

- **`web-react/src/components/control-center/SaasTab.jsx`** — `deriveTier()`: added `'annual'` and `'monthly'` to core tier mapping; EDIT button pre-populates `notes`; edit modal has notes textarea; `handleUpdateSession` sends `notes` in PATCH.
- **`api/routes/admin.js`** — GET /subscriptions: joins `beta_codes` by `assigned_to_email` to return `notes` per member. PATCH /subscriptions: changed `upsert` → `update` on profiles with error check; accepts `notes` and updates `beta_codes` by user email.

---

## [v7.9.9] — 2026-06-09

### Receipt Email — Generate HTML Receipt Card for Body-Parse-Only Emails

- **`api/routes/emailInbound.js`** — After successful body parse with no attachment, generates a self-contained HTML receipt card (vendor, amount, date, order ref, category, notes) and uploads it as the stored file. `storedFilePath` is now populated on the body-parse path, so `receipt_link` is set correctly on the matched expense row. Previously the match was logged but `receipt_link` stayed null.

---

## [v7.9.8] — 2026-06-09

### Receipt Email — Gemini Retry + AI Unavailable Failure Email

- **`api/utils/receiptEmailParser.js`** — `parseReceiptFromEmailBody` now retries up to 3 times (2s, 4s backoff) on transient 503/502/500 errors, matching the existing retry logic in `parseReceiptFromFile`. Re-throws with `isTransient: true` after all retries exhausted so caller can send the right email.
- **`api/routes/emailInbound.js`** — Catches `isTransient` throws from body parse; routes to `ai_unavailable` outcome instead of generic `failed`.
- **`api/utils/mailer.js`** — New `ai_unavailable` outcome: orange heading, explains high demand, prompts user to forward again later.

---

## [v7.9.7] — 2026-06-09

### SaaS Admin — Invite Plan Fix, Notes, Engagement Pulse Tier Badges

- **`api/routes/admin.js`** — POST `/beta-codes` now inserts `plan_type` and `notes` correctly; PATCH updates both fields. GET `/daily-report` returns `plan_type` per user row.
- **`api/utils/mailer.js`** — `sendInviteEmail` accepts `plan_type`; email body now includes "Your Access Level" block with human-readable plan label (Lifetime Free Access, 90-Day Beta Access, Core Plan, etc.). CTA updated to "ACTIVATE & CREATE ACCOUNT".
- **`web-react/src/components/control-center/SaasTab.jsx`** — Invite creation form: `inviteNotes` state + textarea (internal, never sent). Notes column added to Access Inventory table (truncated 45 chars). Engagement Pulse rows now show plan tier badge (TIER_COLORS + deriveTier) next to each user's name.

---

## [v7.9.6] — 2026-06-09

### Plaid Sync Plan Account Cap + Icon Fix

- **`api/routes/plaid.js`** — `create-link-token` now enforces a 5-account limit for Sync plan users (`sync_monthly`, `sync_annual`). Returns HTTP 403 `plaid_account_limit` when limit is reached. Core/Studio/exempt users bypass the check.
- **`web-react/src/components/PlaidLink.jsx`** — Detects `plaid_account_limit` 403 response; renders upgrade UI with Core and Studio CTAs and a note to disconnect existing accounts.
- **`web-react/src/pages/Home.jsx`** — Gear Depreciation feature card icon changed from 📷 to 🔧; pricing table Sync "Live Bank Sync" row updated to show "Up to 5 accounts" badge.

---

## [v7.9.5] — 2026-06-09

### Open Signup + SaaS Admin Enrichment

- **`web-react/src/pages/Login.jsx`** — Open public signup with two paths: free account (no code required) and invite-code path. Invite codes are validated server-side before account creation; code stored in localStorage for auto-redemption after email confirmation + login.
- **`web-react/src/components/AuthContext.jsx`** — `SIGNED_IN` handler auto-redeems `lumiere_pending_code` from localStorage, then refreshes subscription. Clears stale codes for wrong email.
- **`api/server.js`** — Added `GET /api/subscription/validate-code/:code` as a public route (before authMiddleware) — confirms a code is valid without redeeming it.
- **`api/routes/admin.js`** — `GET /admin/subscriptions` now returns `plaid_account_count`, `joined_at`, `admin_tier` per member. `PATCH /admin/subscriptions/:userId` handles new plan types correctly (Stripe plans clear `expires_at`).
- **`web-react/src/components/control-center/SaasTab.jsx`** — Active Ledger Members table adds TIER badge, monthly cost estimate (plan + Plaid fee), Plaid account count, and join date. PLAN_OPTIONS updated to current plan_type values.

---

## [v7.9.4] — 2026-06-08

### Fix: Gear Panel Stacking Context Over KPI Tiles

- **`web-react/src/pages/DashboardV2.jsx`** — Added `zIndex: 10` to the dashboard header card. Root cause: `.glass` CSS class uses `backdrop-filter: blur()` which creates a new stacking context on every element. KPI tiles (later in DOM) were painting over the gear panel despite its `zIndex: 9999`, because that z-index was scoped to the header's stacking context. Elevating the header's context resolves the overlap.

---

## [v7.9.3] — 2026-06-08

### LCC Restructure + Dashboard Gear Fix

- **`web-react/src/pages/DashboardV2.jsx`** — Fixed dashboard gear panel clipping. Header card `overflow: hidden` changed to `overflow: visible` — all 6 widget toggles now fully visible.
- **`web-react/src/pages/Backup.jsx`** — Complete LCC nav restructure: pills reordered alphabetically (Admin, AI Intelligence, Automation, Dashboard, Documents, Help Center, Integrations, Profile); removed Feedback and 3 admin pills (SaaS/Logs/Security); added single Admin pill with orange dot indicator; legacy URLs `?tab=feedback/saas/logs/security` redirect gracefully; removed unused imports.
- **`web-react/src/components/control-center/AdminTab.jsx`** — New file. Consolidated admin panel with internal sub-nav (SaaS Management / System Logs / Security). Styled sub-nav with orange accent on active section.
- **`web-react/src/components/control-center/HelpTab.jsx`** — Feedback form merged into bottom of Help Center tab. Full form with type selector, textarea, diagnostics toggle, submit. No separate Feedback tab needed.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — License Activation card added to `billingOnly` view — all users can now redeem keys from Account Plans without needing admin access.
- **`web-react/src/components/control-center/AutomationTab.jsx`** — Vendor Keyword input now shows autocomplete from transaction ledger vendor list via native HTML `<datalist>`. Zero new dependencies.

---

## [v7.9.2] — 2026-06-08

### Fix: Account Plans Nav + Billing Tab

- **`web-react/src/App.jsx`** — Hamburger "Account Plans" link updated from `?tab=profile` to `?tab=billing`.
- **`web-react/src/pages/Backup.jsx`** — Added `tab=billing` to URL allowlist + render condition pointing to `<ProfileTab billingOnly />`.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Added `billingOnly` prop: when true renders only the subscription/billing section with an "Account Plans" heading, skipping the business profile form.

---

## [v7.9.1] — 2026-06-08

### Feature: Dashboard Customization — Role Selector, Widget Toggles, Smart Empty States

- **`web-react/src/components/OnboardingChecklist.jsx`** — Added role selector as Page 1 (Step 1 of 3) in the onboarding wizard. 4 roles: Photographer (includes Videographers), Freelancer, Small Business, Personal/Side Hustle. Clicking a role saves a `dashboard_config` preset to settings and advances the wizard. Added `apiPost` import.
- **`web-react/src/pages/DashboardV2.jsx`** — Settings fetched in parallel with metrics on mount. Widget flags control visibility of 6 sections: Invoice & Receivables, Year-End Forecast, Monthly Performance Chart, Financial Insights, Top Expense Drivers, Operational Intelligence. Gear icon ⚙️ in header opens inline toggle panel with per-section checkboxes, saved immediately to settings. Smart empty states added: zero-invoice prompt, no-transactions prompt for expense drivers, no-data note for performance chart.
- **`web-react/src/components/control-center/DashboardTab.jsx`** — New control center tab. Role selector with change confirmation, per-widget toggles with ON/OFF indicators, auto-save on toggle.
- **`web-react/src/pages/Backup.jsx`** — Added Dashboard tab import, pill nav button, render condition, and `'dashboard'` to URL param allowlist.

---

## [v7.8.99] — 2026-06-08

### Feature: Flag for Review Toggle in Transaction Drawer

- **`web-react/src/components/TransactionDrawer.jsx`** — Added "🚩 Review" checkbox to the drawer alongside Tax Deductible and Recurring. Toggling it sets `needs_review` on the expense. Loads correctly when reopening a flagged transaction. No DB migration — `needs_review` column already existed. Flagged transactions surface via the existing 🚩 Needs Review filter on the Transaction Ledger.

---

## [v7.8.98] — 2026-06-08

### Enhancement: Security Checklist — Commands + Links

- **`web-react/src/components/control-center/SecurityReviewTab.jsx`** — Restructured all checklist items with sub-bullets. Terminal commands render as copyable code blocks (monospace, Copy button). Dashboard links render as clickable `↗` links opening in a new tab. Plain notes render as italicized hints. Covers all 5 review tiers (weekly/monthly/quarterly/annual/dependency).

---

## [v7.8.97] — 2026-06-08

### Fix: Security Reviews API 404

- **`api/routes/admin.js`** — Catch-all `router.all("*")` was placed before the security-reviews routes, intercepting every request before they could match. Moved catch-all to the very bottom of the file (after all routes, before `module.exports`).

---

## [v7.8.96] — 2026-06-08

### Fix: Receipt Body Parse Hardening + Security Tab + Onboarding Receipt Step

- **`api/routes/emailInbound.js`** — Added explicit `apiKey` guard before body parse fallback. Wrapped `parseReceiptFromEmailBody` in try/catch so a thrown error logs to System Logs instead of swallowing silently.
- **`api/utils/receiptEmailParser.js`** — Improved prompt: `amount_cents` instruction now explicitly calls out "Total Paid", "Total Charged", "Amount Due", "Amount Charged", "Grand Total", "You Paid", "Order Total", "Charge" labels. Added `log` import — Gemini call failures and JSON parse failures now write to System Logs (visible in the Admin Log Viewer) instead of console-only.
- **`web-react/src/pages/Backup.jsx`** — Added `'documents'` and `'security'` to URL param tab allowlist. Navigating to `?tab=security` now correctly activates the Security tab.
- **`web-react/src/components/control-center/SecurityReviewTab.jsx`** — Added `error` state: if the API call fails, shows a visible error message with migration hint. Added empty-state render when `reviews.length === 0`. Both prevent blank-tab silent failures.
- **`web-react/src/components/OnboardingChecklist.jsx`** — Added Receipt Forwarding step between Import and AI steps. Links to `?tab=integration` in Control Center.

---

## [v7.8.95] — 2026-06-08

### Feature: Security Review Cadence Tab

- **`api/routes/admin.js`** — `GET /admin/security-reviews` + `POST /admin/security-reviews/complete`. Returns last completion per type, computed next-due date, and recent history.
- **`api/tests/security-reviews-migration.sql`** — `security_reviews` table with review_type check constraint and index.
- **`web-react/src/components/control-center/SecurityReviewTab.jsx`** — New admin-only tab. Shows 5 review tiers (weekly/monthly/quarterly/annual/npm audit) with status badges (OK / DUE SOON / OVERDUE / NEVER RUN), expandable checklists, "Mark Done" flow with optional notes, and completion history.
- **`web-react/src/pages/Backup.jsx`** — Added Security tab (admin-only) to Control Center nav.

---

## [v7.8.94] — 2026-06-08

### Feature: ENCRYPTION_KEY Rotation Runbook

- **`api/scripts/rotate-plaid-tokens.js`** — New local-only script that re-encrypts all Plaid access tokens when rotating ENCRYPTION_KEY. Supports `--dry-run` mode. Uses existing `cryptoUtil.js` encrypt/decrypt.
- **`CLAUDE.md`** — Added "ENCRYPTION_KEY Rotation Runbook" section with step-by-step procedure.

---

## [v7.8.93] — 2026-06-08

### Fix: pending_receipts auto-cleanup on manual receipt upload

- **`api/routes/receipts.js`** — After a successful receipt upload to `expenses`, checks `pending_receipts` for a row with matching `user_id + amount_cents`. If exactly one match found, deletes the pending row and its Storage file. Non-fatal if cleanup fails — upload response is unaffected.

---

## [v7.8.92] — 2026-06-08

### Feature: Email Receipt Phase 2 — Per-User Forwarding Addresses

- **`api/utils/tokenUtils.js`** — New `deriveReceiptToken(userId)` using HMAC-SHA256. Token = first 12 hex chars, deterministic per user.
- **`api/routes/receipts.js`** — New `GET /receipts/my-address` endpoint. Derives token, upserts to `settings.receipt_token`, returns unique forwarding address.
- **`api/routes/emailInbound.js`** — Replaced hardcoded `TOKEN_MAP` lookup with DB query on `settings.receipt_token`. Legacy `jd` token preserved as fallback. Unknown tokens fall back to Joshua.
- **`api/tests/receipt-token-migration.sql`** — `receipt_token TEXT` column + index on `settings` table.
- **`web-react/src/components/control-center/IntegrationTab.jsx`** — `EmailReceiptCard` now fetches dynamic address from `GET /api/receipts/my-address` instead of showing a hardcoded address. Each user sees their own unique forwarding address.
- **New env var required:** `RECEIPT_HMAC_SECRET` — set in Vercel before deploying.

---

## [v7.8.91] — 2026-06-08

### Fix: Sentry user context on page reload

- **`web-react/src/components/AuthContext.jsx`** — Added `Sentry.setUser()` in the initial `getSession()` block. Previously, user context was only set on `SIGNED_IN` events (new logins), not on page reload where the event is `INITIAL_SESSION`. Errors on reload now carry user identity.

---

## [v7.8.90] — 2026-06-08

### Fix: Remove Bull — replace with inline retry

- **`api/utils/emailQueue.js`** — Replaced Bull (job queue) with a lightweight `withRetry()` wrapper. Bull required a persistent worker process incompatible with Vercel serverless. The direct Resend fallback was already doing all the work. New implementation: up to 3 attempts with linear backoff on Resend failures. Exported interface unchanged — no callsite changes.
- **`api/package.json`** — Removed `"bull": "^4.16.5"`.
- **`api/package-lock.json`** — Regenerated after Bull removal.

---

## [v7.8.89] — 2026-06-08

### Fix: Receipt upload 413 — client-side image compression

- **`web-react/src/components/TransactionDrawer.jsx`** — Added `compressImage()` helper using browser Canvas API. Resizes to max 1920px wide, re-encodes as JPEG at 0.82 quality. Skips compression if file is already under 1MB or is a PDF. Wired into both upload paths: manual "Upload receipt" button and save+upload together. Fixes 413 Payload Too Large errors caused by high-res phone JPEGs or browser screenshots exceeding Vercel's 4.5MB serverless body limit.

---

## [v7.8.88] — 2026-06-08

### Feature: Receipt Email Sessions view in System Logs

- **`SystemLogsTab.jsx`** — Added grouped Receipt Email Sessions view as the default tab. Clusters email-inbound log rows by 90-second proximity into one card per email: shows subject, from, vendor, amount, date, category, AI confidence, match result, outcome badge, and any errors. Raw events expandable inside each card. Second tab keeps the full raw log table. Time window + live refresh controls shared across both views.

---

## [v7.8.87] — 2026-06-08

### Feature: System Logs tab in Ledger Control Center

- **`api/routes/admin.js`** — New `GET /admin/logs` endpoint: queries `system_logs` with filters for source, level, time window (1h/6h/24h/7d), max 500 rows. Also returns distinct source list for the dropdown.
- **`web-react/src/components/control-center/SystemLogsTab.jsx`** — New admin-only tab: filterable log viewer with level badges, source chips, inline metadata preview, expandable detail rows, live 30-second auto-refresh toggle, summary counts.
- **`web-react/src/pages/Backup.jsx`** — Import + mount SystemLogsTab; add "System Logs" pill to admin nav; add `logs` to URL param allowlist.

---

## [v7.8.86] — 2026-06-08

### Fix: Receipt email — result email never delivered after match/pending/failed

#### Root Cause
`sendReceiptConfirmationEmail` in the matched, already_linked, pending, and failed branches was called fire-and-forget (`.catch()` only, no `await`). The handler promise resolves immediately after the expense update, `waitUntil` considers the work done, and Vercel freezes the Lambda — killing the in-flight email send before it completes. The ack email worked because it fires at the very start and completes during the 4-second Gemini window.

#### Fixed
- **`api/routes/emailInbound.js`** — `await` all four result `sendReceiptConfirmationEmail` calls so the Lambda stays alive until Resend confirms delivery.

---

## [v7.8.85] — 2026-06-08

### Feature: Pending Receipts — Transaction Ledger

- **`api/routes/pendingReceipts.js`** — New route file: GET list, POST link-to-transaction, DELETE dismiss
- **`api/server.js`** — Mounted `/api/receipts/pending` after auth, before licensing
- **`web-react/src/pages/Transactions.jsx`** — Pending receipts section above the ledger: collapsible amber banner, per-receipt View/Link/Dismiss actions, inline transaction picker with exact-amount highlighting and ±14 day default window

---

## [v7.8.84] — 2026-06-07

### Fix: Receipt email — Lambda freeze killing Gemini Vision

#### Root Cause
Vercel freezes the Lambda execution after `res.sendStatus(200)` is called. The instant ack email fires in ~2 seconds (before Gemini) so it gets through. Gemini Vision on a JPEG/PDF takes 10–30 seconds — Vercel kills the Lambda before it completes. Result: ack always delivered, result email never delivered.

#### Fixed
- **`api/server.js`** — Wrap `_emailInboundProcessor` in `waitUntil()` from `@vercel/functions`. This is Vercel's official API to keep a Lambda alive after a response is sent until the promise resolves.
- **`api/package.json`** + **`api/package-lock.json`** — Added `@vercel/functions` dependency.

---

## [v7.8.83] — 2026-06-07

### Fix: Receipt email matching — widen date window to ±7 days

#### Root Cause
Matching used ±3 days. Invoice/billing date on a receipt often differs from the bank posting date by more than 3 days (e.g. Plaid invoice dated June 1, AmEx posts June 7 = 6-day gap → no match → stored as pending instead of attached).

#### Fixed
- **`api/routes/emailInbound.js`** — Date range widened from ±3 to ±7 days. Covers typical billing-date vs bank-posting-date lag without significantly increasing false positive risk (amount_cents is still an exact match).

---

## [v7.8.82] — 2026-06-07

### Fix: Lambda timeout + instant receipt acknowledgment

#### Root Cause
`vercel.json` had no `functions` config — Vercel defaulted to a 10-second Lambda timeout. The fresh Supabase client connection + Gemini Vision on a PDF attachment routinely exceeded 10 seconds, killing the handler before it could parse, match, or send any reply email.

#### Fixed
- **`vercel.json`** — Added `"functions": { "api/server.js": { "maxDuration": 60 } }`. Vercel Hobby plan allows 60s max. This gives the handler enough time to complete Gemini Vision + retries + storage + matching + email send.
- **`api/routes/emailInbound.js`** — Sends an instant "Receipt Received — processing now" acknowledgment email immediately after the user is resolved (before Gemini). User gets feedback within ~2 seconds of forwarding. A follow-up result email (matched/pending/failed) follows once processing completes.
- **`api/utils/mailer.js`** — Added `received` outcome to `sendReceiptConfirmationEmail`.

---

## [v7.8.81] — 2026-06-06

### Fix: EmailInbound — fresh Supabase client per invocation

#### Root Cause
`emailInbound.js` used `const { supabase } = require('../db')` — the module-level singleton. When the handler runs fire-and-forget after `res.sendStatus(200)`, the singleton's HTTP connections are stale in that Lambda context. Result: every Supabase query fails with `TypeError: fetch failed`, handler exits before Gemini, before parsing, before any reply email.

Every other route uses `req.sb` (a fresh per-request client from auth middleware). emailInbound bypasses auth, so it was stuck with the broken singleton.

#### Fixed
- **`api/routes/emailInbound.js`** — Replaced singleton import with `createClient()` called inside the handler body (fresh client per invocation, `autoRefreshToken: false`, `persistSession: false`). Supabase queries now have clean HTTP connections every time.
- **`api/utils/receiptEmailParser.js`** — Shortened Gemini retry back-off from 2s/4s → 1s/2s. Max transient delay drops from 6s to 3s.

---

## [v7.8.80] — 2026-06-06

### Fix: Email confirmation logging + Gemini retry + filter UI polish

#### Fixed
- **`api/utils/receiptEmailParser.js`** — Gemini Vision now retries up to 3 times on 503/502/500 (transient overload), with 2s/4s back-off. Previously a single 503 silently dropped the parse.
- **`api/routes/emailInbound.js`** — All confirmation email sends now log their result (`matched/pending/failed/already_linked` + Resend response or error message). Previously `.catch(() => {})` swallowed failures with no trace.

#### Polish
- **`web-react/src/pages/Transactions.jsx`** — Date pickers and quick-range buttons (30d / 90d / YTD / All) now grouped in a single `DATE RANGE` row with an inline arrow separator. Cleaner, no orphaned column.

---

## [v7.8.79] — 2026-06-06

### Fix: Receipt email — already_linked case + Transactions 90-day default

#### Fixed
- **`api/routes/emailInbound.js`** — When a matching transaction exists but already has a receipt, the handler now sends an `already_linked` confirmation email ("Receipt already on file") instead of storing a pending receipt. Added `alreadyLinked` variable to separate matches with vs. without existing receipts.
- **`api/utils/mailer.js`** — Added `already_linked` outcome to `sendReceiptConfirmationEmail`: distinct subject line, body copy, and "View Transaction" CTA.

#### Performance
- **`web-react/src/pages/Transactions.jsx`** — Transactions page now defaults to last 90 days instead of loading all rows. Added quick-range buttons (30d / 90d / YTD / All). Date range change triggers a fresh server-side fetch. `clearFilters` resets to 90-day window.
- **`web-react/src/api/index.js`** — `fetchAllExpenses` now accepts `start`/`end` params. When provided, bypasses cache and fetches only that window from the server.

---

## [v7.8.78] — 2026-06-07

### Fix: Email system — resend upgrade removes ncc bundling blocker

#### Fixed
- **`api/package.json`** — Upgraded `resend` from 2.1.0 → 6.12.4. resend 2.x depended on `@react-email/render` → `react-dom/server`, which ncc (Vercel's bundler) could not bundle. ncc marked `resend` as an external module; at Lambda runtime there is no `node_modules` folder, so all email sends failed with "Cannot find module 'resend'". resend 6.x has no React dependency — only `postal-mime` and `standardwebhooks`. This fixes receipt email forwarding, invoice email sends, and all other mailer routes.
- **`api/package-lock.json`** — Regenerated; removes 380+ lines of React dependency chain.

---

## [v7.8.77] — 2026-06-07

### Fix: Receipt Email — True Root Cause (TDZ bug in mailer.js)

#### Fixed
- **`api/utils/mailer.js` line 537** — `const uncatUrl = \`${uncatUrl}...\`` was a self-referential Temporal Dead Zone bug. `uncatUrl` referenced itself before initialization, throwing a `ReferenceError` when `mailer.js` loaded. This killed the entire `emailInbound.js` require chain at startup — causing every version from v7.8.58 onward to fail silently. ncc's module wrapper swallowed the error without triggering the try/catch in server.js. Fixed to `\`${appUrl}/Transactions?filter=uncategorized...\``.

---

## [v7.8.76] — 2026-06-07

### Fix: Receipt Email — Resend module not found (ncc bundling)

#### Fixed
- **`api/server.js`** — Reverted dynamic `require()` inside handler body back to static top-level require. ncc (Vercel's bundler) only traces `require()` calls at module scope — a `require()` inside a function body isn't traced, so `resend` and other dependencies of `emailInbound.js` were excluded from the production bundle. Static require restored; route registration remains unconditional with no `if()` guard, and `res.sendStatus(200)` still fires before any processing.

---

## [v7.8.75] — 2026-06-07

### Fix: Receipt Email SyntaxError (root cause of all 401s)

#### Fixed
- **`api/routes/emailInbound.js`** — Fixed `});` → `};` closing the handler. This SyntaxError was the true root cause of every 401 from v7.8.71 onward: the module threw at startup, `emailInboundHandler` was `undefined`, the `if()` guard was false, and the route was never registered. v7.8.74's unconditional route exposed the error via logs. One character fixed.

---

## [v7.8.74] — 2026-06-07

### Fix: Receipt Email Inbound 401 (final — unconditional route)

#### Fixed
- **`api/server.js`** — Removed startup `require()` + `if (emailInboundHandler)` guard entirely. Route is now registered unconditionally with `app.post()`. `res.sendStatus(200)` fires before any module load — Postmark always receives 200 regardless of runtime errors. Module loaded inline via string-literal `require()` so ncc bundling is unaffected.
- **`api/routes/emailInbound.js`** — Removed `res.sendStatus(200)` and `res` parameter. Handler is now `async (req)` — processes email, no response ownership.

---

## [v7.8.73] — 2026-06-07

### Fix: Receipt Email Inbound 401 (attempt 2)

#### Fixed
- **`api/routes/emailInbound.js`** — Removed Express Router wrapper entirely. Now exports the async handler function directly (`module.exports = handler`). The sub-router path-stripping was the root cause of the 401 across multiple attempts.
- **`api/server.js`** — Simplified mount to `app.post("/api/receipts/email-inbound", emailInboundHandler)`. No `req.url` mutation, no router invocation, no indirection.

---

## [v7.8.72] — 2026-06-07

### Fix: Receipt Email Inbound 401

#### Fixed
- **`api/server.js`** — Moved `emailInbound` route mount from `apiRouter.use()` to a direct `app.post()` at the app level, before `apiRouter`. The sub-router path-stripping via `apiRouter.use("/receipts/email-inbound", ...)` was silently failing to match on Vercel, causing every Postmark webhook to fall through to `authMiddleware` and return 401. Mounting directly on `app` with `req.url = "/"` ensures the handler always runs before auth.
- Removed vestigial `app.use("/", apiRouter)` double-mount that could cause double-dispatch on matched routes.

---

## [v7.8.71] — 2026-06-06

### Fix: Document View Button Not Appearing After Upload

#### Fixed
- **`api/routes/documents.js`** — Storage operations (upload, signed URL, remove) now use `adminClient` (service role) instead of `req.sb` (user-scoped anon client). The `documents` bucket is private with no RLS policies, so the anon client was silently failing on every upload, leaving `file_path` as null and preventing the View button from rendering.

---

## [v7.8.70] — 2026-06-06

### Documents Tab — UI Polish

#### Changed
- **`web-react/src/components/control-center/DocumentsTab.jsx`** — Replaced native `window.confirm()` on Remove with themed `modal.confirm()`. Upload success/error messages now display as styled banners with green (success) or red (error) borders. Renamed "Indexed Documents" section header to "My Documents".

---

## [v7.8.69] — 2026-06-06

### Document System — Remove Embedding Dependency + Add PDF Storage

#### Changed
- **`api/routes/documents.js`** — Removed all embedding calls. Documents are now stored as plain text chunks only. Brain injects all chunks directly into Gemini's context window (no vector search needed). Also: original file is now saved to Supabase Storage (`documents/` bucket) on upload, and cleaned up on delete.
- **`api/routes/brain.js`** — Replaced `getEmbedding` + `match_document_chunks` RPC with a simple `SELECT chunk_text FROM document_chunks WHERE user_id = ?` (limit 30). Works with any Gemini API key — no embedding access required.
- **`web-react/src/components/control-center/DocumentsTab.jsx`** — PDF upload no longer requires a Gemini API key (only image uploads do). Added 📄 View button per document that fetches a signed URL and opens the original file in a new tab.

#### Added
- **`GET /api/documents/:id/download`** — Returns a 1-hour signed URL for the original uploaded file from Supabase Storage.
- **DB migration** — `user_documents.file_path TEXT` column added for Storage path. `documents` Storage bucket created (private).

#### Root cause note
Google AI Studio BYOB keys do not have `embedContent` access — only `generateContent`. All embedding models (`text-embedding-004`, `text-embedding-005`, `gemini-embedding-exp-03-07`) return 404 for these keys regardless of model name or API version. Embedding dependency removed permanently.

---

## [v7.8.68] — 2026-06-06

### Document Embedding Model Fix

#### Fixed
- **`api/utils/gemini.js`** — `text-embedding-004` and `text-embedding-005` were both removed from Google's public AI Studio API. Switched to `gemini-embedding-exp-03-07` (3072 dimensions). Reverted unnecessary `apiVersion: 'v1'` override.
- **DB migration** — `document_chunks.embedding` column updated from `vector(768)` to `vector(3072)` to match new model. Table had 0 rows — no data lost.

---

## [v7.8.67] — 2026-06-06

### Receipt Email Deep Link + Document Embedding Fix

#### Fixed
- **`api/utils/gemini.js`** — Document indexing was failing with a 404 error because `text-embedding-004` is only available on Google's stable `v1` API, but the SDK defaulted to `v1beta`. Fixed by passing `{ apiVersion: 'v1' }` to `getGenerativeModel`.
- **`api/routes/emailInbound.js`** — Pass `expenseId` to the receipt confirmation email on successful match.
- **`api/utils/mailer.js`** — "View Transaction" button in receipt confirmation email now deep-links to `/Transactions?expense=<id>` instead of the generic homepage.
- **`web-react/src/pages/Transactions.jsx`** — Handle `?expense=<id>` URL param: after transactions load, automatically open the TransactionDrawer for the linked expense.

#### Added
- **`ROADMAP.md`** — Apple Card CSV ingestion via email flagged as Good to Have.

---

## [v7.8.66] — 2026-06-06

### Resume Setup Checklist from Help Center

#### Added
- **`web-react/src/components/control-center/HelpTab.jsx`** — "Resume Setup Checklist →" button at the top of the Help Center. Dispatches a custom `ll:reopen-onboarding` window event that reopens the onboarding modal directly on the checklist page.
- **`web-react/src/App.jsx`** — Window event listener for `ll:reopen-onboarding`. When fired, opens the modal on page 2 (checklist) instead of the welcome screen via `reopenOnboarding` ref.
- **`web-react/src/components/OnboardingChecklist.jsx`** — Added `initialPage` prop so the modal can open at any page (defaults to 0).

---

## [v7.8.65] — 2026-06-06

### Welcome Modal — Suppress After Dismiss (Mobile PWA Fix)

#### Fixed
- **`web-react/src/App.jsx`** — Welcome/onboarding modal no longer re-appears on every mobile PWA login after dismissal. Dismissed state is now persisted to Supabase (`settings.onboarding_dismissed`) in addition to localStorage. iOS Safari clears localStorage after ~7 days of PWA inactivity — the server-side flag ensures the modal stays suppressed regardless of local storage state.

#### Changed
- **`api/` (migration)** — Added `onboarding_dismissed BOOLEAN DEFAULT FALSE` column to `settings` table (idempotent).

---

## [v7.8.60] — 2026-06-06

### Plaid Balance Cost Control

#### Changed
- **`web-react/src/pages/Accounts.jsx`** — Added 10-day TTL to Plaid balance cache. Balance API calls (`$0.10/call`) are now skipped if cached data is less than 10 days old. Both `BalanceRows` and the parent component read from the same cache — reducing from 3+ calls per page load to at most 1 call per 10-day window.
- **`web-react/src/pages/Accounts.jsx`** — `handleSync` now clears the balance cache after a transaction sync so the next page visit pulls fresh balances from Plaid.

#### Added
- **`SERVICES.md`** — Master list of all connected external services with purpose, plan, dashboard links, and cost notes.

---

## [v7.8.59] — 2026-06-05

### Error Tracking — Sentry + Logtail

#### Added
- **`web-react/src/components/ErrorBoundary.jsx`** — React error boundary wrapping the full app. Catches component crashes, sends to Sentry, shows "Reload App" fallback UI.
- **`api/utils/logger.js`** — Pino structured logger with Logtail transport. Falls back to stdout if `LOGTAIL_SOURCE_TOKEN` not set.

#### Changed
- **`web-react/src/main.jsx`** — `Sentry.init()` with DSN, environment, browser tracing (10% sample rate). Disabled in dev.
- **`web-react/src/App.jsx`** — Wrapped with `<ErrorBoundary>`; `window.onunhandledrejection` forwards to Sentry.
- **`web-react/src/api/index.js`** — All API methods (GET/POST/PATCH/PUT/DELETE) capture exceptions to Sentry with path + method tags before re-throwing.
- **`web-react/src/components/AuthContext.jsx`** — `Sentry.setUser()` on SIGNED_IN; `Sentry.setUser(null)` on SIGNED_OUT.
- **`api/server.js`** — Global error handler uses structured `logger.error()` with path, method, user ID, stack.

#### Setup Required
- Add `VITE_SENTRY_DSN` to Vercel env panel (get from sentry.io → your project → DSN)
- Add `LOGTAIL_SOURCE_TOKEN` to Vercel env panel (get from betterstack.com → Logs → your source)

---

## [v7.8.58] — 2026-06-05

### Email Receipt Forwarding

#### Added
- **`api/routes/emailInbound.js`** — Postmark inbound webhook. Verifies token, resolves user from `receipts+jd@` address, extracts receipt via Gemini Vision (PDF/image attachment priority) or Gemini text (body fallback), runs two-pass transaction match, uploads file to Supabase Storage.
- **`api/utils/receiptEmailParser.js`** — `parseReceiptFromEmailBody()` (Gemini text mode) and `parseReceiptFromFile()` (Gemini Vision) with FWD: chain stripping.
- **`api/tests/pending-receipts-migration.sql`** — Idempotent migration for `pending_receipts` table (Supabase applied).
- **`pending_receipts` table** — Holds email receipts that arrived before the bank transaction posted. Matched on next Plaid sync.
- **`matchPendingReceipts()`** in `api/routes/plaid.js` — Pass 2 match: after Plaid inserts new transactions, checks `pending_receipts` by `amount_cents` + date ±3 days; attaches file and deletes pending record on match.

#### Changed
- **`api/utils/mailer.js`** — Added `sendReceiptConfirmationEmail()` with matched / pending / failed outcomes.
- **`api/server.js`** — Mounted `emailInboundRouter` at `/receipts/email-inbound` (no auth — Postmark token protected).
- **`web-react/src/components/control-center/IntegrationTab.jsx`** — Added `EmailReceiptCard` at top of Integrations tab showing forwarding address with copy button.

#### Setup Required
- Postmark account → create inbound stream → set webhook URL to `https://www.lumiereledger.com/api/receipts/email-inbound`
- Add `POSTMARK_INBOUND_TOKEN` and `RECEIPT_HMAC_SECRET` to Vercel env panel
- Add Postmark MX record to `throughthelens.media` DNS: `MX inbound.postmarkapp.com 10`

---

## [v7.8.56] — 2026-06-02

### RAG — Document indexing + Brain integration

#### Added
- **`api/routes/documents.js`** — New route. `POST /documents/upload` accepts PDF or image, extracts text (pdf-parse for PDFs, Gemini Vision for images), chunks into ~2000-char segments, embeds each chunk via Gemini `text-embedding-004`, stores in Supabase pgvector. `GET /documents` lists indexed docs. `DELETE /documents/:id` removes doc + all chunks.
- **`web-react/src/components/control-center/DocumentsTab.jsx`** — New Control Center tab. Upload zone with doc type selector (General/Warranty/Contract/Insurance/Loan), indexed document list with chunk count and date, remove button.
- **Supabase migrations** — `vector` extension enabled; `user_documents` and `document_chunks` tables created with RLS; `match_document_chunks` Postgres function for cosine similarity search.

#### Changed
- **`api/routes/brain.js`** — RAG context injection before `sendMessage`. Embeds the user's question, runs similarity search against their indexed documents, prepends top 4 matching chunks as `[DOCUMENT CONTEXT]`. Non-fatal — Brain works normally if no documents are indexed or if the lookup fails. System prompt updated to advertise document Q&A capability.
- **`api/utils/gemini.js`** — Added `getEmbedding(apiKey, text)` using `text-embedding-004` (768 dims).
- **`api/server.js`** — Mounted `documentsRouter` at `/documents`.
- **`web-react/src/pages/Backup.jsx`** — Added Documents tab between AI Intelligence and Integrations.
- **`api/package.json`** + **`api/package-lock.json`** — Added `pdf-parse ^1.1.1`.

---

## [v7.8.55] — 2026-06-02

### Michelle Gornichec — Plaid billing exempt

#### Changed
- **`api/routes/plaid.js`** + **`api/routes/stripe.js`** — Added `fcb92809-70f1-4ae0-b39c-e317378a01a7` to `PLAID_BILLING_EXEMPT`.

---

## [v7.8.54] — 2026-06-02

### Tax bucket dropdown filtered by category

#### Changed
- **`web-react/src/components/TransactionDrawer.jsx`** — Tax bucket select now shows only the mapped bucket + "Personal Expense" when a category with a direct mapping is selected. Unmapped or no-category shows all 18 buckets as before.

---

## [v7.8.53] — 2026-06-02

### Smart receipt scanner — tip detection + split-charge merge

#### Changed
- **`api/routes/receipts.js`** — `/receipts/extract` Gemini prompt now extracts `subtotal`, `tip`, `tax`, `total`, and `tip_split_likely`. Amount is always the final total charged (tip-inclusive). Notes auto-format as "Subtotal $X + tip $Y = $Z" when a tip is present.
- **`api/routes/expenses.js`** — New `POST /expenses/tip-split-check`. Given a scanned receipt with a tip, finds whether the bank posted two separate charges (meal + tip) instead of one combined total. Returns both row IDs if a split pair is found.
- **`web-react/src/components/TransactionDrawer.jsx`** — Scanner now uses `total` as the saved amount. When a tip is detected: shows a breakdown badge (subtotal + tip + tax = total). When a split charge pair is found in the bank feed: shows a blue notice and auto-merges the tip charge into the main entry on save.

---

## [v7.8.52] — 2026-06-02

### Fix manual-vs-Plaid duplicate transactions

#### Changed
- **`api/routes/expenses.js`** — `POST /expenses` now checks for an existing Plaid row (same `amount_cents`, date ±3 days, vendor similarity) before inserting a manual entry. If a match is found, enrichment (receipt, notes, category, tax fields) is merged onto the Plaid row and no duplicate is created. Response includes `merged: true`.
- **`api/routes/expenses.js`** — New `POST /expenses/link-manual-to-plaid` retroactive cleanup endpoint. Scans all unlinked manual rows, finds Plaid counterparts by amount + date ±4 days + vendor, merges enrichment, and deletes the orphaned manual row. Safe to re-run.
- **`api/routes/import.js`** — CSV import merge no longer overwrites `source`, `vendor`, `expense_date`, or `amount_cents` when the merge target is an existing Plaid row — only enrichment fields are applied.
- **`web-react/src/components/TransactionDrawer.jsx`** — Shows "Receipt attached to your bank transaction." or "Matched to your existing bank transaction." when a manual save merges into an existing Plaid row instead of creating a new entry.

---

## [v7.8.51] — 2026-06-02

### Auto-sync on login + Connected Banks UI redesign

#### Changed
- **`web-react/src/components/PlaidLink.jsx`** — Account cards now show a green "● Connected" badge. Red Disconnect button replaced with a subtle `···` overflow button — destructive action is still one click away but no longer looks like an error state. Header buttons reordered: Sync Now first, Connect Bank second.
- **`web-react/src/components/AuthContext.jsx`** — Silent background `POST /api/plaid/sync` fires on every `SIGNED_IN` event. No UI, no spinner — transactions arrive by the time the user navigates anywhere.

---

## [v7.8.50] — 2026-06-02

### Monthly Financial Report Email + Daily Cron Fix

#### Added
- **`api/routes/cron.js`** — New `GET /cron/monthly-report` route. On the 1st of each month, queries last month's expenses for every user and sends a branded financial summary email. Sections: Total Spend (with % change vs 3-month avg), Income / % of income spent, Top 3 categories, Biggest spending changes, and Subscriptions. `?preview=1` sends only to `joshua.deuermeyer@gmail.com` with a yellow test banner — use this to verify before going live.
- **`api/utils/mailer.js`** — `sendMonthlyReportEmail()` — dark-themed HTML email template modeled on Rocket Money's layout but Lumière Ledger branded (orange accents, slate cards). Handles all edge cases: no income data, no subscriptions, no prior average.
- **`api/utils/emailQueue.js`** — `queueMonthlyReportEmail()` wrapper.

#### Fixed
- **`.env`** — `GITHUB_TOKEN` and `CRON_SECRET` were on the same line (no newline separator), causing `CRON_SECRET` to be undefined locally. Split into two separate lines.

---

## [v7.8.49] — 2026-05-27

### Top Expense Drivers — clickable + Uncategorized filter

#### Changed
- **`web-react/src/pages/DashboardV2.jsx`** — Every row in the Top Expense Drivers section is now a clickable link. Clicking any category row navigates to the Transaction Ledger pre-filtered to that category. Clicking "UNCATEGORIZED" navigates to `/transactions?needs_category=1` (same as the monthly insights popup). Rows have a hover highlight and a `→` indicator. Uncategorized bar is always orange to signal it needs attention.
- **`web-react/src/pages/Transactions.jsx`** — Category filter dropdown replaced with an inline `<select>` that includes an **"Uncategorized"** option at the top (above all category groups). Selecting it activates the `needsCategory` filter (same as the orange badge filter). Reads `?category=X` URL param on mount so dashboard clicks land with the correct category pre-selected.

---

## [v7.8.48] — 2026-05-27

### Monthly Insights polish + tax bucket fix + dashboard speed

#### Changed
- **`web-react/src/components/MonthlyInsightsModal.jsx`** — All three steps now show top **5** items (was 3). "More" overflow text threshold updated to match. "Go to Transactions →" now navigates to `/transactions?needs_category=1` so the ledger opens pre-filtered to uncategorized transactions only.
- **`web-react/src/hooks/useExpenseFilters.js`** — Added `needsCategory` filter: when true, returns only rows with empty or missing category.
- **`web-react/src/pages/Transactions.jsx`** — Reads `?needs_category=1` URL param on mount → sets filter state. Displays an orange "Showing uncategorized transactions only" badge with dismiss button. `clearFilters()` also clears this filter.
- **`web-react/src/components/TransactionDrawer.jsx`** — Category onChange: if selected category has **no** mapping in `CATEGORY_TAX_BUCKET_MAP`, now resets `taxBucket` to `''` and `deduct` to `false` (fixes Clothing / unmapped categories retaining stale values). Tax Deductible checkbox is now `disabled` (and visually dimmed) when no tax bucket is selected.
- **`api/routes/metrics.js`** — Invoices and vendor_settings fetches now fire in **parallel** while the expenses pagination loop runs (was serial). Cuts cold-load dashboard latency on first visit.

---

## [v7.8.47] — 2026-05-26

### Category → IRS tax bucket auto-mapping

#### Added
- **`web-react/src/constants/categories.js`** — `CATEGORY_TAX_BUCKET_MAP` export: maps 23 of 29 categories to their correct IRS Schedule C bucket. Each entry has `bucket` (tax bucket string) and optional `pct` (auto-sets `business_use_pct`). Includes inline comments for the 6 categories intentionally left unmapped (Entertainment post-TCJA, Groceries, Shopping, Clothing, Health & Medical, Home & Garden — all too ambiguous or belong outside Sch C).
- **`web-react/src/components/TransactionDrawer.jsx`** — Category `onChange` now applies the mapping: auto-fills `taxBucket`, toggles `deduct` (true for business buckets, false for Personal Expense), and sets `bizPct = 50` for Meals (50%). Chains with the existing auto-deductible logic from v7.8.46.

#### Mapping highlights
- `Dining & Drinks` → `Meals (50%)` + `business_use_pct = 50`
- `Auto & Transport` / `Gas & Fuel` / `Parking & Tolls` → `Car and truck`
- `Software & Tech` / `Subscriptions` / `Office Supplies` → `Office expense`
- `Camera & Equipment` / `Photography` → `Supplies` (Section 179 / de minimis)
- `Travel & Vacation` → `Travel`
- `Professional Services` → `Legal and professional`
- `Insurance (Personal)` / `Personal Care` / `Pets` → `Personal Expense` (deductible = false)

---

## [v7.8.46] — 2026-05-26

### Monthly Insights Modal + Auto tax-deductible from tax bucket

#### Added
- **`web-react/src/components/MonthlyInsightsModal.jsx`** — New component. Shows once per calendar month (localStorage key `ll_monthly_insights_YYYY-MM`), 3 seconds after login. Up to 3 steps rendered based on data: (1) Most Frequent — top 3 vendors by count with average spend; (2) Largest Transactions — top 3 by amount; (3) Uncategorized — count + top 3 items + "Go to Transactions" CTA in orange. Progress dot indicator. Slide-up animation. Skips month if fewer than 3 transactions exist.
- **`web-react/src/App.jsx`** — Monthly Insights trigger effect; `showMonthlyInsights` state; modal render alongside other global modals.

#### Changed
- **`api/routes/expenses.js`** — POST: if `tax_bucket` is set and not "Personal Expense", `tax_deductible` is forced to `true`. PATCH: same rule applied when `tax_bucket` is included in the update (respects explicit `false` override).
- **`web-react/src/components/TransactionDrawer.jsx`** — Tax bucket `onChange`: selecting any business bucket (non-empty, non-"Personal Expense") now automatically checks the Tax Deductible checkbox. Previously only "Personal Expense" toggled deductible off.
- **`api/routes/plaid.js`** — Plaid transaction mapping: if a vendor rule has a business `tax_bucket`, the imported transaction is auto-marked `tax_deductible: true`.

---

## [v7.8.45] — 2026-05-21

### Mileage — Invoice link in Maps Autopilot mode

#### Changed
- **`web-react/src/pages/Mileage.jsx`** — "Link to Invoice" dropdown is now present in Maps Autopilot mode alongside the Notes field (same row). Invoice ref is appended to the purpose string after trip notes: `Trip Name | Route | Notes · Invoice #X — Client`. Previously only available in Manual Entry mode.

---

## [v7.8.44] — 2026-05-21

### Mileage — Manual Entry mode + invoice link + Maps badge

#### Added
- **`web-react/src/pages/Mileage.jsx`** — "Manual Entry" tab added alongside "Maps Autopilot" in the Log New Trip card. Manual form: Trip Date, Trip Name / Client, Miles (numeric), Notes (free text), and an optional "Link to Invoice" dropdown that pulls from `/invoices`. When an invoice is linked, the reference (e.g. `Invoice #42 — Miller Wedding`) is appended to the purpose string. Manual entries appear in Trip History with the same format as Maps entries (Name / Manual Entry / Notes row breakdown).
- **`web-react/src/pages/Mileage.jsx`** — Live deduction preview shown when Name + Miles are filled in Manual Entry mode — same style as Maps Autopilot result.

#### Changed
- **`web-react/src/pages/Mileage.jsx`** — "MAPS AUTOPILOT" badge renamed to "🗺 Open Route in Maps" with a tooltip: "After calculating your route, tap 'Open in Google Maps' to send it to your phone's navigation app."

---

## [v7.8.43] — 2026-05-21

### Invoice approval page — payment terms block

#### Added
- **`web-react/src/pages/PayInvoice.jsx`** — Payment Information box now appears between the intro paragraph and the e-signature field on the client-facing invoice approval page. Styled with a warm orange border to match the invoice palette. Content: 50% deposit required to secure date; remaining balance due before/day-of session; accepted payment methods (Cash, Stripe, Venmo, Zelle); confirmation email note.

---

## [v7.8.42] — 2026-05-21

### Unified Plaid card — no duplicate CSV card

#### Changed
- **`web-react/src/pages/Accounts.jsx`** — CSV source accounts that are "owned" by a Plaid connection (source key starts with the institution name, e.g. `"American Express Credit Card ···1001"` under the `"American Express"` connection) are now added to `syncedKeys` and suppressed from the type-grouped sections (Credit Cards, Checking, etc.). The Live Sync card is the single authoritative view — it already shows the Plaid live balance (BalanceRows), per-sub-account detail, combined spending stats (This Month / Last Month / YTD / Transactions), Sync button, and Disconnect button. This eliminates the duplicate card showing the same data twice.

---

## [v7.8.41] — 2026-05-21

### Live Sync card polish — centered stats, working Transactions link, % of month bar

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — Stat tiles (This Month / Last Month / YTD / Transactions) are now center-aligned. Previously labels and values were left-aligned, looking inconsistent in the auto-fit grid.
- **`web-react/src/pages/Accounts.jsx`** — Transactions tile on Live Sync cards is now clickable. Navigates to `/transactions?institution=USAA` (prefix filter) which shows all accounts belonging to that bank (USAA Checking + USAA Savings, etc.). Previously the tile navigated to `?source=plaid` which returned 0 results.
- **`web-react/src/pages/Accounts.jsx` / `web-react/src/hooks/useExpenseFilters.js`** — "% of month" progress bar now shows a real value on Live Sync cards. Was stuck at 0% because `this_month_cents` was 0 (fixed in v7.8.40). Bar shows this bank's spending as a proportion of total monthly spending across all accounts.
- **`web-react/src/hooks/useExpenseFilters.js`** — Added `institutionPrefix` filter: prefix-matches `source` column so all accounts at an institution are returned (e.g. `"USAA"` matches `"USAA Checking"` and `"USAA Savings"`).
- **`web-react/src/pages/Transactions.jsx`** — Added `?institution=` URL param support: reads into `institutionFilter` state, passes as `institutionPrefix` to filter hook. Shows green filter badge ("Filtered to: USAA accounts ✕") when active. Included in Clear Filters action.

---

## [v7.8.40] — 2026-05-21

### Live Sync card stats fix + Transactions tile disabled for Plaid cards

#### Fixed
- **`web-react/src/pages/Accounts.jsx` — `syncedAccounts` stat aggregation**: Live Sync cards (one per Plaid connection) were hardcoded to `this_month_cents: 0, last_month_cents: 0, ytd_cents: 0, total_count: 0`. Real transaction data lives in named source rows (e.g. "USAA Checking", "American Express Credit Card ···1001") — not in the synthetic 'plaid' card object. Fix: `syncedAccounts` now aggregates all stats from `ownedRows` — accounts whose source key starts with the institution name — so "Spending (via Plaid)" shows real numbers.
- **`web-react/src/pages/Accounts.jsx` — Transactions tile on Live Sync cards**: The tile was clickable and navigated to `/transactions?source=plaid`, which always returned 0 results (Plaid transactions are stored under named sources). Fixed by setting `txSource = null` for Plaid cards, making the Transactions tile non-interactive (count still displays).

---

## [v7.8.39] — 2026-05-21

### Vendor category memory — learn once, apply forever

#### Added
- **`api/utils/vendorRules.js`** — Shared utility: `normalizeVendor` (strips store numbers/IDs for stable matching), `loadVendorRules` (fetch all rules → lookup map), `learnVendorRule` (upsert rule, increment match count). Fails open — never blocks a sync if the table is missing.
- **`api/routes/expenses.js`** — `PATCH /:id` now calls `learnVendorRule` (fire-and-forget) whenever `category`, `tax_deductible`, `business_use_pct`, or `tax_bucket` is changed. The normalized vendor name + new values are stored as a rule.
- **`api/routes/plaid.js`** — `syncTransactions` loads all vendor rules once per sync via `loadVendorRules`. When mapping new transactions, if a vendor matches a saved rule, the user's stored values (category, tax flag, business %, tax bucket) are applied instead of Plaid's auto-category.
- **`api/migrations/003_vendor_category_rules.sql`** — Proper table definition with PRIMARY KEY `(user_id, vendor_pattern)`, FK to `auth.users`, lookup index, and full RLS policies. Idempotent — handles case where bare `CREATE TABLE` was already run.

---

## [v7.8.38] — 2026-05-21

### Plaid data integrity: source key collision, soft-delete, self-healing repair

#### Fixed
- **`api/routes/plaid.js` — `makePlaidSourceKey`**: Credit accounts now include the last-4 mask in their source key (e.g. `"American Express Credit Card ···1234"`). Prevents source key collision when multiple cards from the same institution (Amex Delta + Amex Gold, two Chase cards, etc.) are connected — they were previously indistinguishable.
- **`api/routes/plaid.js` — removed transactions**: Changed from unconditional hard-delete to a preserve-or-delete check. If a removed transaction has user-attached data (notes, receipt, tax flag), it is unlinkd from Plaid and kept as a manual record instead of being destroyed. Transactions with no user data are still deleted normally (expected for pending→posted transitions).
- **`api/routes/plaid.js` — source repair pass**: Repair now updates ALL transactions with the wrong source key (not just `source='plaid'` rows). Uses `.neq(source, correctKey)` to skip already-correct rows. Self-heals across version changes — on next sync, any stale source keys (e.g. `"American Express Credit Card"` without mask) are corrected automatically.
- **`api/routes/plaid.js` — modified transactions**: Source key is now included in the modified-transaction update so renamed accounts stay consistent.
- **`api/migrations/002_account_aliases_rls.sql`**: RLS policies for `account_aliases` table — SELECT/INSERT/UPDATE/DELETE all restricted to `user_id = auth.uid()`. Idempotent. **Must be run manually in Supabase SQL Editor.**

---

## [v7.8.37] — 2026-05-21

### Multiple Plaid banks — each connection gets its own card

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — `syncedAccounts` was built by filtering `allAccounts` for `source === 'plaid'`, which produces at most one card regardless of how many banks are connected. Changed to map directly over `plaid_connections` rows — each active Plaid connection now gets its own Live Sync card with its own live balances, Sync button, and Disconnect button. Passed `connectionId` down through `AccountCard` → `BalanceRows` so each card only shows sub-accounts for its own bank.

---

## [v7.8.36] — 2026-05-20

### Plaid balance resilience — sub-accounts stay visible when live fetch fails

#### Fixed
- **`api/routes/plaid.js`** — `/plaid/balances` now returns `error_code` and `needs_reauth` flag alongside `balance_error`, so the frontend knows whether it's a transient error or a bank re-authentication requirement.
- **`web-react/src/pages/Accounts.jsx`** — `BalanceRows`: The localStorage cache is no longer overwritten when a balance fetch returns an error (was poisoning the cache with empty accounts). A second cache key `ll_plaid_balances_last_good` stores the last response that had real accounts. When live fetch fails, last-good accounts are shown with an orange "Live balance unavailable — showing last known" banner. If the error is `ITEM_LOGIN_REQUIRED`, users see "Bank re-authentication required" with the error code.

---

## [v7.8.35] — 2026-05-20

### Plaid cross-reference: show which sub-account each CSV source maps to

#### Added
- **`api/routes/accounts.js`** — 4th parallel query on `/accounts/summary`: scans cross-matched transactions to find the most-frequent `plaid_account_id` per CSV source. Returns `linked_plaid_account_id` on every account row.
- **`web-react/src/pages/Accounts.jsx`** — `buildPlaidMap()` helper builds an `account_id → {name, mask}` lookup. Parent `Accounts` fetches `/plaid/balances` once on mount (seeded from localStorage cache). `AccountCard` receives `plaidSubAccountMap` prop; "Plaid Linked" badge now shows `→ ···{mask}` (or account name if no mask) so user can see exactly which Plaid sub-account a CSV import maps to.

---

## [v7.8.34] — 2026-05-20

### Plaid last-4, sub-account filter fallback, account dropdown cleanup

#### Added
- **`api/routes/plaid.js`** — `mask` field added to `/plaid/balances` response (last 4 digits of account number).
- **`web-react/src/pages/Accounts.jsx`** — SubRow now shows `···{mask}` next to account name. Sub-account click now passes `source` (derived source key) in URL in addition to `plaid_account_id`.

#### Fixed
- **`web-react/src/hooks/useExpenseFilters.js`** — `plaidAccountId` filter now falls back to `plaidSourceKey` match for transactions without `plaid_account_id` stored (imported before v7.8.4). Fixes 0-result Savings/older-account views.
- **`web-react/src/pages/Transactions.jsx`** — URL param parsing: when `plaid_account_id` + `source` present together, `source` is used as `plaidSourceKey` fallback (not `searchAccount`). Account filter dropdown now uses `accountsList` (API) as primary source; legacy raw sources appended below. Reset Filters clears `plaidSourceKey`.

---

## [v7.8.33] — 2026-05-20

### Fix Plaid card Transactions tile — now navigates to ledger

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — `txSource` was forced to `null` for `source === 'plaid'`, making `link: !!txSource` always false on the Transactions stat tile. Changed to always use `acct.source` — Transactions tile now navigates to `/transactions?source=plaid`.

---

## [v7.8.32] — 2026-05-20

### Bulk reassign account on selected transactions

#### Added
- **`api/routes/expenses.js`** — `PATCH /expenses/bulk-source` endpoint: accepts `{ ids: number[], source: string }`, updates all matching rows owned by the user in one query.
- **`web-react/src/pages/Transactions.jsx`** — "Reassign account…" dropdown + Apply button in multi-select floating action bar. Select any number of transactions, pick target account, Apply. Clears selection and refreshes ledger. Removed emoji from "Merge Selected" button label.

---

## [v7.8.31] — 2026-05-20

### Account dropdown driven by live account aliases

#### Changed
- **`web-react/src/pages/Transactions.jsx`** — Fetches `/api/accounts/summary` on mount. `ACCOUNT_LABELS` replaced with a live `useMemo` map that reads `display_name` from account aliases first, static fallbacks second. Account filter dropdown and Account column in table now show clean names. Passes `accounts` array to TransactionDrawer instead of raw `userSources`.
- **`web-react/src/components/TransactionDrawer.jsx`** — `userSources` prop replaced with `accounts` (array of `{source, display_name}` objects). Dropdown renders `display_name` when set, falls back to static labels then `formatSourceKey`. Removed all emojis from SOURCE_LABELS. Transaction `source` field unchanged — display only.

---

## [v7.8.30] — 2026-05-20

### Account merging — absorb duplicate CSV accounts into a single card

#### Added
- **`web-react/src/pages/Accounts.jsx`** — "Merge" button on CSV account cards (non-Plaid, non-manual). Dropdown lists all other CSV sources as merge targets. Merged accounts are absorbed (hidden) into the target card. Target card shows "Includes: X, Y" badge. Unmerge button restores standalone. Merged accounts collapsed in "X merged accounts (absorbed into another)" section.
- **`api/routes/accounts.js`** — `linked_source` field added to alias select, aliasMap, and row output. PUT /alias route now accepts `linked_source`. Merged accounts excluded from page-level spending totals to prevent double-counting.

#### Migration required
```sql
ALTER TABLE account_aliases ADD COLUMN IF NOT EXISTS linked_source TEXT;
```

---

## [v7.8.29] — 2026-05-20

### Bank Import page emoji cleanup

#### Changed
- **`web-react/src/pages/Import.jsx`** — Removed all emoji from user-facing labels: Plaid section header, Pro Tip, Smart Merge, post-import nav buttons, Start Import button, comparison section icons.

---

## [v7.8.28] — 2026-05-20

### Billing section: Sync users see upgrade path; remove emoji from button

#### Changed
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Upgrade cards now show for Sync-tier users (Core + Studio only — Sync card hidden since they have it). Grid switches to 2-col for Sync users. Remove emoji from "Manage Billing" button.

---

## [v7.8.27] — 2026-05-20

### Fix Stripe webhook signature verification; remove stale $0.50 billing copy

#### Fixed
- **`api/server.js`** — Stripe webhook now mounted directly on `app` BEFORE `express.json()`. Previously `express.json()` parsed the body first, making signature verification impossible (Stripe requires raw Buffer). All webhook events were returning 400.
- **`web-react/src/components/PlaidLink.jsx`** — Billing confirmation dialog no longer mentions $0.50/account. Now says flat subscription required.
- **`web-react/src/components/OnboardingChecklist.jsx`** — Plaid pill updated from `$0.50/account/mo` to `from $4.99/mo`.
- **`web-react/src/pages/Accounts.jsx`** — Unsync button tooltip no longer mentions $0.50/mo fee.

---

## [v7.8.26] — 2026-05-20

### Remove icons from account labels; update roadmap

#### Changed
- **`web-react/src/pages/Transactions.jsx`** — Stripped all emoji icons from `ACCOUNT_LABELS`. Labels are plain text only.
- **`ROADMAP.md`** — Updated to v7.8.25, added v7.8.19–v7.8.25 to completed sprint log, marked Sync price IDs done.

---

## [v7.8.25] — 2026-05-20

### Fix Plaid account repair reliability + date column wrapping

#### Changed
- **`api/routes/plaid.js`** — Call `accountsGet` explicitly before the sync loop instead of relying on `transactionsSync` response accounts (which may be empty when no new transactions). Guarantees account name map is always populated for repair.
- **`web-react/src/pages/Transactions.jsx`** — Date column `whiteSpace: nowrap` + widened to 11% to prevent date wrapping.

---

## [v7.8.24] — 2026-05-20

### Fix Plaid transactions showing "Plaid" as account — use real account name

#### Changed
- **`api/routes/plaid.js`** — `syncTransactions` now builds an account map from the Plaid response and uses the actual account name (e.g. "USAA Checking", "USAA Credit Card") as the `source` field. Added `makePlaidSourceKey()` helper. After each sync, existing transactions with `source = 'plaid'` are repaired to the correct account name automatically.

---

## [v7.8.23] — 2026-05-20

### Fix Vercel cron — remove >1x/day schedule incompatible with Hobby plan

#### Changed
- **`vercel.json`** — Removed `0 */6 * * *` cron (Hobby plan blocks sub-daily intervals). UptimeRobot pings `/api/health` every 5 min — Supabase keep-alive is already covered.

---

## [v7.8.18] — 2026-05-20

### Add Sync tier ($4.99/mo); update marketing pricing + in-app upgrade cards + billing gate

#### Added
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Added `sync_monthly` and `sync_annual` to `PLAN_LABELS`, `VITE_PRICE`, and `isPaid` array. Upgrade cards section rebuilt as 3-column grid (Sync · Core · Studio) for free/beta users.
- **`web-react/src/components/PlaidLink.jsx`** — Added `sync_monthly`/`sync_annual` to `VITE_PRICE`. Billing gate UI now shows Sync as a featured primary option ("Just Plaid? Start Here") with Core + Studio below in a 2-col grid.
- **`web-react/src/pages/Home.jsx`** — Pricing section now renders all 4 tiers (Free / Sync $4.99 / Core $9 / Studio $19). Added `badge` rendering for "MOST POPULAR" label on Core. Final CTA text updated — removed "free during beta" copy.

#### Notes
- Requires `VITE_STRIPE_PRICE_SYNC_MONTHLY` and `VITE_STRIPE_PRICE_SYNC_ANNUAL` env vars in Vercel. Create the Stripe product first, then add the price IDs.

---

## [v7.8.17] — 2026-05-20

### Revert beta Plaid bypass; inline billing gate UI with plan upgrade cards

#### Changed
- **`api/routes/plaid.js`** — Reverted PLAID_BETA_PLANS bypass. All users (including free_beta, lifetime) must have stripe_customer_id before connecting Plaid. Only PLAID_BILLING_EXEMPT UUIDs (Joshua, Michelle) are exempt. No plan-type exceptions.
- **`web-react/src/components/PlaidLink.jsx`** — On 402, sets `billingGate` state instead of showing inline error. Renders a full plan-upgrade UI: explanation of fee separation (Plaid $0.50/mo vs Stripe invoice key), Monthly/Annual toggle, Core and Studio plan cards with direct Stripe checkout buttons. Users subscribe, then return to connect their bank.

---

## [v7.8.16] — 2026-05-20

### Beta users bypass Plaid billing gate; fix error banner wrapping

#### Fixed
- **`api/routes/plaid.js`** — Added `PLAID_BETA_PLANS` set (`free_beta`, `beta_tester`, `lifetime`). Billing gate now checks `plan_type` in addition to `stripe_customer_id` — beta/lifetime users bypass the gate entirely. Beta = full feature access during beta period includes Live Bank Sync.
- **`web-react/src/components/PlaidLink.jsx`** — Error banner (`tag bad`) now has `whiteSpace: 'normal'` so the message wraps instead of overflowing. Updated error text to clarify that the Stripe publishable key in Business Profile is for *client invoice payments* and is separate from the Lumière Ledger subscription billing that Plaid requires.

---

## [v7.8.15] — 2026-05-20

### Connect Bank auto-triggers Plaid popup; better billing error

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — "Connect a Bank" button now navigates to `/import?connect=true` instead of bare `/import`.
- **`web-react/src/pages/Import.jsx`** — Reads `?connect=true` param via `useSearchParams`; auto-expands Plaid section (`showPlaid` initializes to `true` when param present); passes `autoConnect` prop to `<PlaidLink>`.
- **`web-react/src/components/PlaidLink.jsx`** — Accepts `autoConnect` prop; fires `handleConnect()` once after accounts finish loading (guarded by `useRef` to prevent double-fire). Billing error message now specifies the exact path to add a payment method.

---

## [v7.8.14] — 2026-05-20

### Stripe setup — onboarding step + in-profile guidance

#### Added
- **`web-react/src/components/OnboardingChecklist.jsx`** — New "💳 Enable Online Invoice Payments" step added to the When You're Ready section. Links directly to Business Profile tab.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Added dedicated Stripe guidance callout above the payment handles section: 4-step instructions (create Stripe account → Developers → API Keys → copy publishable key → paste and save), direct link to `dashboard.stripe.com/apikeys`, warning callout distinguishing publishable vs secret key. Also added inline link on the key input field itself.

---

## [v7.8.13] — 2026-05-19

### Business Profile — full-width responsive layout, eliminate dead space

#### Changed
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Complete layout rework:
  - Removed `maxWidth: 850px` wrapper — form now uses full container width
  - Added responsive CSS via `<style>` block: 2-column grid on desktop, single-column on ≤640px
  - Paired previously orphaned fields: Business Name + Category, Phone + Address, Tax ID + Entity Type, NAICS + Invoice Notes, Contract Terms + Payment Methods
  - Reduced `gap` from 30px → 20px, input padding from 15px → 13px, textarea `minHeight` from 80–100px → 65px
  - Outer card padding uses `clamp(20px, 4vw, 40px)` for better mobile feel
  - Payment handles section uses same responsive grid

---

## [v7.8.12] — 2026-05-19

### Fix onboarding checklist nav paths

#### Fixed
- **`web-react/src/components/OnboardingChecklist.jsx`** — "Set Up AI" path corrected from `?tab=integrations` to `?tab=intelligence` (AI Intelligence tab). "Open Invoicing" path corrected from `/crm` (PipelineView) to `/crm/financials` (Invoice page). "Explore the Help Docs" step title renamed to "Explore the Help Docs & FAQs".

---

## [v7.8.11] — 2026-05-19

### Onboarding wizard minimizes on nav; upgrade plans for beta users

#### Fixed
- **`web-react/src/components/OnboardingChecklist.jsx`** — Clicking a step link (Open Profile, Set Up AI, etc.) now minimizes the wizard to a floating "📋 Resume Setup" button in the bottom-right corner instead of keeping the full-screen modal overlay open. The user can interact with the destination page, complete the step, then click the button to restore the checklist. Added `minimized`/`onMinimize`/`onRestore` props to `PageChecklist`; `go()` calls `onMinimize()` then navigates.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Upgrade plan cards (Core / Studio) were hidden for all `isGrandfathered` users, which includes `free_beta`. Beta users couldn't see any other plans. Fixed: condition changed from `!isGrandfathered` to `!isLifetime` — beta users now see upgrade cards; lifetime accounts still don't.

---

## [v7.8.9] — 2026-05-19

### Fix Vercel build failure — unescaped apostrophe in OnboardingChecklist

#### Fixed
- **`web-react/src/components/OnboardingChecklist.jsx`** — Line 242 contained `'I'll finish setup later...'` — the apostrophe in "I'll" terminated the JS string literal early, causing esbuild to fail with `Expected "}" but found "ll"`. All 4 deployments since v7.8.7 failed with this error. Fixed by switching to double-quoted string: `"I'll finish setup later — take me in"`. This unblocks v7.8.7 (onboarding wizard) and v7.8.8 (flash fix + label corrections) which were never live.

---

## [v7.8.8] — 2026-05-19

### Fix upgrade plan flash; separate beta vs lifetime labels

#### Fixed
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Upgrade plan cards (Core / Studio) were flashing briefly for beta/lifetime users on every page load. Root cause: `subscription` starts as `null` → `planType='free'` → `isLifetime=false` → upgrade cards render → subscription resolves to `free_beta` → cards disappear. Fixed by gating BillingSection on `subscriptionReady` — shows "Loading subscription…" placeholder until auth data is fully resolved.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — `free_beta` plan type incorrectly showed "Lifetime Free" label (same as true `lifetime` accounts). Beta accounts have an `expires_at` and are NOT lifetime. Fixed: `free_beta` / `beta_tester` → "Beta Access" (purple); `lifetime` → "Lifetime Free" (green). Beta accounts now show "Beta access · N days remaining" subtitle. Lifetime accounts show the grandfathered savings message.

---

## [v7.8.7] — 2026-05-19

### New 3-page onboarding wizard; fix first-login trigger bug

#### Fixed
- **`web-react/src/App.jsx`** — Onboarding trigger now uses `subscriptionReady` instead of `subscription`. New users have no subscription record yet, so `subscription` was always null and the trigger returned early — onboarding never fired. `subscriptionReady` is set after the fetch attempt completes regardless of result. Also checks `ll_onboarding_dismissed` localStorage key for consistency with the component's dismiss handler.

#### Added / Rewritten
- **`web-react/src/components/OnboardingChecklist.jsx`** — Complete rewrite as a 3-page wizard:
  - **Page 1 (Welcome):** Brand intro, 6 feature cards (Ledger, AI Brain, Invoicing, Plaid, Gear, Mileage). "Get Started" or "Skip" CTAs.
  - **Page 2 (Data Import Guide):** Explains CSV Import (free) vs Plaid Live Sync ($0.50/account/mo) with step-by-step instructions for each. Prevents users from landing on an empty dashboard with no idea how to populate it.
  - **Page 3 (Setup Checklist):** 5-step checklist split into "Start Here" (Profile + Import) and "When You're Ready" (AI Key, Invoicing, Docs). Per-step checkboxes + direct navigation links. Progress bar. Dismiss button label changes to "🎉 All set" when required steps are checked.

---

## [v7.8.6] — 2026-05-19

### Filter pills filter Plaid sub-accounts; Account Plans nav fix

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — Filter pills (Credit / Checking / Savings) now filter the Plaid sub-account rows inside the Live Sync card in real-time. Credit → shows only USAA CC. Checking → shows Checking + House Sale. Savings → shows Savings + Photography. Manual → shows nothing (no Plaid sub-accounts are manual). Shows "No [type] sub-accounts in this connection" if filter matches nothing.
- **`web-react/src/App.jsx`** — "Account Plans" nav link now routes to `/StudioControlCenter?tab=profile` (billing/plan section) instead of `?tab=saas` (admin-only SaaS management panel that users couldn't see).

---

## [v7.8.5] — 2026-05-19

### Fix Accounts page type filter pills

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — Live Sync (Plaid) section was disappearing when Credit / Checking / Savings filter was active. Root cause: `syncedAccounts` was derived from the already-filtered `visibleAccounts`, so the Plaid card (account_type='checking') was excluded when filtering for Credit. Fixed by computing `syncedAccounts` from `allVisible` (all visible accounts, no type filter). `filterType` now applies only to the type-grouped sections. Live Sync section is always rendered when a Plaid connection exists regardless of active filter.

---

## [v7.8.4] — 2026-05-19

### plaid_account_id per-sub-account filtering; savings type; mailer fixes

#### Added
- **`api/migrations/001_plaid_account_id.sql`** — Idempotent migration: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS plaid_account_id TEXT` + index. **Must be run once in Supabase SQL Editor before sub-account filtering activates.**
- **`api/routes/plaid.js`** — Sync engine now stores `plaid_account_id: t.account_id` on every new Plaid transaction. `crossSourceDedup` also stamps `plaid_account_id` on matched CSV rows alongside `plaid_transaction_id`.
- **`web-react/src/hooks/useExpenseFilters.js`** — New `plaidAccountId` filter param. Exact match on `r.plaid_account_id`. Used by Transactions page for sub-account drill-down.
- **`web-react/src/pages/Transactions.jsx`** — Reads `?plaid_account_id=` + `?plaid_account_name=` URL params on mount. Active sub-account shown as a green badge above filters with ✕ to clear. Included in filter object passed to hook. Cleared on RESET FILTERS.
- **`web-react/src/pages/Accounts.jsx`** — Sub-account row clicks now navigate to `/transactions?source=plaid&plaid_account_id=<id>&plaid_account_name=<name>`. Added `savings` to `TYPE_GROUPS`. Added `💰 Savings` and `✏️ Manual` filter pills to Accounts page.
- **`api/routes/accounts.js`** — `SAVINGS_KEYWORDS` array added. `detectAccountType` now returns `'savings'` for source names matching savings/hsa/ira/invest/hysa patterns before defaulting to `'checking'`.

#### Fixed
- **`api/utils/mailer.js`** — Daily stats email and intake notification email hardcoded `support@lumiereledger.com` (unverified domain) replaced with `process.env.RESEND_FROM` fallback to `support@throughthelens.media`.

#### Notes
- Sub-account filtering only works on **new transactions** synced after the migration is run. Existing Plaid transactions have `plaid_account_id = NULL` until next sync. Trigger a manual sync from the Accounts page to backfill recent history.

---

## [v7.8.3] — 2026-05-19

### Fix Live Sync duplicates; Plaid Linked accounts back in type groups; Unlink button

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — `syncedAccounts` filter changed from `source==='plaid' || has_plaid_link` to `source==='plaid'` only. Plaid Linked CSV accounts now appear in their Credit/Checking type groups instead of polluting Live Sync. Eliminates USAA appearing 4-5 times.
- **`web-react/src/pages/Accounts.jsx`** — "Plaid Linked" badge replaced with a custom `<span title="...">` that explains no extra billing on hover. Differentiates visually from the "Live Sync" badge.

#### Added
- **`api/routes/plaid.js`** — New `DELETE /plaid/link/:source_key` endpoint. Clears `plaid_transaction_id` from all expenses for that source (user-scoped). Does not touch `plaid_connections` or billing.
- **`web-react/src/pages/Accounts.jsx`** — "Unlink" button on `isLinked` CSV accounts. 2-step confirm → calls `DELETE /plaid/link/:source_key` → optimistically clears `has_plaid_link` on that card. Allows removing Plaid cross-match per account without disconnecting the bank.

---

## [v7.8.2] — 2026-05-19

### Stale-while-revalidate caching for Accounts + Plaid balances; FAQ additions

#### Performance
- **`web-react/src/pages/Accounts.jsx`** — `/accounts/summary` response cached in `localStorage` key `ll_accounts_cache`. On mount: state initialised from cache (instant render), full loading spinner suppressed when cache exists. Background refresh fires silently; `refreshing` indicator shows in header. Post-sync reload uses `load(true)` (silent) to avoid re-spinner.
- **`web-react/src/pages/Accounts.jsx` — `BalanceRows`** — `/plaid/balances` response cached in `ll_plaid_balances_cache`. State initialised from cache so balance rows appear immediately. Live fetch updates silently; "Refreshing…" label shown in header while in-flight. On fetch error, stale data is preserved instead of blanking the UI.

#### Added
- **`web-react/src/components/control-center/HelpTab.jsx`** — Two new FAQ entries: (1) How to disconnect Plaid — step-by-step via Accounts → Live Sync → Unsync, clarifies existing transactions are retained. (2) How to delete your account and all data — email support@throughthelens.media, 5-business-day SLA, export reminder.

---

## [v7.8.1] — 2026-05-19

### Plaid sub-account drill-down + per-sub-account hide

#### Added
- **`web-react/src/pages/Accounts.jsx`** — `BalanceRows` fully reworked. Each Plaid sub-account row (Savings, Checking, Photography, USAA CC, etc.) is now clickable — hover shows blue highlight + "View →" indicator, click navigates to `/transactions?source=plaid`. Per-sub-account hide toggle (👁) persisted in `localStorage` key `ll_hidden_plaid_accts`. Hidden sub-accounts collapse under a "Show N hidden" expander with 🙈 icon; unhide by clicking 🙈. Page subtitle hint updated to mention sub-account interactivity.

---

## [v7.8.0] — 2026-05-19

### Full Terms of Service — 25 sections, payment terms, arbitration, Tennessee law

#### Added
- **`web-react/src/pages/Terms.jsx`** — Full rewrite. 25 comprehensive sections: Acceptance, Eligibility (US only / 18+), Service Description, Account Registration, Subscription Plans & Billing, Refund Policy (30-day guarantee for LL sub; no refunds for Plaid fees), Cancellation, Plaid Live Bank Sync terms, AI/BYOB disclaimer, Financial & Tax disclaimer, Third-Party Services (Stripe, Plaid, Google, Supabase, Resend), User Data & Ownership, Receipt Storage, Invoicing, Acceptable Use, Intellectual Property, Disclaimer of Warranties (AS IS), Limitation of Liability (capped at 12 months fees or $100), Indemnification, Dispute Resolution & Binding Arbitration (AAA / Nashville TN / class action waiver), Governing Law (Tennessee), Termination, Modifications, Severability, Contact. Entity: Through The Lens Media, Inc, Tennessee.

---

## [v7.7.9] — 2026-05-19

### Auth emails now route through Resend; signup message updated

#### Fixed
- **`web-react/src/pages/Login.jsx`** — Signup success message updated to show `support@throughthelens.media` as the sender now that Supabase SMTP is configured to use Resend. Removed hardcoded `noreply@mail.app.supabase.io` reference.

#### Infrastructure
- **Supabase Auth → SMTP Settings** — Configured custom SMTP via Resend: host `smtp.resend.com`, port 465, username `resend`, sender `Lumière Ledger <support@throughthelens.media>`. Removes Supabase free-tier 4/hour email rate limit. Auth emails (signup confirmation, password reset) now deliver reliably from the verified `throughthelens.media` domain.

---

## [v7.7.8] — 2026-05-19

### Plaid billing gate, onboarding checklist, nav reorder, login/profile/email cleanup

#### Security Fix
- **`api/routes/plaid.js`** — **CRITICAL: Plaid billing gate added.** `POST /plaid/create-link-token` now checks if user is in `PLAID_BILLING_EXEMPT` or has a `stripe_customer_id` in `user_subscriptions`. Users without a billing method receive HTTP 402 and cannot connect to Plaid. Prevents free accounts from bypassing Plaid fees.
- **`web-react/src/components/PlaidLink.jsx`** — Fee confirmation modal shown before initiating Plaid Link (uses `modal.confirm` with $0.50/account/month disclosure). 402 errors surface a clear billing setup message.

#### Added
- **`web-react/src/components/OnboardingChecklist.jsx`** — New 4-step onboarding checklist modal for new accounts: Set up Business Profile, Set up AI Brain, Connect Bank via Plaid, Review Documentation. Progress bar, per-step checkboxes (persisted in localStorage), action links to each destination. Replaces old 3-bullet `OnboardingModal`.
- **`web-react/src/App.jsx`** — Nav reordered per product spec: Financials (Dashboard, Accounts, Transaction Ledger, Tax Data); Operations (Bank Import, Mileage Log, Camera Gear); Settings (Ledger Control Center, Business Profile, Documentation & FAQ, Add-Ons, Account Plans).

#### Fixed
- **`web-react/src/pages/Login.jsx`** — Success message box no longer overflows (`wordBreak`, `overflowWrap`, `whiteSpace: normal`). Message updated to explain Supabase Auth email (noreply@mail.app.supabase.io) is the legitimate identity verification system — not spam. Removed stale "Studio Tracker → Lumière Ledger" brand update banner.
- **`web-react/src/components/control-center/ProfileTab.jsx`** — "STUDIO LOGO" → "LOGO", button labels "Upload Logo" / "Change Logo". Removed personal placeholder data (Joshua Dewey, 702.236.9023, throughthelens.media).
- **`api/utils/mailer.js`** — Invite email footer changed from "private beta / contact your administrator" to "Questions? Reach us at support@throughthelens.media".

---

## [v7.7.7] — 2026-05-19

### Landing page rebuilt to match throughthelens.media/marketing/lumiere-ledger

#### Changed
- **`web-react/src/pages/Home.jsx`** — Full rewrite. Now matches the reference marketing page: hero with "Your Entire Business. One Command Center." headline, 4 badge pills (bank profiles, IRS threshold, Gemini, PWA), two CTA buttons. "Everything You Need" section with all 8 feature cards (AI Assistant, Invoicing, Dashboard, CRM, Gear, CSV Import, Mileage, Receipts) with badges. Tax Automation section with 5 bullet points. Client Management section with 5 bullet points. AI Intelligence section with 6 example prompts. Pricing section with 3 tiers (Core free, Pro $19, Studio $49). Final CTA "Stop Running Your Business From Spreadsheets" banner. Footer updated to "© 2026 Through The Lens Media · lumiereledger.com".

---

## [v7.7.6] — 2026-05-19

### Accounts — synced accounts on top, disconnect, clickable transaction counts; nav scroll fix; Import cleanup

#### Added
- **`web-react/src/pages/Accounts.jsx`** — New "🔗 Live Sync" section always appears at the top of the Accounts page containing all Plaid-connected and Plaid-linked accounts. Non-synced accounts remain grouped by type below. "Transactions" stat tile on each card is now clickable and navigates to `/transactions?source=<source>` to filter the ledger instantly. "Unsync" button on Plaid Live Sync cards with two-step confirm → calls `DELETE /plaid/accounts/:id` and reloads page. `onDisconnect` prop wires all card variants.
- **`web-react/src/pages/Transactions.jsx`** — `?source=` URL param now pre-populates the account filter on mount (same pattern as existing `?search=`).

#### Fixed
- **`web-react/src/App.jsx`** — Nav dropdown now has `maxHeight: calc(100vh - 110px)` and `overflowY: auto` so the Logout button is always reachable on short screens.
- **`web-react/src/pages/Import.jsx`** — Removed "Coming Soon" label from Plaid section toggle; Plaid is live.

---

## [v7.7.5] — 2026-05-19

### Accounts page — type groups, sort/filter, Plaid-linked badges, always-visible Plaid card

#### Fixed
- **`api/routes/accounts.js`** — Added `plaid_transaction_id` to expenses select so `has_plaid_link` flag is detected per source. Plaid card always generated from `plaid_connections` even when all transactions were cross-source linked (no `source='plaid'` rows). Credit card detection expanded: venture, sapphire, freedom, platinum, gold, skymiles, southwest, united, ink keywords added. Page-level totals exclude `source='plaid'` row to prevent double-counting with linked CSV accounts.
- **`web-react/src/pages/Accounts.jsx`** — Grouped by account type (💳 Credit Cards / 🏦 Checking & Savings / ✏️ Manual). Sort dropdown: spend this month, YTD, transactions, name. Filter pills: All / Credit / Checking. Plaid/linked accounts float to top within each group. "🔗 Plaid Linked" badge on CSV accounts that have been matched to Plaid. 🔄 Sync button on Plaid and linked cards. Sync result banner inline. Single AccountCard component handles all types.

---

## [v7.7.4] — 2026-05-19

### Plaid cross-source dedup — no duplicates when connecting an account you already imported via CSV

#### Added
- **`api/routes/plaid.js`** — `crossSourceDedup()` function: before inserting any Plaid transaction, queries existing expenses in the same date range with `plaid_transaction_id IS NULL` (CSV/manual). Matches on `expense_date + amount_cents`. Match → stamps the Plaid transaction ID onto the existing row (preserving your category, notes, receipts, tax flags), skips insert. No match → inserts as new. `linked` count returned alongside `added/modified/removed`.
- **`web-react/src/components/PlaidLink.jsx`** — Connection success and sync result messages now show "X matched to existing imports" when cross-source links are made.

---

## [v7.7.3] — 2026-05-19

### Plaid live balances + institution names on Accounts page

#### Added
- **`api/routes/plaid.js`** — `GET /plaid/balances`: real-time `accountsBalanceGet` call per active connection. Returns per-institution array with per-sub-account `{ name, type, subtype, current, available, currency }`. Errors per-institution are isolated — one failing connection doesn't break others.
- **`api/routes/accounts.js`** — Summary now includes `plaid_connections` array (institution_name, last_synced_at) alongside transaction data.
- **`web-react/src/pages/Accounts.jsx`** — Plaid accounts get a dedicated `PlaidCard` component: shows real institution name (e.g. "USAA") from `plaid_connections`, "Last synced" timestamp, Live Account Balances section with per-sub-account rows (available balance for checking, balance owed for credit), total across accounts. Balances load async after page paint so page is never blocked by the Plaid API call.

---

## [v7.7.2] — 2026-05-19

### Accounts page — grouped sections + connection type badges

#### Changed
- **`web-react/src/pages/Accounts.jsx`** — Accounts now grouped into three labeled sections: "Connected Banks" (Plaid live sync), "Imported Accounts" (CSV), "Manual Entry". Each card has a prominent connection-type badge: green pulsing dot for Live Sync, blue for CSV Import, purple for Manual. Progress bar color now matches connection type. "Connect a Bank" CTA only shows when no Plaid accounts are connected. Left border accent color per connection type.

---

## [v7.7.1] — 2026-05-19

### Account aliases — rename & hide

#### Added
- **`api/tests/account-aliases-migration.sql`** — Idempotent migration for `account_aliases` table (`user_id`, `source_key`, `display_name`, `visible`). RLS enabled. Run in Supabase SQL editor.
- **`api/routes/accounts.js`** — `PUT /api/accounts/alias` endpoint: upsert `{ source_key, display_name, visible }` with partial update support. Summary endpoint now fetches aliases in parallel and merges `display_name` / `visible` into each account row. Page-level totals calculated from visible accounts only.
- **`web-react/src/pages/Accounts.jsx`** — Inline rename (✏ pencil icon → text input → Save / Escape), visibility toggle (👁 eye icon hides account, 🙈 for hidden). Hidden accounts collapse to a "Show N hidden accounts" expander at the bottom. Alias changes are optimistic (no full reload). Source key shown in subdued monospace below institution name for identification.

---

## [v7.7.0] — 2026-05-19

### AI Brain subscriptions fix + Plaid billing exemption list

#### Changed
- **`api/routes/brain.js`** — Added SUBSCRIPTIONS RULE to system prompt. When user asks about "subscriptions", "recurring charges", or "monthly bills", Brain now searches ALL categories (not just "Software & Subscriptions"), uses no category filter over a 60–90 day range, groups repeated vendors by frequency, and calculates estimated monthly cost. Never dead-ends on zero Software & Subscriptions results.
- **`api/routes/stripe.js`** — Replaced single `ADMIN_USER_ID` constant with `PLAID_BILLING_EXEMPT` Set. Joshua's admin UUID pre-populated; Michelle Gornichec's UUID slot added with comment (pending UUID confirmation).

---

## [v7.6.9] — 2026-05-19

### Accounts page — mobile layout fix

#### Fixed
- **`web-react/src/pages/Accounts.jsx`** — Stats grid changed from `repeat(4, 1fr)` to `repeat(auto-fit, minmax(110px, 1fr))` — collapses to 2×2 on mobile. Summary bar uses `repeat(auto-fit, minmax(160px, 1fr))`. Card header uses `flexWrap: wrap`. Progress bar row uses `flex: 1 1 80px`. Cards use `width: 100%` + `boxSizing: border-box` to fill `.wrap` container. Added 'checking' source key to SOURCE_META (was falling through to unknown). Negative last-month amounts handled safely in `fmt()` and `trendArrow()`. Removed inner `maxWidth: 900` constraint — pages inherit the 1180px from `.wrap`.
- **Commit attribution** — removed Co-Authored-By trailers. All commits are Through The Lens Media / Joshua Deuermeyer only.

---

## [v7.6.8] — 2026-05-19

### Accounts Page + Plaid Activation + Billing Fix

#### Added
- **`web-react/src/pages/Accounts.jsx`** — New Accounts page at `/accounts`. Per-source cards: this month, last month, YTD, transaction count, % of monthly spend, trend vs. last month. Summary bar: total / checking / credit card totals.
- **`api/routes/accounts.js`** — `GET /api/accounts/summary` endpoint. Single date-range query, JS aggregation by source key. Returns per-account + page-level totals.
- **Accounts nav link** — Added to Operations section in hamburger menu (App.jsx).
- **"Connect a Bank" CTA** — Accounts page footer links to `/import` to open Plaid Link.

#### Fixed
- **`api/utils/cryptoUtil.js`** — Replaced stub (throws on call) with real libsodium-wrappers implementation. Async encrypt/decrypt using `crypto_secretbox_easy`. Key must be 32-byte hex set as `ENCRYPTION_KEY` env var.
- **`api/routes/plaid.js`** — Added `await` to all 3 encrypt/decrypt call sites (exchange-token, disconnect, syncTransactions loop) — required now that cryptoUtil functions are async.
- **`api/routes/stripe.js`** — Billing function `buildPlaidInvoiceItems` was querying `plaid_accounts` (wrong table) with `.eq('active', true)` (wrong column). Fixed to `plaid_connections` and `.eq('status', 'active')`.
- **`api/package.json`** — Restored `plaid@^29.0.0` and added `libsodium-wrappers@^0.7.15`. Tested locally: `node -e "require('./server.js')"` → `LOAD_OK`.
- **`web-react/src/components/control-center/SaasTab.jsx`** — Removed `pro` from `PLAN_OPTIONS`. Admin dropdown now shows: Beta Tester, Monthly, Annual, Lifetime only. Existing Pro users unaffected (backend expiry handler preserved).

#### Notes
- `ENCRYPTION_KEY` must be set in Vercel env before Plaid token exchange will succeed.
- Plaid keys (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=production`) must be set in Vercel.
- Force deploy recommended after adding new packages: `vercel deploy --prod --force`

---

## [v7.6.7c] — 2026-05-19

### Hotfix — Vercel Build Cache Bypass / plaid Module Missing

#### Root Cause
`api/package-lock.json` was stale — committed before `plaid` was added to `api/package.json`. Vercel restores `node_modules` from build cache keyed to the lock file. Because the lock file hadn't changed, npm reported "up to date" and never installed plaid. At runtime, the first request path that invoked `getPlaidClient()` → `require('plaid')` threw `Cannot find module 'plaid'`, crashing the Node.js function process. All concurrent requests on the same instance also failed (HTTP 500 / `FUNCTION_INVOCATION_FAILED`).

#### Fixed
- **`api/package-lock.json`** — Regenerated with `npm install --package-lock-only`. Now includes `plaid@29.0.0` and its full dependency tree. Committed alongside `package.json` so Vercel cache invalidates correctly on next build.

#### Prevention
Non-Negotiable Rule 10 added to `CLAUDE.md`: always run `npm install` inside `api/` and commit the updated lock file any time `package.json` changes. Deploy Workflow step 2 updated with explicit `npm install` + `git add package-lock.json` gate before push.

---

## [v7.6.7b] — 2026-05-18

### Hotfix — Corrected plaid Package Version

#### Fixed
- **`api/package.json`** — `plaid` version corrected from `^14.3.0` (nonexistent) to `^29.0.0` (latest stable).

---

## [v7.6.7a] — 2026-05-18

### Hotfix — Add Missing plaid Dependency

#### Fixed
- **`api/package.json`** — Added `"plaid": "^29.0.0"`. Package was missing entirely, causing `FUNCTION_INVOCATION_FAILED` crashes when Plaid routes were hit after `PLAID_CLIENT_ID`/`PLAID_SECRET` were added to Vercel env vars (activating `requirePlaidConfig` middleware).

---

## [v7.6.7] — 2026-05-18

### Stripe — ProfileTab Billing Section

#### Modified
- **`web-react/src/components/control-center/ProfileTab.jsx`** — Billing section added at top of Profile tab. Shows current plan badge with tier label and color. Free users see upgrade card with Core/Studio options and monthly/annual toggle — clicking initiates Stripe Checkout. Paid users see "Manage Billing" → Stripe Customer Portal. Lifetime/free_beta users see grandfathered badge with savings callout. Admin-granted tiers show override label with no billing options.

---

## [v7.6.6] — 2026-05-18

### Stripe — Route-Level Tier Limit Enforcement

#### Modified
- **`api/routes/expenses.js`** — `POST /expenses` now counts this month's transactions before insert. Returns `403 tier_limit_reached` at Free (500/mo) and Core (2,000/mo) caps.
- **`api/routes/invoices.js`** — `POST /invoices` counts this month's invoices before insert. Returns `403` at Free (3/mo) and Core (20/mo) caps.
- **`api/routes/rules.js`** — `POST /rules` counts total automation rules before insert. Returns `403` at Free (5) and Core (25) caps.
- **`api/routes/leads.js`** — `POST /leads` counts total CRM leads before insert. Returns `403` at Free (10) cap.
- **`api/routes/assets.js`** — `POST /assets` counts total equipment items before insert. Returns `403` at Free (5) cap.

All limit checks use `req.tierLimits` from licensing middleware. Studio tier is always `Infinity` — bypasses all checks. Error shape: `{ error: 'tier_limit_reached', limit, tier, message }`.

---

## [v7.6.5] — 2026-05-18

### Stripe Billing Infrastructure — Free / Core / Studio tiers

#### Added
- **`api/routes/stripe.js`** — New Stripe integration: `create-checkout`, `portal`, `status`, and webhook handler (6 events: `checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `payment.failed`, `invoice.upcoming`, `payment.succeeded`). Includes Plaid overage billing stub (`buildPlaidInvoiceItems`). Admin tier override logic (`deriveTier`) respects `admin_tier` column over `plan_type`.
- **`web-react/src/components/UpgradeGate.jsx`** — New component wrapping premium features. Props: `minTier` (`'core'|'studio'`), `feature` (string). Shows children to qualifying users, upgrade card with monthly/annual toggle to others. Checkout handled via `POST /api/stripe/create-checkout`.
- **`STRIPE_ROADMAP.md`** — Fully rewritten with three-tier model (Free/$0, Core/$9/mo, Studio/$19/mo), complete feature gate matrix, all `plan_type` values, `deriveTier()` logic, `UpgradeGate` usage, Stripe setup checklist (4 products), and post-launch roadmap.
- **`PLAID_BILLING_SPEC.md`** — Updated: Plaid available on all tiers. Grandfathered Free members pay usage fee only; no platform charge. Two sample invoices added (Studio user with overage, Free member with overage).

#### Modified
- **`api/server.js`** — Stripe webhook mounted before `authMiddleware` with `express.raw()`. `stripeRouter` mounted after `authMiddleware`. `licensingMiddleware` import updated to named export.
- **`api/middleware/licensing.js`** — Added `deriveTier()`, `TIER_LIMITS` constants (per-tier caps for transactions, invoices, rules, leads, equipment), `admin_tier` override support. Attaches `req.tier` and `req.tierLimits` for use in routes. Exports named `{ licensingMiddleware, deriveTier, TIER_LIMITS }`.
- **`web-react/src/components/AuthContext.jsx`** — Added `deriveTier()` function, exposes `tier` (`'free'|'core'|'studio'`) from `useAuth()`. Respects `admin_tier` from subscription record.
- **`web-react/src/pages/AddOns.jsx`** — Fixed Website Lead Capture CTA path (`/control-center` → `/StudioControlCenter?tab=integration`). Added Photography Website Builder CTA linking to `https://websites.throughthelens.media`.
- **`ROADMAP.md`** — Stripe billing row updated to reference `PLAID_BILLING_SPEC.md`.

---

## [v7.6.4] — 2026-05-18

### Information Security Policy — published in-app

#### Added
- **`web-react/public/docs/Information_Security_Policy_TTLM.pdf`** — Full ISP document covering governance, access controls, encryption, network security, vendor risk (including Plaid), incident response, business continuity, and physical security. Generated to satisfy Plaid security questionnaire Q2 compliance requirement.
- **`web-react/src/components/control-center/HelpTab.jsx`** — New "Legal & Compliance" section at the bottom of the Documentation tab. Shows three linked cards: Information Security Policy (PDF, opens in new tab), Privacy Policy, and Terms of Service. ISP card styled with accent border to distinguish it as a primary compliance document.

---

## [v7.6.3] — 2026-05-18

### Bank import source list cleanup

#### Changed
- **`web-react/src/pages/Import.jsx`** — Removed emoji icons from all bank labels. Dropdown now uses grouped optgroups: "★ Recommended" (Rocket Money), "Major Banks" (Chase, BofA, Capital One, Wells Fargo, Apple Card, USAA, US Bank), "Other" (Navy Federal, Wise, Universal / Generic). Rocket Money option includes inline note — "covers all accounts in one export". Updated tip text for Rocket Money. Fixed import button label — removed emoji-stripping regex that was no longer needed.

---

## [v7.6.2] — 2026-05-18

### Launch gate — validation test suite + RLS audit queries

#### Added
- **`api/tests/launch-gate.js`** — Self-contained test runner for validation tests 3–6. Creates a temporary Supabase user (email pre-confirmed via admin API, no inbox needed), runs all tests, then deletes the test account. Test 6 correctly detects cross-user isolation by verifying the target expense still exists after the delete attempt (204 response is not enough — Supabase doesn't error on no-match deletes). Run: `node api/tests/launch-gate.js` (production) or `node api/tests/launch-gate.js --local`.
- **`api/tests/rls-audit.sql`** — Seven SQL blocks for the Supabase SQL Editor: RLS enabled/disabled per table, all existing policies, tables with RLS on but no policies (fully locked), tables missing `user_id`, cross-user isolation spot check, and `user_roles` service-role access verification.

---

## [v7.6.2] — 2026-05-17

### Daily report cron — route fix + dead code removal

#### Fixed
- **`api/routes/admin.js`** — `/admin/daily-report` was unreachable by automated cron: the JWT `authMiddleware` rejected cron requests before the route's own `CRON_SECRET` check ever ran. Stripped the dead cron auth logic. Endpoint is now admin-UI-preview-only — returns activity data, never sends email. Automated firing is handled exclusively by `/api/cron/daily-report` (in `cron.js`, mounted before `authMiddleware`).
- **`api/routes/admin.js`** — Removed dead `/admin/watchdog` endpoint. Same JWT-block issue; real watchdog lives at `/api/cron/watchdog`.

#### Action Required
- Update cron-job.org job to call `GET https://www.lumiereledger.com/api/cron/daily-report` with header `Authorization: Bearer <CRON_SECRET>`. The old `/api/admin/daily-report` URL never worked for automated firing.

---

## [v7.6.1] — 2026-05-17

### First-run onboarding modal + admin silent-refresh fix

#### Added
- **`web-react/src/App.jsx`** — `OnboardingModal` component and wiring in `AppContent`. Fires once for new users who have a subscription but no `business_name` or `gemini_api_key` configured. Dismissed via localStorage flag (`ll_onboarding_done_{userId}`). "GO TO SETUP →" navigates to Control Center Profile tab; "Skip for now" sets the flag and closes. Shows steps: add business name, add Gemini key, import first transactions.

#### Fixed
- **`web-react/src/pages/Backup.jsx`** — Silent refresh (`loadTabData(tab, true)`) now handles the `saas` tab. Previously, admin edits (e.g., changing a user's plan to Lifetime) would POST/PATCH successfully but the Subscriptions panel would never re-fetch, making changes appear ineffective until a manual refresh.

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
