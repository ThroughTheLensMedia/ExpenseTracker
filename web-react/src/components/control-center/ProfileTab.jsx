import React, { useState } from 'react';
import { apiPost } from '../../api';
import { useAuth } from '../AuthContext';

const PLAN_LABELS = {
    free:           { label: 'Free',              color: '#94a3b8' },
    free_beta:      { label: 'Beta Access',        color: '#a78bfa' },  // expires — not lifetime
    beta_tester:    { label: 'Beta Access',        color: '#a78bfa' },
    lifetime:       { label: 'Lifetime Free',      color: '#10b981' },  // true lifetime — no expiry
    sync_monthly:   { label: 'Sync — $4.99/mo',   color: '#38bdf8' },
    sync_annual:    { label: 'Sync — $49.99/yr',  color: '#38bdf8' },
    core_monthly:   { label: 'Core — $9/mo',       color: '#f97316' },
    core_annual:    { label: 'Core — $86/yr',      color: '#f97316' },
    studio_monthly: { label: 'Studio — $19/mo',    color: '#a78bfa' },
    studio_annual:  { label: 'Studio — $182/yr',   color: '#a78bfa' },
};

const VITE_PRICE = {
    sync_monthly:   import.meta.env.VITE_STRIPE_PRICE_SYNC_MONTHLY,
    sync_annual:    import.meta.env.VITE_STRIPE_PRICE_SYNC_ANNUAL,
    core_monthly:   import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY,
    core_annual:    import.meta.env.VITE_STRIPE_PRICE_CORE_ANNUAL,
    studio_monthly: import.meta.env.VITE_STRIPE_PRICE_STUDIO_MONTHLY,
    studio_annual:  import.meta.env.VITE_STRIPE_PRICE_STUDIO_ANNUAL,
};

