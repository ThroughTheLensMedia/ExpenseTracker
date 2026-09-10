import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiPost } from '../../api';
import ChangeLogModal from './ChangeLogModal.jsx';

const FB_TYPES = ['Bug', 'Idea', 'Question', 'General'];
const FB_META = {
    Bug:      { emoji: '🐛', desc: 'Something is broken or behaving unexpectedly.' },
    Idea:     { emoji: '💡', desc: 'A feature request or improvement suggestion.' },
    Question: { emoji: '❓', desc: 'Need help understanding how something works.' },
    General:  { emoji: '💬', desc: 'Anything else on your mind.' },
};

export default function HelpTab() {
    const { user } = useAuth();
    const [showChangeLog, setShowChangeLog] = useState(false);

    // Feedback form state
    const [fbType, setFbType] = useState('General');
    const [fbMessage, setFbMessage] = useState('');
    const [fbDiag, setFbDiag] = useState(true);
    const [fbStatus, setFbStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
    const [fbError, setFbError] = useState('');

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        if (!fbMessage.trim()) return;
        setFbStatus('sending');
        try {
            await apiPost('/feedback', {
                type: fbType,
                message: fbMessage.trim(),
                name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Lumière User',
                email: user?.email || 'unknown',
                diagnostics: fbDiag ? {
                    userId: user?.id || 'unknown',
                    email: user?.email || 'unknown',
                    userAgent: navigator.userAgent,
                    href: window.location.href,
                    timestamp: new Date().toISOString(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    online: navigator.onLine,
                } : undefined,
            });
            setFbStatus('ok');
            setFbMessage('');
        } catch (err) {
            setFbStatus('error');
            setFbError(err.message || 'Unknown error');
        }
    };

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
        <div style={{ display: 'grid', gap: 16 }}>
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="help-getting-started-heading">
                <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 10 }}>
                    <div style={{ maxWidth: 720 }}>
                        <h2 id="help-getting-started-heading" style={{ fontSize: 20, margin: 0 }}>Get started with Lumière</h2>
                        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>Set up the core parts of your business workspace in a practical order.</p>
                    </div>
                    <div className="controls" style={{ alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => window.dispatchEvent(new CustomEvent('ll:reopen-onboarding'))}
                        >
                            Resume setup checklist
                        </button>
                        <button type="button" className="btn secondary" onClick={() => setShowChangeLog(true)}>View change log</button>
                    </div>
                </div>

                <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                    {steps.map(s => (
                        <section key={s.num} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.02)' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                                <div className="tag accent" style={{ width: 30, height: 30, justifyContent: 'center', padding: 0 }}>{s.num}</div>
                                <h3 style={{ margin: 0, fontSize: 16 }}>{s.title}</h3>
                            </div>
                            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{s.text}</p>
                        </section>
                    ))}
                </div>
            </section>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="help-faq-heading">
                <h2 id="help-faq-heading" style={{ fontSize: 20, margin: '0 0 18px' }}>Frequently asked questions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 12 }}>
                    {faqs.map((f, i) => (
                        <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.02)' }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>{f.q}</div>
                            <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{f.a}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Legal & Compliance */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="help-policies-heading">
                <h2 id="help-policies-heading" style={{ fontSize: 20, margin: 0 }}>Policies and account information</h2>
                <p className="muted" style={{ maxWidth: 720, fontSize: 14, lineHeight: 1.55, margin: '8px 0 18px' }}>
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
                            className="btn secondary"
                            style={{
                                color: '#38bdf8',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View policy
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
                            className="btn secondary"
                            style={{
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View policy
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
                            className="btn secondary"
                            style={{
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View policy
                        </a>
                    </div>
                </div>
            </section>

            {showChangeLog && <ChangeLogModal onClose={() => setShowChangeLog(false)} />}

            {/* Feedback Section */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="help-feedback-heading">
                <h2 id="help-feedback-heading" style={{ margin: 0, fontSize: 20 }}>Send feedback</h2>
                <p className="muted" style={{ margin: '8px 0 20px', fontSize: 14, lineHeight: 1.55 }}>
                    Report a problem, share an idea, or ask a question. Your message goes directly to Lumière Ledger support.
                </p>

                {fbStatus === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ fontWeight: 900, fontSize: '15px', marginBottom: '6px' }}>Feedback sent.</div>
                        <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Lumière Ledger support received your message.</p>
                        <button type="button" className="btn secondary" onClick={() => setFbStatus(null)}>Send another</button>
                    </div>
                ) : (
                    <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {FB_TYPES.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    aria-pressed={fbType === t}
                                    onClick={() => setFbType(t)}
                                    style={{
                                        padding: '7px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: fbType === t ? 900 : 600,
                                        border: `1px solid ${fbType === t ? 'rgba(99,102,241,0.7)' : 'var(--line)'}`,
                                        background: fbType === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: fbType === t ? '#818cf8' : 'var(--muted)',
                                    }}
                                ><span aria-hidden="true">{FB_META[t].emoji}</span> {t}</button>
                            ))}
                        </div>
                        <div>
                            <textarea
                                aria-label="Feedback message"
                                value={fbMessage}
                                onChange={e => setFbMessage(e.target.value)}
                                placeholder={
                                    fbType === 'Bug'      ? "Describe what happened vs. what you expected…" :
                                    fbType === 'Idea'     ? "Describe your idea and the problem it solves…" :
                                    fbType === 'Question' ? "What do you need help understanding?" :
                                    "What's on your mind?"
                                }
                                required
                                rows={5}
                                style={{ width: '100%', resize: 'vertical', fontSize: '14px', lineHeight: 1.6, boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                                <span className="muted" style={{ fontSize: '11px' }}>{FB_META[fbType].desc}</span>
                                <span className="muted" style={{ fontSize: '11px' }}>{fbMessage.length} chars</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                <input type="checkbox" checked={fbDiag} onChange={e => setFbDiag(e.target.checked)} style={{ width: 'auto' }} />
                                Include browser and account diagnostics
                            </label>
                            {fbStatus === 'error' && (
                                <span role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{fbError}</span>
                            )}
                            <button
                                type="submit"
                                className="btn glow-blue"
                                disabled={fbStatus === 'sending' || !fbMessage.trim()}
                                style={{ fontWeight: 900, fontSize: '13px', padding: '10px 24px', opacity: (!fbMessage.trim() || fbStatus === 'sending') ? 0.6 : 1 }}
                            >
                                {fbStatus === 'sending' ? 'Sending…' : 'Send feedback'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
