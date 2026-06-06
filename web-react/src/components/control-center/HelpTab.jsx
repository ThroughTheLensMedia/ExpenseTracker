import React, { useState } from 'react';
import ChangeLogModal from './ChangeLogModal.jsx';

export default function HelpTab() {
    const [showChangeLog, setShowChangeLog] = useState(false);

    const steps = [
        { num: 1, title: 'Claim Your Identity', text: 'Navigate to the Business Profile tab. Upload your logo and fill out your business details. This information is used to professionally brand your invoices and set your tax jurisdiction.' },
        { num: 2, title: 'Initialize the Ledger', text: 'Go to the Import page. Download your transaction history from Rocket Money or your bank as a "Generic CSV". Upload it here to seed your ledger with data. The system will handle duplicate detection automatically.' },
        { num: 3, title: 'Train the Brain (Automation)', text: 'Visit the Automation tab. Here you can create "Rules". For example, if a vendor contains "Adobe", always assign it to "Software & Subscriptions". Once saved, click "Run Engine" to apply these rules to your entire history.' },
        { num: 4, title: 'Audit Your Infrastructure', text: 'Log your gear in the Equipment section. This tracks your Section 179 depreciation and serial numbers for insurance purposes. A healthy business is a documented business.' },
        { num: 5, title: 'Manage the Pipeline', text: 'Use the CRM to track new leads. When a project is booked, create an Invoice directly from the lead. The system will use your Business Profile to generate a professional PDF and track the payment status.' },
    ];

    const faqs = [
        { q: 'How do I extend my ledger access?', a: 'In the Infrastructure tab, you can redeem a 12-digit Beta or Pro key. This will instantly update your expiration date in the header.' },
        { q: 'Is my data shared with other users?', a: 'Absolutely not. The platform uses Row Level Security (RLS) within our cloud database, meaning your data is cryptographically isolated to your unique User ID.' },
        { q: 'How does the AI Brain work?', a: 'By using a "Bring Your Own Key" model, every Lumière Ledger user has their own private intelligence instance. This ensures your financial data is never trained on by others, your processing costs are zero for the platform, and your "First-Class" advisor analyzes ONLY your specific data.' },
        { q: 'Can I export my data if I leave?', a: 'Yes. You can download a "Master Business Archive" (.json) at any time from the Infrastructure tab to keep your own backups.' },
        { q: 'How do I disconnect my bank from Plaid?', a: 'Go to the Accounts page and locate your connected bank in the 🔗 Live Sync section at the top. Click the red "Unsync" button on the right side of the card, then confirm when prompted. This immediately revokes Plaid\'s access to your bank data and stops future sync fees. Your existing imported transactions are kept in your ledger — they are not deleted when you disconnect.' },
        { q: 'How do I delete my account and all my data?', a: 'To permanently delete your account and all associated data, email support@throughthelens.media with the subject line "Account Deletion Request" and include the email address associated with your account. We will delete your profile, transactions, receipts, invoices, and all stored data within 5 business days and send a confirmation. Note: deletion is permanent and cannot be undone. Export your data first from the Infrastructure tab if you need a copy.' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1400px' }}>
            <div className="card glass glow-blue" style={{ border: 'none', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '10px' }}>
                    <div>
                        <h2 style={{ fontSize: '2.2rem', margin: 0 }}>Ledger Onboarding Guide</h2>
                        <p className="muted" style={{ fontSize: '18px' }}>Follow these steps to transition your business into full automation.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            className="pill"
                            onClick={() => window.dispatchEvent(new CustomEvent('ll:reopen-onboarding'))}
                            style={{ background: 'var(--accent)', color: 'black', fontWeight: 800, border: 'none' }}
                        >
                            📋 Resume Setup Checklist →
                        </button>
                        <button className="pill" onClick={() => setShowChangeLog(true)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>📙 CHANGE LOG</button>
                    </div>
                </div>

                <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {steps.map(s => (
                        <section key={s.num}>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>{s.num}</div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{s.title}</h3>
                            </div>
                            <p className="muted" style={{ lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: s.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </section>
                    ))}
                </div>
            </div>

            <div className="card glass" style={{ border: 'none', padding: '40px' }}>
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 20px 0' }}>Frequently Asked Questions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {faqs.map((f, i) => (
                        <div key={i}>
                            <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>{f.q}</div>
                            <div className="muted" style={{ fontSize: '14px' }}>{f.a}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legal & Compliance */}
            <div className="card glass" style={{ border: 'none', padding: '40px' }}>
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 8px 0' }}>Legal &amp; Compliance</h2>
                <p className="muted" style={{ fontSize: '14px', marginBottom: '28px' }}>
                    Official policy documents governing how Lumière Ledger handles your data,
                    maintains security, and integrates with financial services.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* ISP */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '12px',
                        padding: '18px 22px',
                        background: 'rgba(56,189,248,0.06)',
                        border: '1px solid rgba(56,189,248,0.18)',
                        borderRadius: '10px'
                    }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: 'white', marginBottom: '4px' }}>
                                Information Security Policy
                            </div>
                            <div className="muted" style={{ fontSize: '13px' }}>
                                Covers access controls, encryption, incident response, data classification,
                                and vendor risk management — including Plaid bank connectivity.
                            </div>
                        </div>
                        <a
                            href="/security-policy"
                            className="pill"
                            style={{
                                background: 'rgba(56,189,248,0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56,189,248,0.35)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View ↗
                        </a>
                    </div>

                    {/* Privacy Policy */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '12px',
                        padding: '18px 22px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px'
                    }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: 'white', marginBottom: '4px' }}>
                                Privacy Policy
                            </div>
                            <div className="muted" style={{ fontSize: '13px' }}>
                                How we collect, use, store, and protect your personal and financial data.
                            </div>
                        </div>
                        <a
                            href="/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pill"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.6)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View ↗
                        </a>
                    </div>

                    {/* Terms */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '12px',
                        padding: '18px 22px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px'
                    }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: 'white', marginBottom: '4px' }}>
                                Terms of Service
                            </div>
                            <div className="muted" style={{ fontSize: '13px' }}>
                                Acceptable use, subscription terms, and platform service agreement.
                            </div>
                        </div>
                        <a
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pill"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.6)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View ↗
                        </a>
                    </div>
                </div>
            </div>

            {showChangeLog && <ChangeLogModal onClose={() => setShowChangeLog(false)} />}
        </div>
    );
}