export default function ProfileTab({ settings, setSettings, onReload }) {
    const [msg, setMsg] = useState('');
    const { tier, subscription, subscriptionReady } = useAuth();
    const [billingAnnual, setBillingAnnual] = useState(false);
    const [billingLoading, setBillingLoading] = useState(null);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setSettings(prev => ({ ...prev, logo_url: ev.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setMsg("Saving profile...");
        try {
            await apiPost('/settings', settings);
            setMsg("Profile saved successfully!");
            setTimeout(() => setMsg(''), 3000);
            onReload(true);
        } catch (err) { setMsg(`Error: ${err.message}`); }
    };

    const field = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    const planType    = subscription?.plan_type || 'free';
    const adminTier   = subscription?.admin_tier || null;
    const planInfo    = PLAN_LABELS[planType] || PLAN_LABELS.free;
    const isPaid      = ['sync_monthly', 'sync_annual', 'core_monthly', 'core_annual', 'studio_monthly', 'studio_annual'].includes(planType);
    const isBeta      = ['free_beta', 'beta_tester'].includes(planType);
    const isLifetime  = planType === 'lifetime'; // true lifetime — no expires_at
    const isGrandfathered = isBeta || isLifetime; // hides upgrade cards
    const hasPortal   = isPaid && subscription?.stripe_customer_id;

    // Days left for beta accounts
    const daysLeft = subscription?.expires_at
        ? Math.ceil((new Date(subscription.expires_at) - new Date()) / 86400000)
        : null;

    const handleManageBilling = async () => {
        setBillingLoading('portal');
        try {
            const { url } = await apiPost('/stripe/portal', {});
            if (url) window.location.href = url;
        } catch (err) {
            setMsg(`Billing portal error: ${err.message}`);
        } finally {
            setBillingLoading(null);
        }
    };

    const handleUpgrade = async (planKey) => {
        const priceId = VITE_PRICE[planKey];
        if (!priceId) return;
        setBillingLoading(planKey);
        try {
            const { url } = await apiPost('/stripe/create-checkout', { price_id: priceId });
            if (url) window.location.href = url;
        } catch (err) {
            setMsg(`Checkout error: ${err.message}`);
        } finally {
            setBillingLoading(null);
        }
    };

    // ── Billing section — inlined (NOT a nested component) ─────────────────────
    // Nested components (const X = () => ...) get a new function reference every
    // render, causing React to unmount+remount → produces the 1-frame flash where
    // subscription is null and upgrade cards briefly appear. Inline JSX avoids this.
    const billingEl = !subscriptionReady ? (
        <div style={{ marginBottom: '36px', padding: '24px 28px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', minHeight: 80, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>Loading subscription…</div>
        </div>
    ) : (
        <div style={{ marginBottom: '36px', padding: '24px 28px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>SUBSCRIPTION</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                            {adminTier ? `${adminTier.charAt(0).toUpperCase() + adminTier.slice(1)} (Admin Grant)` : planInfo.label}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: '20px', background: `${planInfo.color}22`, color: planInfo.color, border: `1px solid ${planInfo.color}44` }}>
                            {tier.toUpperCase()}
                        </span>
                    </div>
                    {isBeta && daysLeft !== null && (
                        <div style={{ fontSize: '12px', color: 'rgba(167,139,250,0.7)', marginTop: '6px' }}>
                            Beta access · {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'} · Full feature access during beta
                        </div>
                    )}
                    {isLifetime && (
                        <div style={{ fontSize: '12px', color: 'rgba(16,185,129,0.7)', marginTop: '6px' }}>
                            Grandfathered — free platform access forever · Saving ${tier === 'studio' ? '228' : '108'}/yr vs paid plans
                        </div>
                    )}
                    {adminTier && (
                        <div style={{ fontSize: '12px', color: 'rgba(167,139,250,0.7)', marginTop: '6px' }}>
                            Access granted by admin · No billing impact
                        </div>
                    )}
                </div>
                {hasPortal && (
                    <button onClick={handleManageBilling} disabled={billingLoading === 'portal'} className="btn secondary" style={{ padding: '10px 22px', fontSize: '13px', opacity: billingLoading === 'portal' ? 0.6 : 1 }}>
                        {billingLoading === 'portal' ? 'Loading...' : '⚙ Manage Billing'}
                    </button>
                )}
            </div>

            {/* Upgrade cards — hide for lifetime (already grandfathered to Studio) and paid/admin; show for beta + free */}
            {subscriptionReady && !isPaid && !isLifetime && !adminTier && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Upgrade your plan</div>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
                            <button onClick={() => setBillingAnnual(false)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: !billingAnnual ? 'rgba(255,255,255,0.1)' : 'transparent', color: !billingAnnual ? '#fff' : 'rgba(255,255,255,0.4)' }}>Monthly</button>
                            <button onClick={() => setBillingAnnual(true)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: billingAnnual ? 'rgba(56,189,248,0.15)' : 'transparent', color: billingAnnual ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                                Annual {billingAnnual && <span style={{ fontSize: '10px' }}>· Save 20%</span>}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {/* Sync */}
                        <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>Sync</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                                {billingAnnual ? '$49.99' : '$4.99'}<span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{billingAnnual ? '/yr' : '/mo'}</span>
                                {billingAnnual && <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(56,189,248,0.6)', marginLeft: '6px' }}>Save 20%</span>}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px', lineHeight: 1.5 }}>Live bank sync via Plaid · All accounts included · No per-account fees</div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'sync_annual' : 'sync_monthly')} disabled={!!billingLoading} className="btn primary" style={{ width: '100%', padding: '9px', fontSize: '12px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'sync_annual' : 'sync_monthly') ? 'Loading...' : 'Get Sync'}
                            </button>
                        </div>
                        {/* Core */}
                        <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>Core</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{billingAnnual ? '$7.17' : '$9'}<span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px', lineHeight: 1.5 }}>AI Brain + Sync · Receipt scanner · 2,000 tx/mo · 20 invoices/mo</div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'core_annual' : 'core_monthly')} disabled={!!billingLoading} className="btn primary" style={{ width: '100%', padding: '9px', fontSize: '12px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'core_annual' : 'core_monthly') ? 'Loading...' : 'Upgrade to Core'}
                            </button>
                        </div>
                        {/* Studio */}
                        <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '4px' }}>Studio</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{billingAnnual ? '$15.17' : '$19'}<span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px', lineHeight: 1.5 }}>Everything in Core · Unlimited · Mileage autopilot · Priority</div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'studio_annual' : 'studio_monthly')} disabled={!!billingLoading} className="btn primary" style={{ width: '100%', padding: '9px', fontSize: '12px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'studio_annual' : 'studio_monthly') ? 'Loading...' : 'Upgrade to Studio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPaid && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                    Subscription managed through Stripe · Invoices emailed automatically · Cancel or upgrade anytime via Manage Billing
                </div>
            )}
        </div>
    );

    return (
        <div className="card glass glow-blue" style={{ border: 'none', padding: 'clamp(20px, 4vw, 40px)', margin: 0 }}>
            <style>{`
                .profile-form { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .profile-form .f2 { grid-column: span 2; }
                .profile-form .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                @media (max-width: 640px) {
                    .profile-form { grid-template-columns: 1fr; gap: 14px; }
                    .profile-form .f2 { grid-column: span 1; }
                    .profile-form .payment-grid { grid-template-columns: 1fr; gap: 14px; }
                }
            `}</style>

            {billingEl}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Business Profile Branding</h2>
            </div>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '24px' }}>
                Studio identity used on invoices and reports. Fill out what you have — save and update anytime.
            </p>

            <form onSubmit={handleSaveSettings} className="profile-form">
                {/* Logo row — upload + preview inline */}
                <div className="f2" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <small className="muted" style={{ fontWeight: 900 }}>LOGO</small>
                        <label className="btn secondary" style={{ display: 'block', marginTop: '8px', cursor: 'pointer', textAlign: 'center' }}>
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                            {settings.logo_url ? 'Change Logo' : 'Upload Logo'}
                        </label>
                    </div>
                    {settings.logo_url && (
                        <div style={{ flexShrink: 0, width: '100px', height: '64px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <img src={settings.logo_url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                    )}
                </div>

                {/* Business Name | Business Category */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>OFFICIAL BUSINESS NAME</small>
                    <input value={settings.business_name || ''} onChange={e => field('business_name', e.target.value)} placeholder="Your Business Name" style={{ marginTop: '8px', padding: '13px' }} />
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>BUSINESS CATEGORY</small>
                    <input value={settings.business_category || ''} onChange={e => field('business_category', e.target.value)} placeholder="e.g. Wedding Photography, Media Production" style={{ marginTop: '8px', padding: '13px' }} />
                </div>

                {/* Contact Name | Job Title */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>CONTACT NAME</small>
                    <input value={settings.contact_name || ''} onChange={e => field('contact_name', e.target.value)} placeholder="Your Full Name" style={{ marginTop: '8px', padding: '13px' }} />
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>JOB TITLE</small>
                    <input value={settings.job_title || ''} onChange={e => field('job_title', e.target.value)} placeholder="Your Job Title" style={{ marginTop: '8px', padding: '13px' }} />
                </div>

                {/* Business Website | Business Email */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>BUSINESS WEBSITE</small>
                    <input value={settings.website || ''} onChange={e => field('website', e.target.value)} placeholder="yourwebsite.com" style={{ marginTop: '8px', padding: '13px' }} />
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>BUSINESS EMAIL</small>
                    <input type="email" value={settings.email || ''} onChange={e => field('email', e.target.value)} placeholder="hello@example.com" style={{ marginTop: '8px', padding: '13px' }} />
                </div>

                {/* Business Phone | Office Address */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>BUSINESS PHONE</small>
                    <input value={settings.phone || ''} onChange={e => field('phone', e.target.value)} placeholder="(000) 000-0000" style={{ marginTop: '8px', padding: '13px' }} />
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>OFFICE ADDRESS</small>
                    <textarea value={settings.address || ''} onChange={e => field('address', e.target.value)} placeholder="Studio Address..." style={{ marginTop: '8px', padding: '13px', minHeight: '48px', resize: 'vertical' }} />
                </div>

                {/* Tax ID | Entity Type | NAICS — three-way on one logical row */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>STUDIO TAX ID (EIN/VAT)</small>
                    <input value={settings.tax_id || ''} onChange={e => field('tax_id', e.target.value)} placeholder="XX-XXXXXXX" style={{ marginTop: '8px', padding: '13px' }} />
                    <div className="muted small" style={{ marginTop: '6px' }}>Printed on professional tax invoices.</div>
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>IRS ENTITY TYPE</small>
                    <select value={settings.entity_type || 'Sole Proprietorship'} onChange={e => field('entity_type', e.target.value)} style={{ marginTop: '8px', padding: '13px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                        <option value="LLC (Single Member)">LLC (Single Member)</option>
                        <option value="LLC (Multi Member)">LLC (Multi Member)</option>
                        <option value="S-Corp">S-Corp</option>
                        <option value="C-Corp">C-Corp</option>
                        <option value="Partnership">Partnership</option>
                    </select>
                </div>

                {/* NAICS paired with Invoice Notes header — or standalone half */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>IRS BUSINESS CODE (NAICS)</small>
                    <input value={settings.naics_code || '711510'} onChange={e => field('naics_code', e.target.value)} placeholder="711510" style={{ marginTop: '8px', padding: '13px' }} />
                    <div className="muted small" style={{ marginTop: '6px' }}>Photographers: 711510.</div>
                </div>

                {/* Global Invoice Notes */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>GLOBAL INVOICE NOTES</small>
                    <textarea value={settings.invoice_notes || ''} onChange={e => field('invoice_notes', e.target.value)} placeholder="e.g. Thank you for your business!" style={{ marginTop: '8px', padding: '13px', minHeight: '65px', resize: 'vertical' }} />
                </div>

                {/* Contract Terms | Payment Methods */}
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>STANDARD CONTRACT TERMS</small>
                    <textarea value={settings.standard_terms || ''} onChange={e => field('standard_terms', e.target.value)} placeholder="e.g. Net 15, Late fees apply..." style={{ marginTop: '8px', padding: '13px', minHeight: '65px', resize: 'vertical' }} />
                </div>
                <div>
                    <small className="muted" style={{ fontWeight: 900 }}>ACCEPTED PAYMENT METHODS</small>
                    <textarea value={settings.payment_methods || ''} onChange={e => field('payment_methods', e.target.value)} placeholder="e.g. Payment due within 14 days. Checks payable to..." style={{ marginTop: '8px', padding: '13px', minHeight: '65px', resize: 'vertical' }} />
                </div>

                {/* Stripe setup guidance */}
                <div className="f2">
                    <div style={{ padding: '16px 20px', background: 'rgba(99,91,255,0.05)', borderRadius: '14px', border: '1px solid rgba(99,91,255,0.18)' }}>
                        <div style={{ fontWeight: 950, fontSize: '12px', color: '#a78bfa', marginBottom: '12px', letterSpacing: '0.05em' }}>💳 ENABLE ONLINE INVOICE PAYMENTS (STRIPE)</div>
                        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                            Stripe lets your clients pay invoices by credit or debit card. It's free to sign up — Stripe charges a small per-transaction fee (2.9% + 30¢) directly to you. No monthly cost.
                        </p>
                        <ol style={{ margin: '0 0 12px', padding: '0 0 0 18px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 2, fontWeight: 600 }}>
                            <li>Create a free account at <a href="https://stripe.com" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>stripe.com</a> using your business name and email.</li>
                            <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>Dashboard → Developers → API Keys</a>.</li>
                            <li>Copy your <strong style={{ color: 'white' }}>Publishable key</strong> (starts with <code style={{ color: '#a78bfa' }}>pk_live_</code>).</li>
                            <li>Paste it into the Stripe Publishable Key field below and save.</li>
                        </ol>
                        <div style={{ fontSize: '11px', color: 'rgba(249,115,22,0.8)', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: '8px', padding: '8px 12px' }}>
                            ⚠️ Only paste the <strong>Publishable key</strong> here — never your Secret key. The publishable key is safe to store; the secret key is not.
                        </div>
                    </div>
                </div>

                {/* Instant Payment Handles */}
                <div className="f2">
                    <div style={{ padding: '18px 20px', background: 'rgba(56,189,248,0.04)', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.12)' }}>
                        <div style={{ fontWeight: 950, fontSize: '12px', color: '#38bdf8', marginBottom: '16px', letterSpacing: '0.05em' }}>⚡ INSTANT PAYMENT HANDLES</div>
                        <div className="payment-grid">
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>VENMO HANDLE</small>
                                <input value={settings.venmo_handle || ''} onChange={e => field('venmo_handle', e.target.value)} placeholder="@YourStudio" style={{ marginTop: '8px', padding: '11px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>ZELLE (EMAIL OR PHONE)</small>
                                <input value={settings.zelle_handle || ''} onChange={e => field('zelle_handle', e.target.value)} placeholder="studio@email.com" style={{ marginTop: '8px', padding: '11px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>CASHAPP TAG</small>
                                <input value={settings.cashapp_tag || ''} onChange={e => field('cashapp_tag', e.target.value)} placeholder="$YourCashTag" style={{ marginTop: '8px', padding: '11px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>STRIPE PUBLISHABLE KEY</small>
                                <input type="password" value={settings.stripe_publishable_key || ''} onChange={e => field('stripe_publishable_key', e.target.value)} placeholder="pk_live_..." style={{ marginTop: '8px', padding: '11px' }} />
                                <div className="muted extra-small" style={{ marginTop: '5px' }}>
                                    Publishable key only — never your secret key.{' '}
                                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>Get it at dashboard.stripe.com →</a>
                                </div>
                            </div>
                        </div>
                        <div className="muted extra-small" style={{ marginTop: '14px', padding: '9px 12px', background: 'rgba(249,115,22,0.06)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.15)', color: '#f97316' }}>
                            💡 Shown on your client payment portal when you send an invoice.
                        </div>
                    </div>
                </div>

                {/* Signature */}
                <div className="f2">
                    <small className="muted" style={{ fontWeight: 900 }}>PERSONALIZED SIGNATURE & SOCIALS</small>
                    <textarea value={settings.signature_text || ''} onChange={e => field('signature_text', e.target.value)} placeholder="Your Name, Website, Instagram..." style={{ marginTop: '8px', padding: '13px', minHeight: '65px', resize: 'vertical' }} />
                    <div className="muted small" style={{ marginTop: '6px' }}>Sign-off for the bottom of invoices.</div>
                </div>

                {/* Save */}
                <div className="f2" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
                    <button type="submit" className="btn primary glow-blue" style={{ padding: '14px 40px', fontSize: '15px' }}>Save Global Identity</button>
                    {msg && <span className={`${msg.includes('Error') ? 'tag bad' : 'tag ok'}`} style={{ fontWeight: 900 }}>{msg}</span>}
                </div>
            </form>
        </div>
    );
}
