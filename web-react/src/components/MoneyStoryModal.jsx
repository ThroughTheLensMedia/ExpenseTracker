import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Repeat, Flag, X } from 'lucide-react';
import { apiGet, apiPost, formatMoney } from '../api';
import ModalShell from './ModalShell.jsx';

/* ───────────────────────────────────────────────────────────────────────────
   Money Story — shown after a successful CSV import or Plaid sync.
   Summarizes what Lumière found: likely deductions, active subscriptions,
   and transactions flagged for review. Opt-out persists to settings
   (money_story_optout) so it survives device switches.
─────────────────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, color, value, label, sub, onClick, loading }) {
    return (
        <button
            onClick={onClick}
            className="glass"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 14px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 110 }}
        >
            <Icon size={18} style={{ color }} />
            {loading ? (
                <span className="skeleton" style={{ width: 64, height: 22, borderRadius: 6 }} />
            ) : (
                <span className="money" style={{ fontSize: 20, fontWeight: 900, color }}>{value}</span>
            )}
            <span style={{ fontSize: 11, fontWeight: 800, color: 'white', lineHeight: 1.3 }}>{label}</span>
            {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{sub}</span>}
        </button>
    );
}

export default function MoneyStoryModal({ importResult = {}, onClose }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [hidden, setHidden] = useState(false); // user opted out previously
    const [optOut, setOptOut] = useState(false);
    const [stats, setStats] = useState({ deductibleCents: 0, subCount: 0, subMonthlyCents: 0, flagged: 0 });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const year = new Date().getFullYear();
                const [settings, tax, metrics] = await Promise.all([
                    apiGet('/settings').catch(() => ({})),
                    apiGet(`/tax/summary?year=${year}`).catch(() => null),
                    apiGet(`/metrics/summary?year=${year}`).catch(() => null),
                ]);
                if (cancelled) return;
                if (settings?.money_story_optout) { setHidden(true); onClose?.(); return; }

                const deductibleCents = (tax?.totals || []).reduce((s, t) => s + Number(t.deductible_cents || 0), 0);
                const subs = (metrics?.recurringVendors || []).filter(v => v?.flags?.isSubscription);
                const subMonthlyCents = subs.reduce((s, v) => s + Number(v.avgMonthlyCents || 0), 0);
                const flagged = Number(importResult.flagged || 0);
                setStats({ deductibleCents, subCount: subs.length, subMonthlyCents, flagged });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function dismiss() {
        if (optOut) {
            try { await apiPost('/settings', { money_story_optout: true }); } catch { /* non-blocking */ }
        }
        onClose?.();
    }

    function go(path) {
        onClose?.();
        navigate(path);
    }

    if (hidden) return null;

    const imported = Number(importResult.inserted ?? importResult.added ?? importResult.synced ?? 0);
    const merged = Number(importResult.merged ?? importResult.linked ?? 0);

    return (
        <ModalShell accent="#4c7dff">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'white' }}>Your Money Story</h2>
                <button onClick={dismiss} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                    <X size={18} />
                </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, margin: '0 0 20px', lineHeight: 1.6 }}>
                {imported > 0 ? `${imported.toLocaleString()} transactions imported` : 'Import complete'}
                {merged > 0 ? `, ${merged.toLocaleString()} matched to existing entries` : ''}. Here's what Lumière sees in your ledger:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                <StatCard
                    icon={Sparkles} color="#fcd34d" loading={loading}
                    value={formatMoney(stats.deductibleCents)}
                    label="Likely deductions" sub="this year"
                    onClick={() => go('/tax')}
                />
                <StatCard
                    icon={Repeat} color="#38bdf8" loading={loading}
                    value={String(stats.subCount)}
                    label="Recurring subscriptions"
                    sub={stats.subMonthlyCents > 0 ? `≈ ${formatMoney(stats.subMonthlyCents)}/mo` : null}
                    onClick={() => go('/')}
                />
                <StatCard
                    icon={Flag} color="#f97316" loading={loading}
                    value={String(stats.flagged)}
                    label="Flagged for review" sub="possible duplicates"
                    onClick={() => go('/transactions')}
                />
            </div>

            <button onClick={dismiss} className="btn" style={{ width: '100%', padding: '13px', fontSize: 14 }}>
                Got it — take me to my ledger
            </button>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={optOut} onChange={e => setOptOut(e.target.checked)} style={{ width: 14, height: 14 }} />
                Don't show this after future imports
            </label>
        </ModalShell>
    );
}
