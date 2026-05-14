import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiPost } from '../../api';

const TYPES = ['Bug', 'Idea', 'Question', 'General'];
const TYPE_META = {
    Bug:      { emoji: '🐛', desc: 'Something is broken or behaving unexpectedly.' },
    Idea:     { emoji: '💡', desc: 'A feature request or improvement suggestion.' },
    Question: { emoji: '❓', desc: 'Need help understanding how something works.' },
    General:  { emoji: '💬', desc: 'Anything else on your mind.' },
};

export default function FeedbackTab() {
    const { user } = useAuth();

    const [type, setType] = useState('General');
    const [message, setMessage] = useState('');
    const [includeDiag, setIncludeDiag] = useState(true);
    const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    const buildDiagnostics = () => ({
        userId: user?.id || 'unknown',
        email: user?.email || 'unknown',
        userAgent: navigator.userAgent,
        href: window.location.href,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: navigator.onLine,
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setStatus('sending');
        try {
            await apiPost('/feedback', {
                type,
                message: message.trim(),
                name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Lumière User',
                email: user?.email || 'unknown',
                diagnostics: includeDiag ? buildDiagnostics() : undefined,
            });
            setStatus('ok');
            setMessage('');
        } catch (e) {
            setStatus('error');
            setErrorMsg(e.message || 'Unknown error');
        }
    };

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 950 }}>💬 Feedback</h2>
                <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                    Send bugs, ideas, or questions directly to Joshua. Your message arrives with context automatically attached.
                </p>
            </div>

            {status === 'ok' ? (
                <div className="card glass" style={{ margin: 0, padding: '32px', textAlign: 'center', border: '1px solid rgba(74,222,128,0.3)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                    <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '8px' }}>Feedback sent.</div>
                    <p className="muted" style={{ margin: '0 0 20px', fontSize: '13px' }}>It went straight to Joshua's inbox with your diagnostic info.</p>
                    <button className="btn secondary" style={{ fontSize: '13px', padding: '8px 20px' }} onClick={() => setStatus(null)}>
                        Send Another
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Type selector */}
                    <div>
                        <small className="muted" style={{ fontWeight: 800, display: 'block', marginBottom: '10px' }}>TYPE</small>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {TYPES.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: `1px solid ${type === t ? 'rgba(99,102,241,0.7)' : 'var(--line)'}`,
                                        background: type === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: type === t ? '#818cf8' : 'var(--muted)',
                                        fontWeight: type === t ? 900 : 600,
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        transition: 'all 0.15s',
                                    }}
                                >{TYPE_META[t].emoji} {t}</button>
                            ))}
                        </div>
                        <p className="muted" style={{ margin: '8px 0 0', fontSize: '12px' }}>{TYPE_META[type].desc}</p>
                    </div>

                    {/* Message */}
                    <div>
                        <small className="muted" style={{ fontWeight: 800, display: 'block', marginBottom: '8px' }}>MESSAGE</small>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={
                                type === 'Bug'      ? "Describe what happened vs. what you expected…" :
                                type === 'Idea'     ? "Describe your idea and the problem it solves…" :
                                type === 'Question' ? "What do you need help understanding?" :
                                "What's on your mind?"
                            }
                            required
                            rows={6}
                            style={{ width: '100%', resize: 'vertical', fontSize: '14px', lineHeight: 1.6, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <span className="muted" style={{ fontSize: '11px' }}>{message.length} chars</span>
                        </div>
                    </div>

                    {/* From */}
                    <div className="card glass" style={{ margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)' }}>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>Sending as</div>
                            <div className="muted" style={{ fontSize: '12px' }}>{user?.email || 'unknown'}</div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                            <input type="checkbox" checked={includeDiag} onChange={e => setIncludeDiag(e.target.checked)} style={{ width: 'auto' }} />
                            Include diagnostics
                        </label>
                    </div>

                    {status === 'error' && (
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)', fontSize: '13px', color: '#ff4d4d' }}>
                            ❌ {errorMsg} — check your connection and try again.
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn glow-blue"
                        disabled={status === 'sending' || !message.trim()}
                        style={{ alignSelf: 'flex-start', fontWeight: 900, fontSize: '14px', padding: '12px 28px', opacity: (!message.trim() || status === 'sending') ? 0.6 : 1 }}
                    >
                        {status === 'sending' ? 'Sending…' : '📤 Send Feedback'}
                    </button>
                </form>
            )}
        </div>
    );
}
