# Lumière Ledger — Stripe & Monetization Roadmap

**Last updated:** 2026-05-18  
**Status:** Ready to build — gate cleared  
**Reference:** See `ROADMAP.md` for overall sprint context.

---

## Pricing Model

| Tier | Price | Stripe Price ID |
|------|-------|----------------|
| Lumière Studio — Monthly | $19 / month | *(set after Stripe product creation)* |
| Lumière Studio — Annual | $180 / year ($15/mo effective) | *(set after Stripe product creation)* |

**Legacy plans — grandfather as Studio-level access forever:**
- `free_beta` → full Studio access
- `lifetime` → full Studio access, no expiration

**Free tier** (`plan_type = 'free'`) — new default for users who sign up without a code post-launch.

---

## Free vs. Studio Feature Split

| Feature | Free | Studio |
|---------|------|--------|
| Manual transaction entry | ✅ Up to 50/month | ✅ Unlimited |
| Basic dashboard (30-day view) | ✅ | ✅ Full + forecasting |
| Invoices | ✅ 3/month + LL watermark | ✅ Unlimited, no watermark |
| Expense categories + CSV export | ✅ | ✅ |
| Mileage log (manual entry) | ✅ | ✅ |
| Bank CSV import + dedup engine | ❌ | ✅ |
| Automation / classification rules | ❌ | ✅ |
| Schedule C / tax export | ❌ | ✅ |
| Equipment / asset tracking | ❌ | ✅ |
| AI Brain (BYOB Gemini key) | ❌ | ✅ |
| Receipt scanning (Gemini Vision) | ❌ | ✅ |
| Google Maps mileage automation | ❌ | ✅ |
| Full CRM pipeline | ❌ | ✅ |
| Accounts page + spending analytics | ❌ | ✅ |
| Plaid live bank sync (future) | ❌ | ✅ |
| Client portal / e-sign (future) | ❌ | ✅ |

**Natural upgrade triggers:**
- Hit 50-transaction cap → wall appears mid-month
- 4th invoice attempt → gate fires
- Open AI Brain or Receipt Scanner → upgrade prompt

---

## Schema Migration

```sql
-- Idempotent — safe to run multiple times
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT;

-- plan_type values after migration:
--   free             → Free tier (new default post-launch)
--   free_beta        → Legacy beta → Studio access
--   lifetime         → Lifetime → Studio access
--   studio_monthly   → Paid monthly
--   studio_annual    → Paid annual
```

---

## Backend — New File: `api/routes/stripe.js`

Mount order in `server.js`:
- `POST /stripe/webhook` → **before `authMiddleware`** (uses Stripe signature, not JWT)
- All other `/stripe/*` routes → after `authMiddleware`

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe/create-checkout` | JWT | Creates Stripe Checkout session, returns `{ url }` |
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
| `checkout.session.completed` | Write `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` to `user_subscriptions`. Set `plan_type = studio_monthly` or `studio_annual`. Set `expires_at = null` (Stripe manages renewal). |
| `customer.subscription.updated` | Update `plan_type` and `stripe_price_id` on plan change or renewal. |
| `customer.subscription.deleted` | Set `plan_type = 'free'`, clear Stripe fields. |
| `invoice.payment_failed` | Log warning. Send payment-failed email via `queueHealthAlertEmail`. |

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

### AuthContext Changes
- Derive `tier` from `subscription.plan_type`:
  ```js
  const tier = ['studio_monthly','studio_annual','free_beta','lifetime'].includes(plan_type)
    ? 'studio' : 'free';
  ```
- Export `tier` alongside `subscription`.

### New Component: `<UpgradeGate>`
```jsx
// Wraps any premium feature
// Shows feature content to Studio users
// Shows upgrade prompt to Free users
<UpgradeGate feature="bank_import">
  <ImportPage />
