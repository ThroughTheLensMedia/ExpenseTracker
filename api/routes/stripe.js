// api/routes/stripe.js — Lumière Ledger Stripe integration
// Mount order in server.js:
//   app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
//   app.use('/api/stripe', authMiddleware, stripeRouter);   ← after authMiddleware
'use strict';

const express = require('express');
const Stripe = require('stripe');
const { supabase } = require('../db');

const router = express.Router();

// Lazy Stripe init — avoids crash-on-startup when STRIPE_SECRET_KEY is not yet set in env
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('[stripe] STRIPE_SECRET_KEY is not configured in environment variables');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  }
  return _stripe;
}

// Price ID map — set all in Vercel env vars after creating products in Stripe Dashboard
const PRICES = {
  sync_monthly:   process.env.STRIPE_PRICE_SYNC_MONTHLY,    // $4.99/mo
  sync_annual:    process.env.STRIPE_PRICE_SYNC_ANNUAL,     // $49.99/yr
  core_monthly:   process.env.STRIPE_PRICE_CORE_MONTHLY,   // $9/mo
  core_annual:    process.env.STRIPE_PRICE_CORE_ANNUAL,     // $86/yr
  studio_monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,  // $19/mo
  studio_annual:  process.env.STRIPE_PRICE_STUDIO_ANNUAL,   // $182/yr
};

// Maps a Stripe price ID back to a plan_type string
function planTypeFromPriceId(priceId) {
  for (const [plan, id] of Object.entries(PRICES)) {
    if (id && id === priceId) return plan;
  }
  return null;
}

// Derives effective tier — admin_tier overrides billing tier (friends/family grants)
function deriveTier(plan_type, admin_tier) {
  if (admin_tier === 'studio') return 'studio';
  if (admin_tier === 'core')   return 'core';
  if (['studio_monthly', 'studio_annual'].includes(plan_type)) return 'studio';
  if (['core_monthly',   'core_annual'  ].includes(plan_type)) return 'core';
  if (['sync_monthly',   'sync_annual'  ].includes(plan_type)) return 'sync';
  return 'free';
}

