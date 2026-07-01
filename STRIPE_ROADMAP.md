# Lumière Ledger — Stripe & Monetization Roadmap

**Last updated:** 2026-07-01
**Status:** ✅ Live in production — full checkout → webhook → tier-gate flow confirmed working end-to-end via a real test transaction + refund (Joshua, 2026-07-01)
**Reference:** See `ROADMAP.md` for overall sprint context. Plaid billing spec in `PLAID_BILLING_SPEC.md`.

---

## Pricing Tiers

| Tier | Monthly | Annual (20% off) | Stripe Price IDs |
|------|---------|-----------------|-----------------|
| Free | $0 | — | *(no Stripe product)* |
| Sync | $4.99 / mo | $49.99 / yr | Plaid-only flat plan, added post-launch — see `PLAID_BILLING_SPEC.md` |
| Core | $9 / mo | $86 / yr ($7.17/mo effective) | `price_1TYZtXCXjNrpxtAHB3ZL5DlF` (monthly) / `price_1TYZvPCXjNrpxtAHaFtBiyno` (annual) |
| Studio | $19 / mo | $182 / yr ($15.17/mo effective) | `price_1TYZvpCXjNrpxtAHdNTzia9o` (monthly) / `price_1TYZw2CXjNrpxtAHwAiJ3hEy` (annual) |

**Grandfathered members (beta/pro key holders):**
- `free_beta` → Free tier forever, no charge except Plaid usage fees
- `lifetime` → Free tier forever, no charge except Plaid usage fees

**Plaid live bank sync:** Available on all tiers. Usage fees apply regardless of plan — see `PLAID_BILLING_SPEC.md`.

---

## Feature Gate Matrix

### Transactions & Ledger

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Upload bank statements (CSV) | ✅ | ✅ | ✅ |
| Manual transactions | ✅ | ✅ | ✅ |
| Duplicate detection | ✅ | ✅ | ✅ |
| Transaction limit | 500 / mo | 2,000 / mo | Unlimited |
| Receipt scanner (AI Vision) | ❌ | ✅ | ✅ |
| Live bank sync (Plaid) | + usage fee | + usage fee | + usage fee |

### Automation & AI

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Auto-categorization rules | 5 rules | 25 rules | Unlimited |
| AI Brain (BYOB Gemini key) | ❌ | ✅ | ✅ |
| Batch AI categorization | ❌ | ❌ | ✅ |

### Invoicing & CRM

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| CRM — leads & pipeline | 10 leads | Unlimited | Unlimited |
| Invoice PDF + e-sign | 3 / mo | 20 / mo | Unlimited |
| Client intake portal | ❌ | ✅ | ✅ |

### Tax & Reporting

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Tax deductible tagging | ✅ | ✅ | ✅ |
| Executive dashboard | ❌ | ✅ | ✅ |
| CSV data export | ✅ | ✅ | ✅ |
| Master archive (.json) | ❌ | ✅ | ✅ |
| Mileage tracking (Google Maps) | ❌ | ❌ | ✅ |

### Equipment & Assets

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Equipment log (Section 179) | 5 items | Unlimited | Unlimited |

### Support & Data

| Feature | Free | Core | Studio |
|---------|------|------|--------|
| Data isolation (RLS) | ✅ | ✅ | ✅ |
| Email support | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

---

## Natural Upgrade Triggers

| Gate | Free hits wall | Free → Core | Core → Studio |
|------|---------------|-------------|---------------|
| Transaction limit | 500/mo cap mid-month | Core unlocks 2,000/mo | Studio unlocks unlimited |
| Invoice attempt | 4th invoice blocked | Core unlocks 20/mo | Studio unlocks unlimited |
| AI Brain open | Upgrade prompt | Core unlocks Brain | — |
| Receipt scanner | Upgrade prompt | Core unlocks | — |
| Automation rules | Blocked at 5 | Core unlocks 25 | Studio unlocks unlimited |
| Mileage (Maps) | Blocked | Blocked | Studio unlocks |
| Batch categorization | Blocked | Blocked | Studio unlocks |

---

## Schema Migration

