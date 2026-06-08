// SecurityReviewTab.jsx — Admin-only security review cadence tracker
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../api';

const TYPE_LABELS = {
    weekly:     'Weekly Check',
    monthly:    'Monthly Audit',
    quarterly:  'Quarterly Deep Review',
    annual:     'Annual Audit',
    dependency: 'npm audit',
};

const TYPE_CHECKLIST = {
    weekly:     ['Scan Vercel + Supabase dashboards for failed auth spikes or unusual API usage', 'Check UptimeRobot for missed downtime events'],
    monthly:    ['Run npm audit in /api and /web-react — fix Critical/High', 'Review Supabase changelog for deprecations', 'Review Vercel build logs for new warnings'],
    quarterly:  ['Run npm outdated in both dirs — update minor/patch, evaluate majors', 'Audit all API routes for unprotected endpoints added this quarter', 'Confirm all new DB tables have RLS policies', 'Rotate POSTMARK_INBOUND_TOKEN and CRON_SECRET', 'Verify Stripe webhook signatures still validating'],
    annual:     ['Full dependency major version audit (React, Express, Supabase SDK, Plaid SDK)', 'Review Terms of Service for payment processor policy changes', 'Re-audit RLS on all tables — schema drift can miss new tables', 'Verify Google OAuth consent screen re-verification status'],
    dependency: ['cd api && npm audit --audit-level=high', 'cd web-react && npm audit --audit-level=high', 'Fix Critical immediately, High same day, review Moderate'],
};

