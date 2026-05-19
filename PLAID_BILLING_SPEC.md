# Lumière Ledger — Plaid Usage Billing Specification

**Last updated:** 2026-05-18  
**Status:** Design complete — pending Plaid approval + build  
**Depends on:** `STRIPE_ROADMAP.md` (Stripe must be built first)  
**Referenced by:** `ROADMAP.md` → Next Sprint

---

## Pricing Model

Plaid live bank sync is **opt-in** on all tiers. Connecting accounts triggers usage-based
billing. Users who never connect a bank pay nothing extra.

### Platform tiers (separate from Plaid — locked 2026-05-18)

| Tier | Monthly | Annual |
|------|---------|--------|
| Free / Grandfathered | $0 | — |
| Core | $9.00 / mo | $86.00 / yr |
| Studio | $19.00 / mo | $182.00 / yr |

### Plaid usage fees (all tiers, all users)

| Line Item | Rate | Notes |
|-----------|------|-------|
| Plaid connected account | **$0.50 / account / month** | Every account, no free tier |
| Stripe processing fee | 2.9% + $0.30 | Applied to Plaid subtotal — shown as separate line item |

**Cost basis:** Plaid charges the platform $0.30/account/month. The $0.50 rate covers
cost + $0.20/account/month margin. Stripe fees are passed through at cost — zero markup.

**Admin exemption (Joshua):** The platform owner pays Plaid directly as part of the
business account. His Lumière Ledger account is bypassed in `buildPlaidInvoiceItems`
— no Stripe invoice items generated for user_id `49e7efcb-6434-4f0c-9563-3151a6d50df9`.

**Grandfathered Free members** (free_beta / lifetime) pay $0 platform fee + $0.50/account
Plaid fee. Connecting 0 accounts = $0 total. Connecting 5 accounts = $2.50 + Stripe fee.
They get the full Plaid experience with no platform subscription required.

---

## Card-on-File Required Before Plaid Activates

Users must have a valid payment method on file before the Plaid Link flow opens.

**Flow:**
1. User clicks "Connect a Bank" in the Integrations tab
2. Frontend calls `GET /api/stripe/status` — checks for `stripe_customer_id`
3. If no payment method on file → show modal: "Bank sync requires a payment method. You'll
   only be charged for accounts you connect ($0.50/account/month). No charge today."
   → CTA: "Add Payment Method" → opens Stripe Customer Portal (Setup mode)
4. Once payment method confirmed → Plaid Link opens normally
5. After successful Plaid Link → upsert accounts → update billing preview

**Stripe Customer Portal in Setup mode** (no subscription required):
```js
const session = await stripe.billingPortal.sessions.create({
  customer:   stripeCustomerId,       // create customer first if none exists
  return_url: 'https://www.lumiereledger.com/StudioControlCenter?tab=integration',
  flow_data:  { type: 'payment_method_update' }
});
```

For users with no `stripe_customer_id` yet (Free/grandfathered): create a Stripe Customer
record first (`stripe.customers.create({ email, metadata: { user_id } })`), store the ID
in `user_subscriptions.stripe_customer_id`, then open the portal.

---

## Sample Invoices

Stripe sends these automatically as PDF emails after every successful charge.

**Studio user — 6 connected accounts:**
```
LUMIÈRE LEDGER — Invoice #LL-2026-0901
Billing period: June 1 – June 30, 2026
Customer: Jane Photographer <jane@example.com>

────────────────────────────────────────────────────────
LINE ITEM                                         AMOUNT
────────────────────────────────────────────────────────
Lumière Studio — Monthly Subscription             $19.00

Plaid live bank sync (6 accounts × $0.50)          $3.00
  Chase Checking ••4242, Chase Savings ••8810
  Amex Gold ••1005, Venture X ••3310
  Delta SkyMiles ••7721, Capital One ••2209

                                       Subtotal:   $3.00
Stripe processing fee (2.9% + $0.30)               $0.39
────────────────────────────────────────────────────────
                              PLAID USAGE TOTAL:   $3.39
────────────────────────────────────────────────────────
TOTAL CHARGED:                                    $22.39
Payment method: Visa ending in 4242
Payment status: PAID
```

**Grandfathered Free member — 4 connected accounts (no platform fee):**
```
LUMIÈRE LEDGER — Invoice #LL-2026-0902
Billing period: June 1 – June 30, 2026
Customer: Beta Member <beta@example.com>

────────────────────────────────────────────────────────
LINE ITEM                                         AMOUNT
────────────────────────────────────────────────────────
Lumière — Lifetime Free Access                     $0.00

Plaid live bank sync (4 accounts × $0.50)          $2.00
  Chase Checking ••4242, Chase Savings ••8810
  Amex Gold ••1005, Venture X ••3310

                                       Subtotal:   $2.00
Stripe processing fee (2.9% + $0.30)               $0.36
────────────────────────────────────────────────────────
TOTAL CHARGED:                                     $2.36
Payment method: Visa ending in 4242
Payment status: PAID
```

**Free user — 0 connected accounts (no Plaid, no charge):**
```
No invoice generated. No Stripe customer required until Plaid is connected.
```

---

## Billing Cycle — End to End

