# Lumière Ledger — Plaid Usage Billing Specification

**Last updated:** 2026-05-18  
**Status:** Design complete — pending Stripe build  
**Depends on:** `STRIPE_ROADMAP.md` (Stripe must be built first)  
**Referenced by:** `ROADMAP.md` → Next Sprint

---

## The Core Question: Can the System Count Connected Plaid Accounts?

**Yes — and it already has the data.** Every time a user connects a bank via Plaid Link,
the server calls Plaid's `/accounts/get` endpoint. That response returns every account
at that institution (checking, savings, each credit card = separate accounts). These are
stored in a `plaid_accounts` table in Supabase, scoped by `user_id`. A simple
`COUNT(*)` query gives the exact number of active connected accounts per user at any time.

When a user adds a new institution, the count goes up. When they remove one, the count
goes down. The billing cycle reads this count at charge time. No manual tracking required.

---

## Pricing Model

Plaid live bank sync is available on **all tiers** (Free, Core, Studio). The platform
subscription fee is separate from Plaid usage. Users without Plaid connections pay
no usage fees regardless of tier.

### Platform tiers (locked 2026-05-18 — see STRIPE_ROADMAP.md)

| Tier | Monthly | Annual |
|------|---------|--------|
| Free | $0 | — |
| Core | $9.00 / mo | $86.00 / yr |
| Studio | $19.00 / mo | $182.00 / yr |

### Plaid usage fees (additive on top of platform tier, all tiers)

| Line Item | Rate | Notes |
|-----------|------|-------|
| Plaid accounts — first 7 | Included | Checking, savings, 4 credit cards, business |
| Additional Plaid accounts | $1.00 each above 7 | Calculated at billing time |
| Stripe processing fee | 2.9% + $0.30 | Applied to Plaid overage subtotal, passed to customer |

**Grandfathered Free members** (beta/pro key holders) pay only Plaid usage fees — no
platform subscription. If they have 7 or fewer accounts, they pay $0 — Plaid is entirely
free for them. Overage charges only trigger at 8+ connected accounts.

**Plaid cost to you:** $0.30/account/month. The base 7 accounts cost $2.10/mo — treated
as a customer acquisition cost. Each additional account costs $0.30, you charge $1.00 —
$0.70 margin per extra account.

---

## What a Customer Invoice Looks Like

Stripe sends this automatically by email after every successful charge.

Studio user example (10 Plaid accounts):
```
LUMIÈRE LEDGER
Invoice #LL-2026-0847
Billing period: June 1 – June 30, 2026
Customer: Jane Photographer <jane@example.com>

─────────────────────────────────────────────────────────
LINE ITEM                                          AMOUNT
─────────────────────────────────────────────────────────
Lumière Studio — Monthly Subscription              $19.00

Additional Plaid accounts (3 × $1.00)               $3.00
  Connected: Chase Checking, Chase Savings,
  BofA Checking, BofA Savings, Amex Gold,
  Venture X, Delta SkyMiles, Capital One,
  WF Savings, WF Business             (10 total)
  Includes 7 — 3 additional billed

                                        Subtotal:   $3.00
Stripe processing fee (2.9% + $0.30)                $0.39
─────────────────────────────────────────────────────────
                               PLAID USAGE TOTAL:   $3.39
─────────────────────────────────────────────────────────

Payment method: Visa ending in 4242
Payment status: PAID
```

Free-tier member example (10 Plaid accounts — no platform fee):
```
LUMIÈRE LEDGER
Invoice #LL-2026-0848
Billing period: June 1 – June 30, 2026
Customer: Beta Member <beta@example.com>

─────────────────────────────────────────────────────────
LINE ITEM                                          AMOUNT
─────────────────────────────────────────────────────────
Lumière Free — Grandfathered membership            $0.00

Additional Plaid accounts (3 × $1.00)               $3.00
  10 connected, 7 included, 3 billed

                                        Subtotal:   $3.00
Stripe processing fee (2.9% + $0.30)                $0.39
─────────────────────────────────────────────────────────
                               PLAID USAGE TOTAL:   $3.39
─────────────────────────────────────────────────────────

Payment method: Visa ending in 4242
Payment status: PAID
```

---

## How the Billing Cycle Works End-to-End

### Monthly charge sequence

```
1. Stripe triggers upcoming invoice (~1 day before renewal)
   └─ Fires webhook: invoice.upcoming

2. Your API receives the webhook
   └─ Queries plaid_accounts table: SELECT COUNT(*) WHERE user_id = X AND active = true
   └─ Calculates extras = MAX(0, count - 7)
   └─ Calculates subtotal = 19.00 + (extras × 1.00)
   └─ Calculates stripe_fee = (subtotal × 0.029) + 0.30  [rounded to nearest cent]

3. API creates Stripe Invoice Items (attached to the upcoming invoice)
   └─ stripe.invoiceItems.create({ customer, amount: extras * 100, description: ... })
   └─ stripe.invoiceItems.create({ customer, amount: stripe_fee_cents, description: ... })

4. Stripe finalizes and charges the invoice
   └─ Fires webhook: invoice.payment_succeeded

5. API receives payment_succeeded webhook
   └─ Confirms subscription stays active in user_subscriptions
   └─ Stripe automatically emails the PDF invoice to the customer

6. If payment fails:
   └─ Stripe retries 3× over 7 days
   └─ Fires invoice.payment_failed after each attempt
   └─ API sends payment-failed email via existing queueHealthAlertEmail
   └─ After final failure: customer.subscription.deleted fires
   └─ API sets plan_type = 'free' — Plaid access suspended, tokens preserved
```

