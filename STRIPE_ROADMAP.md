# Lumière Ledger — Stripe & Monetization Roadmap

**Last updated:** 2026-05-18
**Status:** Ready to build — gate cleared
**Reference:** See `ROADMAP.md` for overall sprint context. Plaid billing spec in `PLAID_BILLING_SPEC.md`.

---

## Pricing Tiers

| Tier | Monthly | Annual (20% off) | Stripe Price IDs |
|------|---------|-----------------|-----------------|
| Free | $0 | — | *(no Stripe product)* |
| Core | $9 / mo | $86 / yr ($7.17/mo effective) | *(set after product creation)* |
| Studio | $19 / mo | $182 / yr ($15.17/mo effective) | *(set after product creation)* |

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
| `STRIPE_PRICE_CORE_MONTHLY` | Vercel + local `.env` | `price_xxx` — $9/mo |
| `STRIPE_PRICE_CORE_ANNUAL` | Vercel + local `.env` | `price_xxx` — $86/yr |
| `STRIPE_PRICE_STUDIO_MONTHLY` | Vercel + local `.env` | `price_xxx` — $19/mo |
| `STRIPE_PRICE_STUDIO_ANNUAL` | Vercel + local `.env` | `price_xxx` — $182/yr |
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

## Stripe Setup Checklist — Your Actions First

- [ ] Create Stripe account at stripe.com (business email)
- [ ] Complete business verification (EIN / SSN, bank account for payouts)
- [ ] Create Product: "Lumière Core"
  - [ ] Add Price: $9.00 / month recurring → copy `price_xxx` as `STRIPE_PRICE_CORE_MONTHLY`
  - [ ] Add Price: $86.00 / year recurring → copy `price_xxx` as `STRIPE_PRICE_CORE_ANNUAL`
- [ ] Create Product: "Lumière Studio"
  - [ ] Add Price: $19.00 / month recurring → copy `price_xxx` as `STRIPE_PRICE_STUDIO_MONTHLY`
  - [ ] Add Price: $182.00 / year recurring → copy `price_xxx` as `STRIPE_PRICE_STUDIO_ANNUAL`
- [ ] Register webhook: `https://www.lumiereledger.com/api/stripe/webhook`
- [ ] Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.upcoming`, `invoice.payment_succeeded`
- [ ] Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Copy publishable key → `VITE_STRIPE_PUBLISHABLE_KEY`
- [ ] Copy secret key → `STRIPE_SECRET_KEY`
- [ ] Set invoice finalization window to **3 days** (Stripe Dashboard → Billing → Invoice finalization) — required for Plaid line items
- [ ] Enable automatic invoice emails (Stripe Settings → Billing → Customer emails → Successful payments + Failed payments + Send finalized invoices)
- [ ] ✉️ Send me all four price IDs — then I build everything

---

## Post-Launch Monetization Roadmap

| Addition | Timing | Notes |
|----------|--------|-------|
| Stripe Customer Portal (self-serve cancel/upgrade) | Launch | In build plan |
| Annual discount banner | Launch | Show $ savings vs monthly |
| Trial period (7-day free Core) | 30 days post-launch | Drives conversion |
| Agency tier ($39/mo, 3 seats) | Phase 6 | When user base justifies it |
| Add-on billing (client portal, e-sign) | Phase 6 | Per-add-on Stripe recurring |