```sql
-- Idempotent — safe to run multiple times
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT,
  ADD COLUMN IF NOT EXISTS admin_tier              TEXT DEFAULT NULL;

-- admin_tier: NULL (use plan_type) | 'core' | 'studio'
-- When set, overrides the tier derived from plan_type — no billing impact.
-- Friends/family override: UPDATE user_subscriptions SET admin_tier = 'studio' WHERE user_id = '<uuid>';
-- Remove override:         UPDATE user_subscriptions SET admin_tier = NULL   WHERE user_id = '<uuid>';

-- plan_type values after migration:
--   free             → Free tier (new default post-launch)
--   free_beta        → Grandfathered beta → Free tier access forever
--   lifetime         → Grandfathered lifetime → Free tier access forever
--   core_monthly     → Core, billed monthly ($9/mo)
--   core_annual      → Core, billed annually ($86/yr)
--   studio_monthly   → Studio, billed monthly ($19/mo)
--   studio_annual    → Studio, billed annually ($182/yr)
```

---

## Backend — `api/routes/stripe.js`

Mount order in `server.js`:
- `POST /stripe/webhook` → **before `authMiddleware`** (Stripe signature, not JWT)
- All other `/stripe/*` routes → after `authMiddleware`

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe/create-checkout` | JWT | Creates Checkout session, returns `{ url }` |
| POST | `/stripe/portal` | JWT | Creates Customer Portal session, returns `{ url }` |
| POST | `/stripe/webhook` | Stripe-sig | Handles all Stripe events |
| GET | `/stripe/status` | JWT | Returns `{ tier, plan_type, stripe_customer_id }` |

### Checkout Session Config
```js
stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: req.user.email,
  line_items: [{ price: req.body.price_id, quantity: 1 }],
  success_url: 'https://www.lumiereledger.com/StudioControlCenter?tab=profile&upgrade=success',
  cancel_url:  'https://www.lumiereledger.com/StudioControlCenter?tab=profile&upgrade=cancelled',
  metadata: { user_id: req.user.id },
  subscription_data: { metadata: { user_id: req.user.id } }
})
```

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Write `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`. Set `plan_type` to `core_monthly`, `core_annual`, `studio_monthly`, or `studio_annual` based on `price_id`. Set `expires_at = null`. |
| `customer.subscription.updated` | Update `plan_type` and `stripe_price_id` on plan change or renewal. |
| `customer.subscription.deleted` | Set `plan_type = 'free'`, clear Stripe fields. |
| `invoice.payment_failed` | Log warning. Send payment-failed email via `queueHealthAlertEmail`. |
| `invoice.upcoming` | Trigger Plaid account count + attach extra line items. See `PLAID_BILLING_SPEC.md`. |
| `invoice.payment_succeeded` | Confirm subscription active in `user_subscriptions`. |

### Webhook Signature Verification
```js
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
```
Requires `express.raw({ type: 'application/json' })` on the webhook route — NOT `express.json()`.

---

## Frontend

### New env var
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### AuthContext — Tier Derivation
```js
function deriveTier(plan_type) {
  if (['studio_monthly', 'studio_annual'].includes(plan_type)) return 'studio';
  if (['core_monthly', 'core_annual'].includes(plan_type)) return 'core';
  return 'free'; // free, free_beta, lifetime all map to 'free'
}
// Export: tier = 'free' | 'core' | 'studio'
```

### `<UpgradeGate>` Component
```jsx
// minTier: 'core' | 'studio'
// Renders children if user meets or exceeds minTier
// Renders upgrade card otherwise
<UpgradeGate minTier="core" feature="bank_import">
  <ImportPage />
</UpgradeGate>