### Annual charge sequence

Same flow, but `invoice.upcoming` fires once per year. The Plaid account count is
snapshotted at the time of the annual renewal — not averaged across the year.
This means annual customers are incentivized to connect accounts at the START of
their year (they get the full year of access at the count they locked in at renewal).

**Design decision required:** Do you want annual customers to pay for added accounts
mid-year, or only true-up at renewal? Recommendation: mid-year additions trigger a
prorated charge immediately. Removals credit at renewal only (simplifies accounting).

---

## Database Schema Additions

Run in Supabase SQL Editor. Idempotent — safe to re-run.

```sql
-- Track every Plaid-connected account per user
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id   TEXT NOT NULL,           -- Plaid's item_id for the institution
  account_id      TEXT NOT NULL,           -- Plaid's account_id (unique per account)
  account_name    TEXT,                    -- e.g. "Chase Total Checking"
  account_type    TEXT,                    -- depository, credit, investment, etc.
  account_subtype TEXT,                    -- checking, savings, credit card, etc.
  mask            TEXT,                    -- last 4 digits
  active          BOOLEAN DEFAULT true,
  connected_at    TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plaid_accounts_user_id_idx ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS plaid_accounts_active_idx  ON plaid_accounts(user_id, active);

-- RLS
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users access own plaid accounts"
  ON plaid_accounts FOR ALL USING (user_id = auth.uid());

-- Add invoice tracking to user_subscriptions
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS plaid_account_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_plaid_sync        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_fee_pass_through BOOLEAN DEFAULT true;
```

---

## Backend Changes

### 1. `api/routes/plaid.js` — populate plaid_accounts on connect

When a user successfully links a bank via Plaid Link, after exchanging the public token,
immediately call `/accounts/get` and upsert all returned accounts into `plaid_accounts`.

```js
// After access_token exchange
const accountsResponse = await plaidClient.accountsGet({ access_token });
const accounts = accountsResponse.data.accounts;

// Upsert each account
for (const acct of accounts) {
  await supabase.from('plaid_accounts').upsert({
    user_id:         req.user.id,
    plaid_item_id:   itemId,
    account_id:      acct.account_id,
    account_name:    acct.name,
    account_type:    acct.type,
    account_subtype: acct.subtype,
    mask:            acct.mask,
    active:          true,
    updated_at:      new Date().toISOString()
  }, { onConflict: 'account_id' });
}
```

On item removal (user disconnects a bank), set `active = false` and `disconnected_at = NOW()`
for all accounts with that `plaid_item_id`.

### 2. `api/routes/stripe.js` — new helper: `buildPlaidInvoiceItems()`

```js
async function buildPlaidInvoiceItems(userId, stripeCustomerId) {
  // Count active connected accounts
  const { count } = await supabase
    .from('plaid_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true);

  const baseIncludes = 7;
  const extras = Math.max(0, count - baseIncludes);
  const baseCents = 1900;                                  // $19.00
  const extrasCents = extras * 100;                        // $1.00 each
  const subtotalCents = baseCents + extrasCents;
  const stripeFeeCents = Math.round((subtotalCents * 0.029) + 30); // 2.9% + $0.30

  const items = [];

  if (extras > 0) {
    items.push(await stripe.invoiceItems.create({
      customer:    stripeCustomerId,
      amount:      extrasCents,
      currency:    'usd',
      description: `Additional Plaid accounts (${extras} × $1.00) — ${count} total connected`,
    }));
  }

  items.push(await stripe.invoiceItems.create({
    customer:    stripeCustomerId,
    amount:      stripeFeeCents,
    currency:    'usd',
    description: `Stripe processing fee (2.9% + $0.30 on $${(subtotalCents / 100).toFixed(2)})`,
  }));

  return { count, extras, subtotalCents, stripeFeeCents };
}
```

### 3. `api/routes/stripe.js` — add `invoice.upcoming` to webhook handler

```js
case 'invoice.upcoming': {
  const invoice = event.data.object;
  const customerId = invoice.customer;

  // Look up user by stripe_customer_id
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (sub && sub.user_id) {
    await buildPlaidInvoiceItems(sub.user_id, customerId);
  }
  break;
}
```

### 4. Stripe webhook — add `invoice.upcoming` to registered events

