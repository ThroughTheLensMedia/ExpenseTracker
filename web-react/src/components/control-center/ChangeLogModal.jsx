import React from 'react';

const RELEASES = [
    { version: '4.0.0-PRO', date: 'MARCH 18, 2026', color: 'var(--accent)', items: [
        '<strong>Your Assistant:</strong> Initial release of the floating AI assistant for real-time financial consultation.',
        '<strong>Gemini 1.5 Flash:</strong> Migrated whole-studio intelligence to the latest Google Flash model for 2x speed.',
        '<strong>Privacy Lockdown:</strong> Implemented Row Level Security (RLS) for AI settings; bringing "your own key" now isolates data.',
        '<strong>Dashboard Grid:</strong> Precision calibration for Intelligence cards (9-card desktop grid).',
        '<strong>Smart Recurring:</strong> Improved detection patterns for operational burn that ignores one-off equipment transfers.',
    ]},
    { version: '3.9.3-SAAS', date: 'MARCH 16, 2026', color: 'var(--accent)', items: [
        '<strong>Pro Entry Integrated:</strong> Released Google OAuth (One-Tap login) as the primary studio entry method.',
        '<strong>Automated Expiration Logic:</strong> Studio licenses now auto-recalculate (Annual 365D, Pro 999D) upon plan change.',
        '<strong>Identity Fix:</strong> Resolved sync issue between License Records and Profiles; display names now persist correctly.',
        '<strong>Pulse Resilience:</strong> Switched engagement telemetry to Service Layer to ensure 100% visibility in SaaS Dashboard regardless of RLS.',
        '<strong>Smarter Bills:</strong> Improved detection patterns for operational overhead (Fitness, Software, Licenses).',
    ]},
    { version: '3.8-SAAS', date: 'MARCH 14, 2026', color: 'var(--accent)', items: [
        '<strong>SaaS Control Center:</strong> Integrated real-time engagement pulse and user activity reporting.',
        '<strong>Enhanced User Mgmt:</strong> Added ability to edit invites and active session details (name, plan type).',
        '<strong>License Health:</strong> Visual color-coded alerts (Green/Yellow/Red) for expiring access sessions.',
        '<strong>Auto-Update Core:</strong> Aggressive cache-busting and version synchronization for all users.',
        '<strong>Cloud Parity:</strong> Fully decommissioned NAS modules in favor of Supabase/Vercel resilience.',
    ]},
    { version: '3.7-ELITE', date: 'MARCH 13, 2026', color: '#fff', items: [
        '<strong>Documentation Refresh:</strong> Integrated the "Change Log" repository for real-time feature tracking.',
        '<strong>Widescreen Optimization:</strong> Expanded Onboarding and FAQ containers to 1400px for better data density.',
        '<strong>Branding Evolution:</strong> Increased "STUDIO TRACKER" brand presence in the primary command bar.',
        '<strong>Executive Symmetry:</strong> Precision grid calibration for dashboard controls (CHARTS, YEAR, SYNC).',
        '<strong>Dual Trajectory:</strong> Split profitability tracking into dual modules for "Margin %" and "Net Income Pulse".',
        '<strong>Inventory Density:</strong> Optimized Equipment Locker for 40% higher visibility per scroll.',
    ]},
    { version: '3.6.1-PWA', date: 'MARCH 12, 2026', color: '#fff', items: [
        '<strong>Mobile Command Bar:</strong> Initial release of the PWA bottom navigation for field usage.',
        '<strong>Visual Pulse:</strong> Added color-coded "Data Age" indicators to ensure sync health.',
        '<strong>Performance:</strong> Global implementation of <code>fadeIn</code> page transitions.',
    ]},
    { version: '3.5', date: 'MARCH 11, 2026', color: '#fff', items: [
        '<strong>Pipeline-to-Invoice:</strong> Direct lead conversion engine for rapid billing.',
        '<strong>Receipt Forensics:</strong> Integrated file storage for equipment serialized assets.',
        '<strong>Security Core:</strong> Role-based restriction for administrator-only studio management.',
    ]},
];

export default function ChangeLogModal({ onClose }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '700px', padding: '40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>System Intelligence Update Log</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                        {RELEASES.map(r => (
                            <section key={r.version}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                    <div style={{ fontWeight: 950, fontSize: '1.4rem', color: r.color }}>{r.version}</div>
                                    <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>{r.date}</div>
                                </div>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                    {r.items.map((item, i) => (
                                        <li key={i} style={{ fontSize: '14px', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: item }} />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>
                <button className="btn primary glow-blue" onClick={onClose} style={{ marginTop: '30px', width: '100%', padding: '15px' }}>CLOSE UPDATES</button>
            </div>
        </div>
    );
}
