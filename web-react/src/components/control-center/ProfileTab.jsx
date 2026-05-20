import React, { useState } from 'react';
import { apiPost } from '../../api';
import { useAuth } from '../AuthContext';

const PLAN_LABELS = {
    free:           { label: 'Free',              color: '#94a3b8' },
    free_beta:      { label: 'Beta Access',        color: '#a78bfa' },  // expires — not lifetime
    beta_tester:    { label: 'Beta Access',        color: '#a78bfa' },
    lifetime:       { label: 'Lifetime Free',      color: '#10b981' },  // true lifetime — no expiry
    core_monthly:   { label: 'Core — $9/mo',       color: '#38bdf8' },
    core_annual:    { label: 'Core — $86/yr',      color: '#38bdf8' },
    studio_monthly: { label: 'Studio — $19/mo',    color: '#f97316' },
    studio_annual:  { label: 'Studio — $182/yr',   color: '#f97316' },
};

const VITE_PRICE = {
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
    const isPaid      = ['core_monthly', 'core_annual', 'studio_monthly', 'studio_annual'].includes(planType);
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

    const BillingSection = () => {
        // Wait until subscription data is resolved — prevents upgrade cards from flashing
        // for beta/lifetime users while subscription loads (starts null → resolves to free_beta)
        if (!subscriptionReady) {
            return (
                <div style={{ marginBottom: '36px', padding: '24px 28px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', minHeight: 80, display: 'flex', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>Loading subscription…</div>
                </div>
            );
        }
        return (
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
                    <button
                        onClick={handleManageBilling}
                        disabled={billingLoading === 'portal'}
                        className="btn secondary"
                        style={{ padding: '10px 22px', fontSize: '13px', opacity: billingLoading === 'portal' ? 0.6 : 1 }}
                    >
                        {billingLoading === 'portal' ? 'Loading...' : '⚙ Manage Billing'}
                    </button>
                )}
            </div>

            {/* Upgrade card — Free users only (not beta/lifetime/admin) */}
            {!isPaid && !isGrandfathered && !adminTier && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Unlock more with a paid plan</div>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
                            <button onClick={() => setBillingAnnual(false)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: !billingAnnual ? 'rgba(255,255,255,0.1)' : 'transparent', color: !billingAnnual ? '#fff' : 'rgba(255,255,255,0.4)' }}>Monthly</button>
                            <button onClick={() => setBillingAnnual(true)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: billingAnnual ? 'rgba(56,189,248,0.15)' : 'transparent', color: billingAnnual ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                                Annual {billingAnnual && <span style={{ fontSize: '10px' }}>· Save 20%</span>}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>Core</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>{billingAnnual ? '$7.17' : '$9'}<span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px' }}>AI Brain · Receipt scanner · 2,000 tx/mo · 20 invoices/mo</div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'core_annual' : 'core_monthly')} disabled={!!billingLoading} className="btn primary" style={{ width: '100%', padding: '10px', fontSize: '13px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'core_annual' : 'core_monthly') ? 'Loading...' : 'Upgrade to Core'}
                            </button>
                        </div>
                        <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>Studio</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>{billingAnnual ? '$15.17' : '$19'}<span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px' }}>Everything in Core · Unlimited · Mileage · Priority support</div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'studio_annual' : 'studio_monthly')} disabled={!!billingLoading} className="btn primary glow-blue" style={{ width: '100%', padding: '10px', fontSize: '13px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'studio_annual' : 'studio_monthly') ? 'Loading...' : 'Upgrade to Studio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Paid plan — next billing note */}
            {isPaid && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                    Subscription managed through Stripe · Invoices emailed automatically · Cancel or upgrade anytime via Manage Billing
                </div>
            )}
        </div>
        );
    };

    return (
        <div className="card glass glow-blue" style={{ border: 'none', padding: '40px', margin: 0 }}>
            <div style={{ maxWidth: '850px' }}>
                <BillingSection />
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Business Profile Branding</h2>
                <p className="muted" style={{ fontSize: '15px', marginBottom: '32px' }}>
                    Update your studio identity. These details personalize your invoices and global reporting headers.
                </p>
                <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '30px', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <small className="muted" style={{ fontWeight: 900 }}>LOGO</small>
                            <label className="btn secondary" style={{ display: 'block', marginTop: '8px', cursor: 'pointer', textAlign: 'center' }}>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                {settings.logo_url ? 'Change Logo' : 'Upload Logo'}
                            </label>
                        </div>
                        {settings.logo_url && (
                            <div style={{ width: '120px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <img src={settings.logo_url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                        )}
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>OFFICIAL BUSINESS NAME</small>
                        <input value={settings.business_name || ''} onChange={e => field('business_name', e.target.value)} placeholder="Your Business Name" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>BUSINESS CATEGORY</small>
                        <input value={settings.business_category || ''} onChange={e => field('business_category', e.target.value)} placeholder="Photography Studio" style={{ marginTop: '8px', padding: '15px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>Your primary line of work (e.g. Wedding Photography, Media Production).</div>
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>CONTACT NAME</small>
                        <input value={settings.contact_name || ''} onChange={e => field('contact_name', e.target.value)} placeholder="Your Full Name" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>JOB TITLE</small>
                        <input value={settings.job_title || ''} onChange={e => field('job_title', e.target.value)} placeholder="Your Job Title" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>BUSINESS WEBSITE</small>
                        <input value={settings.website || ''} onChange={e => field('website', e.target.value)} placeholder="yourwebsite.com" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>BUSINESS EMAIL</small>
                        <input type="email" value={settings.email || ''} onChange={e => field('email', e.target.value)} placeholder="hello@example.com" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>BUSINESS PHONE</small>
                        <input value={settings.phone || ''} onChange={e => field('phone', e.target.value)} placeholder="(000) 000-0000" style={{ marginTop: '8px', padding: '15px' }} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>OFFICE ADDRESS</small>
                        <textarea value={settings.address || ''} onChange={e => field('address', e.target.value)} placeholder="Studio Address..." style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>STUDIO TAX ID (EIN/VAT)</small>
                        <input value={settings.tax_id || ''} onChange={e => field('tax_id', e.target.value)} placeholder="XX-XXXXXXX" style={{ marginTop: '8px', padding: '15px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>Shows up on professional tax invoices.</div>
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>IRS ENTITY TYPE</small>
                        <select value={settings.entity_type || 'Sole Proprietorship'} onChange={e => field('entity_type', e.target.value)} style={{ marginTop: '8px', padding: '15px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                            <option value="LLC (Single Member)">LLC (Single Member)</option>
                            <option value="LLC (Multi Member)">LLC (Multi Member)</option>
                            <option value="S-Corp">S-Corp</option>
                            <option value="C-Corp">C-Corp</option>
                            <option value="Partnership">Partnership</option>
                        </select>
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>IRS BUSINESS CODE (NAICS)</small>
                        <input value={settings.naics_code || '711510'} onChange={e => field('naics_code', e.target.value)} placeholder="711510" style={{ marginTop: '8px', padding: '15px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>Standard code for photographers is 711510.</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>GLOBAL INVOICE NOTES</small>
                        <textarea value={settings.invoice_notes || ''} onChange={e => field('invoice_notes', e.target.value)} placeholder="e.g. Thank you for your business!" style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>Standard greeting at the top of the invoice notes section.</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>STANDARD CONTRACT TERMS</small>
                        <textarea value={settings.standard_terms || ''} onChange={e => field('standard_terms', e.target.value)} placeholder="e.g. Net 15, Late fees apply..." style={{ marginTop: '8px', padding: '15px', minHeight: '100px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>General legal or payment terms.</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>ACCEPTED METHODS OF PAYMENT</small>
                        <div className="muted extra-small" style={{ marginTop: '4px', marginBottom: '8px' }}>Custom payment instructions or additional details shown on invoices.</div>
                        <textarea value={settings.payment_methods || ''} onChange={e => field('payment_methods', e.target.value)} placeholder="e.g. Payment due within 14 days. Checks payable to..." style={{ marginTop: '0px', padding: '15px', minHeight: '80px' }} />
                    </div>
                    <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                        <div style={{ padding: '20px 24px', background: 'rgba(56,189,248,0.04)', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.12)' }}>
                            <div style={{ fontWeight: 950, fontSize: '13px', color: '#38bdf8', marginBottom: '20px', letterSpacing: '0.05em' }}>⚡ INSTANT PAYMENT HANDLES</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <small className="muted" style={{ fontWeight: 900 }}>VENMO HANDLE</small>
                                    <input value={settings.venmo_handle || ''} onChange={e => field('venmo_handle', e.target.value)} placeholder="@YourStudio" style={{ marginTop: '8px', padding: '13px' }} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 900 }}>ZELLE (EMAIL OR PHONE)</small>
                                    <input value={settings.zelle_handle || ''} onChange={e => field('zelle_handle', e.target.value)} placeholder="studio@email.com" style={{ marginTop: '8px', padding: '13px' }} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 900 }}>CASHAPP TAG</small>
                                    <input value={settings.cashapp_tag || ''} onChange={e => field('cashapp_tag', e.target.value)} placeholder="$YourCashTag" style={{ marginTop: '8px', padding: '13px' }} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 900 }}>STRIPE PUBLISHABLE KEY</small>
                                    <input
                                        type="password"
                                        value={settings.stripe_publishable_key || ''}
                                        onChange={e => field('stripe_publishable_key', e.target.value)}
                                        placeholder="pk_live_..."
                                        style={{ marginTop: '8px', padding: '13px' }}
                                    />
                                    <div className="muted extra-small" style={{ marginTop: '6px' }}>Publishable key only. Never enter your secret key here.</div>
                                </div>
                            </div>
                            <div className="muted extra-small" style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(249,115,22,0.06)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.15)', color: '#f97316' }}>
                                💡 These handles are shown on your client payment portal when you send an invoice.
                            </div>
                        </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted" style={{ fontWeight: 900 }}>PERSONALIZED SIGNATURE & SOCIALS</small>
                        <textarea value={settings.signature_text || ''} onChange={e => field('signature_text', e.target.value)} placeholder="Your Name, Website, Instagram..." style={{ marginTop: '8px', padding: '15px', minHeight: '100px' }} />
                        <div className="muted small" style={{ marginTop: '8px' }}>Professional sign-off for the bottom of the invoice.</div>
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                        <button type="submit" className="btn primary glow-blue" style={{ padding: '15px 45px', fontSize: '16px' }}>Save Global Identity</button>
                        {msg && <span className={`${msg.includes('Error') ? 'tag bad' : 'tag ok'}`} style={{ fontWeight: 900 }}>{msg}</span>}
                    </div>
                </form>
            </div>
        </div>
    );
}