</UpgradeGate>
```

Props: `feature` (string for analytics), `children`.  
Reads `tier` from `useAuth()`. If `'free'` → renders upgrade card instead of children.

### Upgrade Prompt Card
- Feature name + one-line value prop
- Monthly / Annual toggle
- "Upgrade to Studio — $19/mo" CTA → calls `POST /api/stripe/create-checkout`
- "Already subscribed?" link for edge cases

### Gates to Wire (UI)
| Route / Component | Gate |
|---|---|
| `Import.jsx` | Bank CSV import |
| `AssistantSidebar.jsx` | AI Brain |
| `TransactionDrawer.jsx` | Receipt scanner |
| `CRM.jsx` | Full pipeline (> basic lead list) |
| `Tax.jsx` | Schedule C export |
| `AutomationTab.jsx` | Classification rules |
| `Assets.jsx` | Equipment tracking |
| `Accounts.jsx` (future) | Accounts page |
| Invoice > 3 in `CRM/Invoices` | Invoice limit |

### Billing Management (Control Center)
Add to `ProfileTab.jsx`:
- Current plan badge (Free / Studio Monthly / Studio Annual / Lifetime)
- "Manage Billing" button → calls `POST /api/stripe/portal` → redirect
- If `free`: shows upgrade CTA inline

---

## Required Env Vars

| Var | Where | Notes |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | Vercel + local `.env` | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Vercel + local `.env` | From Stripe dashboard → Webhooks |
| `STRIPE_PRICE_MONTHLY` | Vercel + local `.env` | `price_xxx` from Stripe product |
| `STRIPE_PRICE_ANNUAL` | Vercel + local `.env` | `price_xxx` from Stripe product |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Vercel + local `.env` | `pk_live_xxx` — frontend only |

---

## Build Order

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 1 | Stripe account + product setup (you) | Stripe dashboard | 20 min |
| 2 | Add env vars to Vercel + local .env | Vercel dashboard | 5 min |
| 3 | Schema migration | Supabase SQL Editor | 5 min |
| 4 | `api/routes/stripe.js` — all 4 routes | New file | 1–2 hrs |
| 5 | Mount webhook before authMiddleware in `server.js` | `api/server.js` | 5 min |
| 6 | Licensing middleware — add `free` tier, `upgrade_required` 403 | `api/middleware/licensing.js` | 30 min |
| 7 | `AuthContext.jsx` — derive + export `tier` | `web-react/src/components/AuthContext.jsx` | 20 min |
| 8 | `UpgradeGate.jsx` component | New component | 1 hr |
| 9 | Wire gates on 8 routes/components | Various | 2 hrs |
| 10 | ProfileTab billing section | `ProfileTab.jsx` | 30 min |
| 11 | Invoice limit (3) + watermark on free tier | `invoices.js` + PDF generator | 1 hr |
| 12 | Transaction limit (50/month) on free tier | `expenses.js` | 30 min |
| 13 | Stripe webhook live test (Stripe CLI) | Local | 30 min |
| 14 | End-to-end test: checkout → webhook → gate drops | Production | 30 min |

**Total estimate:** 1 focused day of build.

---

## Stripe Setup Checklist (Your Actions First)

- [ ] Create Stripe account at stripe.com (use business email)
- [ ] Complete business verification (EIN / SSN, bank account for payouts)
- [ ] Create Product: "Lumière Studio"
- [ ] Add Price 1: $19.00 / month (recurring)
- [ ] Add Price 2: $180.00 / year (recurring)
- [ ] Copy both `price_xxx` IDs → add to Vercel env vars
- [ ] Register webhook endpoint: `https://www.lumiereledger.com/api/stripe/webhook`
- [ ] Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy webhook signing secret → add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
- [ ] Copy publishable key → add as `VITE_STRIPE_PUBLISHABLE_KEY`
- [ ] Copy secret key → add as `STRIPE_SECRET_KEY`
- [ ] ✉️ Tell me the two price IDs — then I build everything

---

## Post-Launch Monetization Roadmap

| Addition | Timing | Notes |
|----------|--------|-------|
| Stripe Customer Portal (self-serve cancel/upgrade) | Launch | Already in build plan |
| Annual discount banner | Launch | Show savings vs monthly |
| Trial period (7-day free Studio) | 30 days post-launch | Drives conversion, increases initial churn risk |
| Team / agency tier ($49/mo, 3 users) | Phase 6 | When user base justifies it |
| Add-on billing (client portal, e-sign) | Phase 6 | Per-add-on Stripe recurring |