// Tier rank: free=0, core=1, studio=2
const TIER_RANK = { free: 0, core: 1, studio: 2 };
const hasAccess = TIER_RANK[tier] >= TIER_RANK[minTier];
```

### Gates to Wire

| Route / Component | Min Tier | Limit |
|---|---|---|
| `Import.jsx` | free | CSV always allowed; Plaid → usage fee modal |
| `AssistantSidebar.jsx` | core | AI Brain |
| `TransactionDrawer.jsx` — receipt scanner | core | Receipt scanner |
| `AutomationTab.jsx` | free | Cap at 5 rules; core cap 25; studio unlimited |
| `CRM.jsx` | free | Cap at 10 leads; core+ unlimited |
| `Invoices` — creation | free | Cap at 3/mo; core cap 20; studio unlimited |
| `Tax.jsx` | core | Executive dashboard + archive |
| `Assets.jsx` | free | Cap at 5 items; core+ unlimited |
| `Mileage` (Maps) | studio | Google Maps automation |
| Batch categorization | studio | Bulk AI run |

### Upgrade Prompt Card
- Feature name + one-line value prop
- Toggle: Monthly / Annual (show savings)
- CTA: "Upgrade to Core — $9/mo" or "Upgrade to Studio — $19/mo" based on current tier
- Calls `POST /api/stripe/create-checkout` with appropriate `price_id`

### Billing Section in ProfileTab
- Current plan badge: Free / Core Monthly / Core Annual / Studio Monthly / Studio Annual / Lifetime
- "Manage Billing" → `POST /api/stripe/portal` → redirect (hidden for free/lifetime/free_beta)
- Upgrade CTA inline for Free users

---

## Required Env Vars

| Var | Where | Notes |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | Vercel + local `.env` | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Vercel + local `.env` | From Stripe dashboard → Webhooks |
| `STRIPE_PRICE_CORE_MONTHLY` | Vercel + local `.env` | `price_1TYZtXCXjNrpxtAHB3ZL5DlF` — $9/mo ✅ |
| `STRIPE_PRICE_CORE_ANNUAL` | Vercel + local `.env` | `price_1TYZvPCXjNrpxtAHaFtBiyno` — $86/yr ✅ |
| `STRIPE_PRICE_STUDIO_MONTHLY` | Vercel + local `.env` | `price_1TYZvpCXjNrpxtAHdNTzia9o` — $19/mo ✅ |
| `STRIPE_PRICE_STUDIO_ANNUAL` | Vercel + local `.env` | `price_1TYZw2CXjNrpxtAHwAiJ3hEy` — $182/yr ✅ |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Vercel + local `.env` | `pk_live_xxx` — frontend only |

---

## Build Order

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 1 | Stripe account + product setup (you) | Stripe dashboard | 20 min |
| 2 | Add env vars to Vercel + local .env | Vercel dashboard | 5 min |
| 3 | Schema migration | Supabase SQL Editor | 5 min |
| 4 | `api/routes/stripe.js` — all routes + webhook handler | New file | 2 hrs |
| 5 | Mount webhook before authMiddleware in `server.js` | `api/server.js` | 5 min |
| 6 | Licensing middleware — enforce tier limits (transactions, invoices, rules, leads, equipment) | `api/middleware/licensing.js` | 1 hr |
| 7 | `AuthContext.jsx` — `deriveTier()` + export `tier` | `AuthContext.jsx` | 20 min |
| 8 | `UpgradeGate.jsx` component | New component | 1 hr |
| 9 | Wire gates per table above | Various | 2 hrs |
| 10 | ProfileTab billing section | `ProfileTab.jsx` | 30 min |
| 11 | Invoice limit enforcement + PDF watermark on Free | `invoices.js` + PDF generator | 1 hr |
| 12 | Stripe webhook live test (Stripe CLI) | Local | 30 min |
| 13 | End-to-end: checkout → webhook → gate drops | Production | 30 min |

**Total estimate:** 1–1.5 focused days.

Then build Plaid billing on top (P1–P10 in `PLAID_BILLING_SPEC.md`, ~4 hrs additional).

---

## Stripe Setup Checklist

### Stripe Dashboard Actions (Joshua)
- [x] Create Stripe account at stripe.com (business email) — confirmed live, processing real payments
- [x] Complete business verification (EIN / SSN, bank account for payouts) — confirmed, real transaction + refund processed 2026-07-01
- [x] Create Product: "Lumière Core"
  - [x] $9.00 / month → `price_1TYZtXCXjNrpxtAHB3ZL5DlF` → `STRIPE_PRICE_CORE_MONTHLY`
  - [x] $86.00 / year → `price_1TYZvPCXjNrpxtAHaFtBiyno` → `STRIPE_PRICE_CORE_ANNUAL`
- [x] Create Product: "Lumière Studio"
  - [x] $19.00 / month → `price_1TYZvpCXjNrpxtAHdNTzia9o` → `STRIPE_PRICE_STUDIO_MONTHLY`
  - [x] $182.00 / year → `price_1TYZw2CXjNrpxtAHwAiJ3hEy` → `STRIPE_PRICE_STUDIO_ANNUAL`
- [x] Register webhook: `https://www.lumiereledger.com/api/stripe/webhook` — Active 2026-05-18
- [x] Select all 6 events — confirmed 2026-05-18
- [x] Publishable key confirmed — 2026-05-18
- [x] Secret key confirmed — 2026-05-18
- [x] ✉️ Price IDs confirmed — locked 2026-05-18
- [x] **Reveal webhook signing secret** → confirmed set in Vercel as `STRIPE_WEBHOOK_SECRET` (webhook destination `we_1TYaFNCXjNrpxtAHGhHLMQPo` live, listening to 6 events, signature verification passing — webhook wouldn't function at all otherwise)
- [ ] Set invoice finalization window to **3 days** (Stripe Dashboard → Billing → Invoice finalization) — not verified, check next Stripe dashboard visit
- [ ] Enable automatic invoice emails (Stripe Settings → Billing → Customer emails → Successful payments + Failed payments + Send finalized invoices) — not verified, check next Stripe dashboard visit

### Vercel Env Vars (Joshua)
- [x] `STRIPE_SECRET_KEY` — confirmed set, live checkout works
- [x] `STRIPE_WEBHOOK_SECRET` — confirmed set, webhook signature verification passing
- [x] `STRIPE_PRICE_CORE_MONTHLY` = `price_1TYZtXCXjNrpxtAHB3ZL5DlF`
- [x] `STRIPE_PRICE_CORE_ANNUAL` = `price_1TYZvPCXjNrpxtAHaFtBiyno`
- [x] `STRIPE_PRICE_STUDIO_MONTHLY` = `price_1TYZvpCXjNrpxtAHdNTzia9o`
- [x] `STRIPE_PRICE_STUDIO_ANNUAL` = `price_1TYZw2CXjNrpxtAHwAiJ3hEy`
- [x] `VITE_STRIPE_PUBLISHABLE_KEY` — confirmed set, checkout redirect works
- [x] `VITE_STRIPE_PRICE_CORE_MONTHLY` = `price_1TYZtXCXjNrpxtAHB3ZL5DlF`
- [x] `VITE_STRIPE_PRICE_CORE_ANNUAL` = `price_1TYZvPCXjNrpxtAHaFtBiyno`
- [x] `VITE_STRIPE_PRICE_STUDIO_MONTHLY` = `price_1TYZvpCXjNrpxtAHdNTzia9o`
- [x] `VITE_STRIPE_PRICE_STUDIO_ANNUAL` = `price_1TYZw2CXjNrpxtAHwAiJ3hEy`

### Supabase Migration (Joshua — run in SQL Editor)
- [x] Confirmed live — `user_subscriptions` has `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `admin_tier`, `current_period_end`
  ```sql
  ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
    ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT,
    ADD COLUMN IF NOT EXISTS admin_tier              TEXT DEFAULT NULL;
  ```

### Code — Done
- [x] `api/routes/stripe.js` — routes + webhook + Plaid overage billing (v7.6.5)
- [x] `api/server.js` — webhook before authMiddleware, stripeRouter after (v7.6.5)
- [x] `api/middleware/licensing.js` — `deriveTier()`, `TIER_LIMITS`, admin_tier override (v7.6.5)
- [x] `web-react/src/components/AuthContext.jsx` — `tier` derived + exported (v7.6.5)
- [x] `web-react/src/components/UpgradeGate.jsx` — upgrade gate component (v7.6.5)
- [x] `api/package.json` — `stripe` dependency added (v7.6.5a)
- [x] Lazy Stripe init — server no longer crashes when `STRIPE_SECRET_KEY` is absent (v7.6.5a)

### Code — Remaining
- [x] Route-level limit enforcement — confirmed `req.tierLimits` used in `expenses.js`, `invoices.js`, `rules.js`, `leads.js`, `assets.js`
- [x] ProfileTab billing section — plan badge, "Manage Billing" → `/stripe/portal`, upgrade CTAs for Sync/Core/Studio all present in `ProfileTab.jsx`
- [x] End-to-end test — checkout → webhook fires → `plan_type` updates → gate drops. Confirmed by Joshua with a real test transaction + refund, 2026-07-01.

---

## Post-Launch Monetization Roadmap

| Addition | Timing | Notes |
|----------|--------|-------|
| Stripe Customer Portal (self-serve cancel/upgrade) | Launch | ✅ Live — `POST /stripe/portal`, "Manage Billing" button in ProfileTab |
| Annual discount banner | Launch | Show $ savings vs monthly — not yet confirmed built, check ProfileTab pricing cards |
| Trial period (7-day free Core) | 30 days post-launch | Drives conversion |
| Agency tier ($39/mo, 3 seats) | Phase 6 | When user base justifies it |
| Add-on billing (client portal, e-sign) | Phase 6 | Per-add-on Stripe recurring |