// ─── POST /api/stripe/create-checkout ────────────────────────────────────────
// Body: { price_id: 'price_xxx' }  Returns: { url }
router.post('/create-checkout', async (req, res) => {
  const { price_id } = req.body;
  const validPrices = Object.values(PRICES).filter(Boolean);

  if (!price_id || !validPrices.includes(price_id)) {
    return res.status(400).json({ error: 'Invalid price_id' });
  }

  try {
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: 'https://www.lumiereledger.com/StudioControlCenter?tab=profile&upgrade=success',
      cancel_url:  'https://www.lumiereledger.com/StudioControlCenter?tab=profile&upgrade=cancelled',
      metadata: { user_id: req.user.id },
      subscription_data: { metadata: { user_id: req.user.id } },
      allow_promotion_codes: true,
    };

    if (sub?.stripe_customer_id) {
      sessionParams.customer = sub.stripe_customer_id;
    } else {
      sessionParams.customer_email = req.user.email;
    }

    const session = await getStripe().checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] create-checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ─── POST /api/stripe/portal ──────────────────────────────────────────────────
// Returns: { url } — redirect to Stripe Customer Portal
router.post('/portal', async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: 'https://www.lumiereledger.com/StudioControlCenter?tab=profile',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] portal error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ─── GET /api/stripe/status ───────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('plan_type, admin_tier, stripe_customer_id, stripe_subscription_id, expires_at')
      .eq('user_id', req.user.id)
      .single();

    if (!sub) return res.status(404).json({ error: 'Subscription record not found' });

    const tier = deriveTier(sub.plan_type, sub.admin_tier);
    res.json({
      tier,
      plan_type:              sub.plan_type,
      admin_tier:             sub.admin_tier || null,
      stripe_customer_id:     sub.stripe_customer_id || null,
      stripe_subscription_id: sub.stripe_subscription_id || null,
      expires_at:             sub.expires_at || null,
    });
  } catch (err) {
    console.error('[stripe] status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Exported separately — mounted BEFORE authMiddleware with express.raw()
async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe] webhook signature failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.metadata?.user_id;
        if (!userId) break;

        let plan_type = null;
        if (session.line_items?.data?.[0]?.price?.id) {
          plan_type = planTypeFromPriceId(session.line_items.data[0].price.id);
        }
        if (!plan_type && session.subscription) {
          plan_type = await resolvePlanTypeFromSubscription(session.subscription);
        }

        const { error: upsertErr } = await supabase.from('user_subscriptions').upsert({
          user_id:                userId,
          plan_type:              plan_type || 'studio_monthly',
          stripe_customer_id:     session.customer,
          stripe_subscription_id: session.subscription,
          stripe_price_id:        session.line_items?.data?.[0]?.price?.id || null,
          expires_at:             null,
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (upsertErr) throw upsertErr; // non-2xx → Stripe retries the event

        console.log(`[stripe] checkout.session.completed — user ${userId} → ${plan_type}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object;
        const userId  = sub.metadata?.user_id;
        if (!userId) break;

        const priceId   = sub.items?.data?.[0]?.price?.id;
        const plan_type = planTypeFromPriceId(priceId);

        const { error: updateErr } = await supabase.from('user_subscriptions').update({
          plan_type:          plan_type || 'studio_monthly',
          stripe_price_id:    priceId || null,
          stripe_customer_id: sub.customer,
          expires_at:         null,
          updated_at:         new Date().toISOString(),
        }).eq('user_id', userId);
        if (updateErr) throw updateErr; // non-2xx → Stripe retries the event

        console.log(`[stripe] subscription.updated — user ${userId} → ${plan_type}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const { error: deleteErr } = await supabase.from('user_subscriptions').update({
          plan_type:              'free',
          stripe_subscription_id: null,
          stripe_price_id:        null,
          expires_at:             null,
          updated_at:             new Date().toISOString(),
        }).eq('user_id', userId);
        if (deleteErr) throw deleteErr; // non-2xx → Stripe retries the event

        console.log(`[stripe] subscription.deleted — user ${userId} → free`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`[stripe] payment.failed — customer ${invoice.customer}, attempt ${invoice.attempt_count}`);
        // TODO: wire queueHealthAlertEmail when email queue is active
        break;
      }

      case 'invoice.upcoming': {
        const invoice    = event.data.object;
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', invoice.customer)
          .single();

        if (sub?.user_id) {
          await buildPlaidInvoiceItems(sub.user_id, invoice.customer);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object;
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', invoice.customer)
          .single();

        if (sub?.user_id) {
          await supabase.from('user_subscriptions')
            .update({ expires_at: null, updated_at: new Date().toISOString() })
            .eq('user_id', sub.user_id);
          console.log(`[stripe] payment.succeeded — user ${sub.user_id} renewed`);
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[stripe] webhook handler error (${event.type}):`, err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolvePlanTypeFromSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    return planTypeFromPriceId(sub.items?.data?.[0]?.price?.id);
  } catch {
    return null;
  }
}

// Plaid usage billing — $0.50/account/month, all accounts, Stripe fee passed through
// Users in PLAID_BILLING_EXEMPT are never charged — Joshua pays Plaid directly; Michelle is comped.
const PLAID_BILLING_EXEMPT = new Set([
  '49e7efcb-6434-4f0c-9563-3151a6d50df9', // Joshua Deuermeyer (admin)
  'fcb92809-70f1-4ae0-b39c-e317378a01a7', // Michelle Gornichec (gornichecme@gmail.com)
]);

async function buildPlaidInvoiceItems(userId, stripeCustomerId) {
  if (PLAID_BILLING_EXEMPT.has(userId)) return null;

  const { count } = await supabase
    .from('plaid_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!count || count === 0) return null;

  const plaidSubtotalCents = count * 50; // $0.50/account
  const stripeFeeCents = Math.round((plaidSubtotalCents * 0.029) + 30); // 2.9% + $0.30

  await getStripe().invoiceItems.create({
    customer:    stripeCustomerId,
    amount:      plaidSubtotalCents,
    currency:    'usd',
    description: `Plaid live bank sync (${count} account${count === 1 ? '' : 's'} x $0.50/mo)`,
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

module.exports = { router, stripeWebhook, deriveTier };