function statusBadge(nextDue) {
    if (!nextDue) return { label: 'NEVER RUN', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    const now = Date.now();
    const due = new Date(nextDue).getTime();
    const diff = due - now;
    if (diff < 0)           return { label: 'OVERDUE',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    if (diff < 3 * 86400000) return { label: 'DUE SOON', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { label: 'OK', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' };
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDue(nextDue, lastCompleted) {
    if (!lastCompleted) return 'Not yet run';
    const d = new Date(nextDue);
    const now = new Date();
    const diffDays = Math.round((d - now) / 86400000);
    if (diffDays < 0)  return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due ${fmtDate(nextDue)}`;
}

export default function SecurityReviewTab() {
    const [reviews, setReviews]         = useState([]);
    const [history, setHistory]         = useState([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [completing, setCompleting]   = useState(null);
    const [expandedType, setExpandedType] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [noteInput, setNoteInput]     = useState('');
    const [confirmType, setConfirmType] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const d = await apiGet('/admin/security-reviews');
            setReviews(d.reviews || []);
            setHistory(d.history || []);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('[SecurityReview] load error:', e.message);
            setError('Could not load security reviews. Ensure the security_reviews migration has been run in Supabase.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleMarkComplete = async (type) => {
        setCompleting(type);
        try {
            await apiPost('/admin/security-reviews/complete', { review_type: type, notes: noteInput || null });
            setConfirmType(null);
            setNoteInput('');
            await load();
        } catch (e) {
            alert('Failed to mark complete: ' + e.message);
        } finally {
            setCompleting(null);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading security reviews…</div>;

    if (error) return (
        <div style={{ padding: '40px', color: '#f87171', fontSize: '14px', lineHeight: 1.6 }}>
            ⚠️ {error}
        </div>
    );

    if (reviews.length === 0) return (
        <div style={{ padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '14px', textAlign: 'center' }}>
            No review data found. Run the <code>security_reviews</code> migration in Supabase to initialize this tab.
        </div>
    );

    const overdueCount = reviews.filter(r => statusBadge(r.nextDue).label !== 'OK').length;

    return (
        <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 900 }}>Security Review Cadence</h2>
                    <div className="muted" style={{ fontSize: '12px' }}>
                        Last refreshed: {lastRefresh ? lastRefresh.toLocaleTimeString() : '—'}
                    </div>
                </div>
                {overdueCount > 0 && (
                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
                        ⚠️ {overdueCount} review{overdueCount > 1 ? 's' : ''} overdue
                    </div>
                )}
            </div>

            {/* Review cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reviews.map(r => {
                    const badge = statusBadge(r.nextDue);
                    const isExpanded = expandedType === r.type;
                    const isConfirming = confirmType === r.type;
                    const isCompleting = completing === r.type;
                    const checklist = TYPE_CHECKLIST[r.type] || [];

                    return (
                        <div key={r.type} className="card glass" style={{ margin: 0, padding: '20px', border: `1px solid ${badge.color}30` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 800, fontSize: '15px' }}>{TYPE_LABELS[r.type]}</span>
                                        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}40`, borderRadius: '5px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '6px', flexWrap: 'wrap' }}>
                                        <span className="muted" style={{ fontSize: '12px' }}>Last: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{fmtDate(r.lastCompleted)}</strong></span>
                                        <span className="muted" style={{ fontSize: '12px', color: badge.color }}>{fmtDue(r.nextDue, r.lastCompleted)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        className="btn sm secondary"
                                        onClick={() => { setExpandedType(isExpanded ? null : r.type); setConfirmType(null); }}
                                        style={{ fontSize: '11px' }}
                                    >
                                        {isExpanded ? 'Hide checklist ▲' : 'Checklist ▼'}
                                    </button>
                                    <button
                                        className="btn sm"
                                        onClick={() => { setConfirmType(isConfirming ? null : r.type); setExpandedType(null); setNoteInput(''); }}
                                        style={{ fontSize: '12px', background: '#4ade8020', border: '1px solid #4ade8050', color: '#4ade80' }}
                                    >
                                        Mark Done ✓
                                    </button>
                                </div>
                            </div>

                            {/* Expandable checklist */}
                            {isExpanded && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Checklist</div>
                                    <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {checklist.map((item, i) => (
                                            <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Mark complete confirm */}
                            {isConfirming && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Add a note (optional):</div>
                                    <input
                                        type="text"
                                        value={noteInput}
                                        onChange={e => setNoteInput(e.target.value)}
                                        placeholder="e.g. npm audit clean, no issues"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px' }}
                                        onKeyDown={e => e.key === 'Enter' && handleMarkComplete(r.type)}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn"
                                            onClick={() => handleMarkComplete(r.type)}
                                            disabled={isCompleting}
                                            style={{ fontSize: '12px', background: '#4ade80', color: '#000', fontWeight: 700 }}
                                        >
                                            {isCompleting ? 'Saving…' : '✓ Confirm Complete'}
                                        </button>
                                        <button className="btn sm secondary" onClick={() => setConfirmType(null)} style={{ fontSize: '12px' }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* History section */}
            <div style={{ marginTop: '28px' }}>
                <button
                    className="btn sm secondary"
                    onClick={() => setShowHistory(v => !v)}
                    style={{ fontSize: '12px', marginBottom: '12px' }}
                >
                    {showHistory ? 'Hide History ▲' : `Completion History (${history.length}) ▼`}
                </button>
                {showHistory && (
                    <div className="card glass" style={{ margin: 0, padding: '16px' }}>
                        {history.length === 0 ? (
                            <div className="muted" style={{ fontSize: '13px' }}>No completions recorded yet.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ textAlign: 'left', padding: '6px 12px 10px 0', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Review</th>
                                        <th style={{ textAlign: 'left', padding: '6px 12px 10px 0', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Completed</th>
                                        <th style={{ textAlign: 'left', padding: '6px 0 10px 0', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>{TYPE_LABELS[h.review_type] || h.review_type}</td>
                                            <td style={{ padding: '8px 12px 8px 0', color: 'rgba(255,255,255,0.6)' }}>{fmtDate(h.completed_at)}</td>
                                            <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.5)', fontStyle: h.notes ? 'normal' : 'italic' }}>{h.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