```
1. Stripe triggers upcoming invoice (~3 days before renewal)
   └─ Fires webhook: invoice.upcoming

2. API receives webhook
   └─ Looks up user by stripe_customer_id
   └─ Skips if user_id = admin UUID (Joshua)
   └─ Queries plaid_accounts: SELECT COUNT(*) WHERE user_id = X AND active = true
   └─ If count = 0: no line items created (no Plaid usage this cycle)
   └─ If count > 0:
      └─ plaidSubtotalCents = count × 50          ($0.50 each)
      └─ stripeFeeCents = ROUND((plaidSubtotalCents × 0.029) + 30)
      └─ Creates two invoice items on the upcoming invoice

3. Stripe finalizes and charges the invoice
   └─ Fires webhook: invoice.payment_succeeded

4. API receives payment_succeeded
   └─ Confirms subscription active in user_subscriptions
   └─ Stripe auto-emails PDF invoice to customer

5. Payment fails:
   └─ Stripe retries 3× over 7 days (invoice.payment_failed each time)
   └─ API logs warning, queues health alert email to Joshua
   └─ Final failure: customer.subscription.deleted → plan_type = 'free'
   └─ Plaid access suspended, access tokens preserved (re-activates on payment)
```

**For grandfathered Free users (no platform subscription):**
Plaid charges are billed via a **standalone Stripe invoice** — not attached to a subscription.
The `invoice.upcoming` webhook won't fire for them. Instead: create and finalize the invoice
manually on a monthly schedule via a cron job (`POST /api/cron/plaid-billing`).

---

## Database Schema

Run in Supabase SQL Editor. Idempotent — safe to re-run.

```sql
-- Track every Plaid-connected account per user
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id   TEXT NOT NULL,
  account_id      TEXT NOT NULL UNIQUE,
  account_name    TEXT,
  account_type    TEXT,
  account_subtype TEXT,
  mask            TEXT,
  current_balance_cents  BIGINT,
  available_balance_cents BIGINT,
  active          BOOLEAN DEFAULT true,
  connected_at    TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plaid_accounts_user_id_idx ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS plaid_accounts_active_idx  ON plaid_accounts(user_id, active);

ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users access own plaid accounts"
  ON plaid_accounts FOR ALL USING (user_id = auth.uid());

-- Add balance columns to user_subscriptions
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS plaid_account_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_plaid_sync        TIMESTAMPTZ;
```

---

## `buildPlaidInvoiceItems()` — Updated Logic

```js
const ADMIN_USER_ID = '49e7efcb-6434-4f0c-9563-3151a6d50df9'; // Joshua — bypass billing

async function buildPlaidInvoiceItems(userId, stripeCustomerId) {
  // Admin pays Plaid directly — skip Stripe billing
  if (userId === ADMIN_USER_ID) return null;

  const { count } = await supabase
    .from('plaid_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true);

  if (!count || count === 0) return null; // No accounts connected — no charge

  const plaidSubtotalCents = count * 50;  // $0.50/account
  const stripeFeeCents = Math.round((plaidSubtotalCents * 0.029) + 30); // 2.9% + $0.30

  await getStripe().invoiceItems.create({
    customer:    stripeCustomerId,
    amount:      plaidSubtotalCents,
    currency:    'usd',
    description: `Plaid live bank sync (${count} account${count === 1 ? '' : 's'} × $0.50/mo)`,
  });

  await getStripe().invoiceItems.create({
    customer:    stripeCustomerId,
    amount:      stripeFeeCents,
    currency:    'usd',
    description: `Stripe processing fee (2.9% + $0.30 on $${(plaidSubtotalCents / 100).toFixed(2)})`,
  });

  console.log(`[stripe/plaid] billed user ${userId} — ${count} accounts, $${((plaidSubtotalCents + stripeFeeCents) / 100).toFixed(2)} total`);
  return { count, plaidSubtotalCents, stripeFeeCents };
}
```

---

## Build Order

| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| P1 | Schema migration — `plaid_accounts` table | Supabase SQL Editor | 5 min |
| P2 | Card-on-file gate — check before Plaid Link opens | `PlaidLink.jsx` + `stripe.js` | 45 min |
| P3 | Populate `plaid_accounts` on token exchange | `api/routes/plaid.js` | 30 min |
| P4 | Mark accounts inactive on item removal | `api/routes/plaid.js` | 15 min |
| P5 | Update `buildPlaidInvoiceItems()` — new $0.50 model | `api/routes/stripe.js` | 20 min |
| P6 | Standalone invoice cron for Free/grandfathered users | `api/routes/cron.js` | 45 min |
| P7 | `GET /api/plaid/account-summary` — balance + billing preview | `api/routes/plaid.js` | 20 min |
| P8 | Billing preview card in Integrations tab | `IntegrationTab.jsx` | 45 min |
| P9 | Accounts page — live balances, current value (see ROADMAP.md) | New page | 2 hrs |
| P10 | End-to-end test — connect accounts → preview → charge → verify | Local + Stripe CLI | 45 min |

**Total estimate:** ~6 hours including the Accounts page.

---

## Transparency Policy

Every invoice line item is explicit. Users see:
- Exactly how many accounts they have connected
- The per-account rate ($0.50)
- The exact Stripe processing fee — not bundled, not hidden
- A billing preview in-app before the charge hits

This is by design. Low costs + full transparency = zero disputes.

---

*Authoritative source for Plaid billing.  
See `STRIPE_ROADMAP.md` for base Stripe subscription build.  
See `ROADMAP.md` for overall sequencing.*
