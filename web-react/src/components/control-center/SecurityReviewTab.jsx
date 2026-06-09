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

// Each checklist item: { text, subs? }
// Each sub: { cmd? } for terminal commands, { link, label } for clickable links, { note } for plain text
const TYPE_CHECKLIST = {
    weekly: [
        { text: 'Check for failed auth spikes or unusual API usage', subs: [
            { link: 'https://vercel.com/through-the-lens-media/expense-tracker/logs', label: 'Vercel Runtime Logs' },
            { link: 'https://supabase.com/dashboard/projects', label: 'Supabase Auth Logs → Auth → Logs' },
        ]},
        { text: 'Check UptimeRobot for missed downtime events', subs: [
            { link: 'https://dashboard.uptimerobot.com', label: 'UptimeRobot Dashboard' },
        ]},
    ],
    monthly: [
        { text: 'Run npm audit in /api and /web-react — fix Critical/High', subs: [
            { cmd: 'cd api && npm audit --audit-level=high' },
            { cmd: 'cd web-react && npm audit --audit-level=high' },
        ]},
        { text: 'Review Supabase changelog for deprecations', subs: [
            { link: 'https://supabase.com/changelog', label: 'Supabase Changelog' },
        ]},
        { text: 'Review Vercel build logs for new warnings', subs: [
            { link: 'https://vercel.com/through-the-lens-media/expense-tracker/deployments', label: 'Vercel Deployments' },
        ]},
    ],
    quarterly: [
        { text: 'Run npm outdated in both dirs — update minor/patch, evaluate majors', subs: [
            { cmd: 'cd api && npm outdated' },
            { cmd: 'cd web-react && npm outdated' },
        ]},
        { text: 'Audit all API routes for unprotected endpoints added this quarter', subs: [
            { note: 'Review api/routes/ — look for routes missing requireAuth or requireRole middleware' },
        ]},
        { text: 'Confirm all new DB tables have RLS policies', subs: [
            { link: 'https://supabase.com/dashboard/projects', label: 'Supabase → Auth → Policies' },
        ]},
        { text: 'Rotate POSTMARK_INBOUND_TOKEN and CRON_SECRET', subs: [
            { link: 'https://vercel.com/through-the-lens-media/expense-tracker/settings/environment-variables', label: 'Vercel Env Variables' },
            { link: 'https://account.postmarkapp.com', label: 'Postmark Account' },
        ]},
        { text: 'Verify Stripe webhook signatures still validating', subs: [
            { link: 'https://dashboard.stripe.com/webhooks', label: 'Stripe Webhooks Dashboard' },
        ]},
        { text: 'Code Drift Audit — phantom tables: every .from(\'table\') in api/ must exist in Supabase', subs: [
            { cmd: "grep -rhoE \"\\.from\\('[a-z_]+'\\)\" api/routes api/utils | sort -u" },
            { note: 'Compare list against live schema (Supabase → Table Editor). A table queried in code but missing from the schema fails silently — root cause of the v7.10.1 profiles bug.' },
        ]},
        { text: 'Code Drift Audit — silent DB failures: writes that never check { error }', subs: [
            { cmd: "grep -rnE \"^\\s*await (supabase|serviceClient|adminClient|req\\.sb)\\.from\\(\" api/routes api/utils" },
            { note: 'Any await .from().update/delete/upsert/insert NOT assigned to a variable is silent — Supabase returns { error }, never throws. Root cause of the v7.10.2 Stripe webhook fix.' },
        ]},
        { text: 'Code Drift Audit — stale hardcoded value lists (plan types, statuses)', subs: [
            { cmd: "grep -rn \"core_monthly\\|beta_tester\\|lifetime\" api/routes web-react/src | grep -v node_modules | grep -v \".test.\"" },
            { note: 'Every hardcoded plan_type/status list must include legacy values (annual, monthly, pro, elite, free_beta) — root cause of the v7.10.0 tier badge bug.' },
        ]},
    ],
    annual: [
        { text: 'Full dependency major version audit', subs: [
            { cmd: 'cd api && npm outdated' },
            { cmd: 'cd web-react && npm outdated' },
            { note: 'Evaluate: React, Express, Supabase SDK, Plaid SDK — check breaking changes before upgrading' },
        ]},
        { text: 'Review Terms of Service for payment processor policy changes', subs: [
            { link: 'https://stripe.com/legal/ssa', label: 'Stripe Services Agreement' },
            { link: 'https://plaid.com/legal/', label: 'Plaid Legal' },
        ]},
        { text: 'Re-audit RLS on all Supabase tables', subs: [
            { link: 'https://supabase.com/dashboard/projects', label: 'Supabase → Auth → Policies' },
            { note: 'Schema drift can leave new tables without RLS — check any table added since last audit' },
        ]},
        { text: 'Verify Google OAuth consent screen re-verification status', subs: [
            { link: 'https://console.cloud.google.com/apis/credentials/consent', label: 'Google Cloud Console → OAuth Consent Screen' },
        ]},
    ],
    dependency: [
        { text: 'Run npm audit in /api — fix Critical and High immediately', subs: [
            { cmd: 'cd api && npm audit --audit-level=high' },
            { cmd: 'cd api && npm audit fix' },
        ]},
        { text: 'Run npm audit in /web-react — fix Critical and High immediately', subs: [
            { cmd: 'cd web-react && npm audit --audit-level=high' },
            { cmd: 'cd web-react && npm audit fix' },
        ]},
        { text: 'Severity guide', subs: [
            { note: 'Critical → fix immediately' },
            { note: 'High → fix same day' },
            { note: 'Moderate → review and schedule' },
            { note: 'Low → log and monitor' },
        ]},
    ],
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
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Checklist</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {checklist.map((item, i) => (
                                            <div key={i}>
                                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: item.subs?.length ? '8px' : 0 }}>
                                                    {item.text}
                                                </div>
                                                {item.subs?.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '14px', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                                                        {item.subs.map((sub, j) => (
                                                            <div key={j}>
                                                                {sub.cmd && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <code style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '5px 10px', fontSize: '12px', color: '#a5f3fc', fontFamily: 'monospace', whiteSpace: 'pre' }}>{sub.cmd}</code>
                                                                        <button
                                                                            onClick={() => navigator.clipboard.writeText(sub.cmd)}
                                                                            style={{ flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '5px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                                            title="Copy to clipboard"
                                                                        >Copy</button>
                                                                    </div>
                                                                )}
                                                                {sub.link && (
                                                                    <a href={sub.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        ↗ {sub.label}
                                                                    </a>
                                                                )}
                                                                {sub.note && (
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>— {sub.note}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
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
