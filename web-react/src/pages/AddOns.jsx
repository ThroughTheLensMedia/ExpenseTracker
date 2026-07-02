// AddOns.jsx — Lumière Ledger Add-On Marketplace
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Globe, Handshake, PenLine } from 'lucide-react';

const ADDONS = [
    {
        id: 'website-lead-capture',
        icon: Link2,
        name: 'Website Lead Capture',
        tagline: 'Route booking requests from your photography website directly into your CRM pipeline.',
        status: 'available',
        accentColor: '#38bdf8',
        features: [
            'Instant lead delivery — no polling, no delay',
            'Auto-creates client records with deduplication',
            'Returning client detection links to existing profile',
            'Real-time in-app badge + toast notification',
            'Multi-key support — connect multiple websites',
            'Works with any website, Cloudflare Workers, or backend',
        ],
        cta: 'Set Up Integration',
        ctaPath: '/StudioControlCenter?tab=integration',
    },
    {
        id: 'website-builder',
        icon: Globe,
        name: 'Photography Website Builder',
        tagline: 'A conversion-optimized website for photographers — built, hosted, and pre-wired to Lumière Ledger.',
        status: 'coming_soon',
        accentColor: '#f97316',
        features: [
            'Professional portfolio layout tailored to photographers',
            'Built-in booking form connected to your CRM',
            'Cloudflare Pages hosting with global CDN',
            'Turnstile bot protection included',
            'Custom domain support',
            'One-click Lumière Ledger sync — no setup required',
        ],
        cta: 'Visit Website Service',
        ctaPath: null,
        ctaExternal: 'https://websites.throughthelens.media',
    },
    {
        id: 'client-portal',
        icon: Handshake,
        name: 'Client Portal',
        tagline: 'Give clients a self-service portal to review invoices, approve quotes, and download deliverables.',
        status: 'coming_soon',
        accentColor: '#818cf8',
        features: [
            'Branded portal at your custom domain',
            'Invoice review and one-click payment',
            'Deliverable download with expiry links',
            'Approval workflow for quotes and contracts',
            'Automatic status updates synced to your CRM',
        ],
        cta: null,
    },
    {
        id: 'contract-esign',
        icon: PenLine,
        name: 'Contract E-Sign',
        tagline: 'Send legally binding contracts directly from a lead or invoice — signed, logged, and stored.',
        status: 'coming_soon',
        accentColor: '#34d399',
        features: [
            'Pre-built photography contract templates',
            'One-click send from CRM pipeline or invoice',
            'Legally binding e-signature collection',
            'Signed PDF stored to client record',
            'Automated follow-up reminders',
        ],
        cta: null,
    },
];

export default function AddOns() {
    const navigate = useNavigate();

    return (
        <section className="dashboard" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '8px', color: '#f97316' }}>Add-Ons</h1>
                <div className="muted" style={{ fontWeight: 600, fontSize: '15px', maxWidth: '560px', margin: '0 auto' }}>
                    Extend Lumière Ledger with purpose-built tools for photographers and videographers.
                </div>
            </div>

            {/* Add-On Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: '24px' }}>
                {ADDONS.map(addon => (
                    <div
                        key={addon.id}
                        className="card glass"
                        style={{ margin: 0, padding: '32px', borderTop: `4px solid ${addon.accentColor}`, display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        {/* Title row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <addon.icon size={32} style={{ color: addon.accentColor, flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 950, fontSize: '1.15rem' }}>{addon.name}</div>
                                    <div className="muted" style={{ fontSize: '13px', marginTop: '4px', maxWidth: '380px' }}>{addon.tagline}</div>
                                </div>
                            </div>
                            {addon.status === 'available' ? (
                                <span style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    AVAILABLE
                                </span>
                            ) : (
                                <span style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: '#f97316', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    COMING SOON
                                </span>
                            )}
                        </div>

                        {/* Feature list */}
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {addon.features.map(f => (
                                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px' }}>
                                    <span style={{ color: addon.accentColor, fontWeight: 900, marginTop: '1px', flexShrink: 0 }}>✓</span>
                                    <span style={{ color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        {addon.cta ? (
                            <button
                                className="btn glow-blue"
                                onClick={() => addon.ctaExternal ? window.open(addon.ctaExternal, '_blank', 'noopener,noreferrer') : navigate(addon.ctaPath)}
                                style={{ alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 900, marginTop: '4px' }}
                            >
                                {addon.cta} →
                            </button>
                        ) : (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                                In development — stay tuned.
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
