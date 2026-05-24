# Lumière Ledger — Changelog

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

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