Add in Stripe Dashboard → Webhooks → select events:
- `invoice.upcoming` ← new
- `invoice.payment_succeeded` ← new (for confirming subscription active)
- Keep existing: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`

### 5. Stripe Dashboard — enable automatic invoice emails

Stripe Settings → Billing → Customer emails → check:
- ✅ Successful payments
- ✅ Failed payments  
- ✅ Send finalized invoices

This is a one-time toggle. Zero code required.

---

## New API Route: `GET /api/plaid/account-summary`

Returns the current connected account count and billing preview for display in the app.

```js
// Response
{
  "connected_accounts": 10,
  "base_included": 7,
  "extra_accounts": 3,
  "extra_charge": 3.00,
  "estimated_monthly_total": 22.94,
  "accounts": [
    { "name": "Chase Total Checking", "type": "depository", "subtype": "checking", "mask": "4242" },
    ...
  ]
}
```

Show this in the Integrations tab so users can see exactly what they'll be charged
before their next billing cycle.

---

## Frontend — Integrations Tab Addition

In `IntegrationTab.jsx` (or `PlaidLink.jsx`), add a billing summary card:

```
CONNECTED BANK ACCOUNTS                              10 accounts

Chase Total Checking ••4242          Checking
Chase Savings ••8810                 Savings
Amex Gold ••1005                     Credit Card
...

Your next invoice:
  Studio subscription (7 accounts included)     $19.00
  Additional accounts (3 × $1.00)                $3.00
  Processing fee                                  $0.94
                                    Estimated:   $22.94

[Disconnect account]
```

This gives users full transparency before they're charged. Reduces disputes.

---

## Hands-On Work Required From You

### One-time setup (your actions, ~30 min total)
- [ ] In Stripe Dashboard → Billing → Customer emails: enable invoice delivery (toggle, 2 clicks)
- [ ] Register `invoice.upcoming` and `invoice.payment_succeeded` as additional webhook events
- [ ] Confirm Stripe account is set to send PDF invoices (Stripe does this by default)

### Ongoing (after launch)
| Scenario | Your involvement |
|----------|-----------------|
| Normal monthly charge | Zero — fully automated |
| Customer adds accounts mid-month | Zero — billed at next cycle |
| Customer disputes a charge | You respond in Stripe dashboard with invoice as evidence |
| Customer asks "why am I charged X?" | Point them to the invoice Stripe emailed them — it's itemized |
| Plaid bills you | Pay Plaid's monthly invoice — single aggregate charge |
| Customer wants refund | Issue partial/full refund in Stripe dashboard (2 clicks) |

**Realistically: 0–2 manual interventions per month once running.**

---

## Build Order — Addition to STRIPE_ROADMAP.md Steps

These steps slot in after the base Stripe build is complete (after Step 14 in `STRIPE_ROADMAP.md`):

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| P1 | Schema migration — `plaid_accounts` table | Supabase SQL Editor | 5 min |
| P2 | Populate `plaid_accounts` on Plaid token exchange | `api/routes/plaid.js` | 30 min |
| P3 | Mark accounts inactive on item removal | `api/routes/plaid.js` | 15 min |
| P4 | `buildPlaidInvoiceItems()` helper | `api/routes/stripe.js` | 45 min |
| P5 | `invoice.upcoming` webhook handler | `api/routes/stripe.js` | 30 min |
| P6 | Register new webhook events in Stripe Dashboard | Stripe dashboard | 5 min |
| P7 | Enable automatic invoice emails in Stripe | Stripe dashboard | 5 min |
| P8 | `GET /api/plaid/account-summary` route | `api/routes/plaid.js` | 20 min |
| P9 | Billing preview card in Integrations tab | `IntegrationTab.jsx` | 45 min |
| P10 | End-to-end test: connect 10 accounts → invoice preview → charge → verify line items | Local + Stripe CLI | 45 min |

**Total additional estimate:** ~4 hours on top of the base Stripe build.

---

## Open Design Decision

**Annual plan + mid-year account additions:**

Two options — decide before build:

| Option | Behavior | Complexity |
|--------|----------|------------|
| A (Recommended) | Mid-year account additions trigger an immediate prorated charge for the remainder of the annual period | Moderate — requires proration calculation |
| B (Simpler) | Account overages only charged at annual renewal. No mid-year billing. | Low — single annual true-up |

Option B is simpler to build and friendlier to users. Option A maximizes revenue capture
and is more accurate. For a first launch, Option B is the correct call — add Option A in
a later billing iteration.

---

## Key Risk: invoice.upcoming Timing

Stripe fires `invoice.upcoming` approximately 1 hour before the invoice is finalized
(configurable up to 7 days in advance in Stripe Dashboard). Set this to **3 days** in
Stripe Dashboard → Billing → Invoice finalization. This gives the webhook time to run
and attach line items before the invoice closes. If the webhook runs after finalization,
the extra line items miss the invoice.

**Set this before going live.**

---

*This spec is the authoritative source for Plaid-integrated billing.  
See `STRIPE_ROADMAP.md` for the base Stripe subscription build.  
See `ROADMAP.md` → Next Sprint for overall sequencing.*
