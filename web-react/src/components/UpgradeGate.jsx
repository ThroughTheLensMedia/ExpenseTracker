// UpgradeGate.jsx — Wraps premium features with tier enforcement
// Usage:
//   <UpgradeGate minTier="core" feature="ai_brain">
//     <AssistantSidebar />
//   </UpgradeGate>
//
// minTier: 'core' | 'studio'
// feature: string used for analytics + upgrade card copy (see FEATURE_COPY below)

import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const TIER_RANK = { free: 0, core: 1, studio: 2 };

// Price IDs passed to checkout — set from env vars (VITE_STRIPE_PRICE_*)
const PRICES = {
  core_monthly:   import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY,
  core_annual:    import.meta.env.VITE_STRIPE_PRICE_CORE_ANNUAL,
  studio_monthly: import.meta.env.VITE_STRIPE_PRICE_STUDIO_MONTHLY,
  studio_annual:  import.meta.env.VITE_STRIPE_PRICE_STUDIO_ANNUAL,
};

const FEATURE_COPY = {
  ai_brain:          { title: 'AI Brain', blurb: 'Ask your ledger anything. Lumière Assistant analyzes your data and takes action on your behalf.' },
  receipt_scanner:   { title: 'Receipt Scanner', blurb: 'Point your camera at any receipt — vendor, amount, date, and category fill in automatically.' },
  bank_import:       { title: 'Live Bank Sync', blurb: 'Connect your bank accounts and let transactions import automatically via Plaid.' },
  automation_rules:  { title: 'Automation Rules', blurb: 'Set rules once — the engine categorizes every transaction matching your criteria automatically.' },
  executive_dashboard: { title: 'Executive Dashboard', blurb: 'KPIs, forecasts, and YTD analytics for your business finances at a glance.' },
  mileage:           { title: 'Mileage Automation', blurb: 'Log A→B→A round trips with Google Maps. Mileage deductions calculated automatically.' },
  batch_categorize:  { title: 'Batch AI Categorization', blurb: 'Run the AI engine across your entire ledger to categorize hundreds of transactions at once.' },
  data_archive:      { title: 'Data Archive', blurb: 'Download a full Master Business Archive of your ledger, invoices, and CRM data anytime.' },
  default:           { title: 'Premium Feature', blurb: 'Upgrade to unlock this feature and take your studio finances to the next level.' },
};

const PLAN_LABELS = {
  core:   { monthly: '$9 / mo', annual: '$86 / yr', name: 'Lumière Core' },
  studio: { monthly: '$19 / mo', annual: '$182 / yr', name: 'Lumière Studio' },
};

export default function UpgradeGate({ minTier = 'core', feature = 'default', children }) {
  const { tier, session } = useAuth();
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);

  // User has access — render children directly
  if (TIER_RANK[tier] >= TIER_RANK[minTier]) {
    return children;
  }

  const copy  = FEATURE_COPY[feature] || FEATURE_COPY.default;
  const plan  = PLAN_LABELS[minTier];
  const priceId = billing === 'annual'
    ? PRICES[`${minTier}_annual`]
    : PRICES[`${minTier}_monthly`];

  const handleUpgrade = async () => {
    if (!priceId) {
      console.error('[UpgradeGate] No price ID configured for', minTier, billing);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ price_id: priceId }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      console.error('[UpgradeGate] Checkout error:', err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '320px', padding: '48px 24px', textAlign: 'center',
    }}>
      <div className="card glass" style={{
        maxWidth: '480px', width: '100%', padding: '40px 32px',
        border: '1px solid rgba(56,189,248,0.2)',
      }}>
        {/* Icon */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '22px',
        }}>🔒</div>

        {/* Heading */}
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0 0 10px', color: 'white' }}>
          {copy.title}
        </h2>
        <p className="muted" style={{ fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px' }}>
          {copy.blurb}
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.06)',
          borderRadius: '8px', padding: '3px', marginBottom: '20px', gap: '3px',
        }}>
          {['monthly', 'annual'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={billing === b ? 'pill' : ''}
              style={{
                flex: 1, padding: '8px', fontSize: '13px', fontWeight: 700,
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: billing === b ? 'rgba(56,189,248,0.18)' : 'transparent',
                color: billing === b ? '#38bdf8' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {b === 'monthly' ? 'Monthly' : 'Annual (save 20%)'}
            </button>
          ))}
        </div>

        {/* Price + CTA */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
            {plan.name}
          </span>
          <span style={{ fontSize: '1.8rem', fontWeight: 950, color: 'white' }}>
            {billing === 'annual' ? plan.annual : plan.monthly}
          </span>
        </div>

        <button
          className="btn glow-blue"
          onClick={handleUpgrade}
          disabled={loading}
          style={{ width: '100%', padding: '14px', fontWeight: 900, fontSize: '15px' }}
        >
          {loading ? 'Redirecting…' : `Upgrade to ${plan.name} →`}
        </button>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '16px', marginBottom: 0 }}>
          Cancel anytime · Secure checkout via Stripe
        </p>
      </div>
    </div>
  );
}
