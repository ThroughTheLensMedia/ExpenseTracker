import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, formatMoney } from '../api';

// Shown once per calendar month after login — summarises frequent, largest, and uncategorized transactions
const SEEN_KEY = () => `ll_monthly_insights_${new Date().toISOString().slice(0, 7)}`;

export function shouldShowMonthlyInsights() {
    return localStorage.getItem(SEEN_KEY()) !== '1';
}

export function markMonthlyInsightsSeen() {
    localStorage.setItem(SEEN_KEY(), '1');
}

export default function MonthlyInsightsModal({ onClose }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [steps, setSteps] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const now = new Date();
        const year  = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${year}-${month}-01`;
        const end   = now.toISOString().slice(0, 10);
        const monthName = now.toLocaleString('default', { month: 'long' });

        apiGet(`/expenses?start=${start}&end=${end}&limit=500`)
            .then(res => {
                const rows = res?.rows || res?.data || res || [];
                if (rows.length < 3) { markMonthlyInsightsSeen(); onClose(); return; }

                // Step 1 — Most frequent vendors
                const vendorCount = {}, vendorTotal = {};
                for (const e of rows) {
                    const v = (e.vendor || 'Unknown').trim();
                    vendorCount[v] = (vendorCount[v] || 0) + 1;
                    vendorTotal[v] = (vendorTotal[v] || 0) + Number(e.amount_cents || 0);
                }
                const frequent = Object.entries(vendorCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([vendor, count]) => ({
                        vendor,
                        count,
                        avg: Math.round(vendorTotal[vendor] / count),
                    }));

                // Step 2 — Largest transactions
                const largest = [...rows]
                    .sort((a, b) => Number(b.amount_cents) - Number(a.amount_cents))
                    .slice(0, 5);

                // Step 3 — Uncategorized
                const uncategorized = rows.filter(e => !e.category || !e.category.trim());

                const built = [];
                if (frequent.length)      built.push({ type: 'frequent',      monthName, frequent });
                if (largest.length)       built.push({ type: 'largest',       monthName, largest });
                if (uncategorized.length) built.push({ type: 'uncategorized', monthName, uncategorized: uncategorized.slice(0, 5), total: uncategorized.length });

                if (!built.length) { markMonthlyInsightsSeen(); onClose(); return; }
                setSteps(built);
                setLoading(false);
            })
            .catch(() => { markMonthlyInsightsSeen(); onClose(); });
    }, []);

    const handleClose = () => { markMonthlyInsightsSeen(); onClose(); };
    const handleNext  = () => {
        if (step < steps.length - 1) setStep(s => s + 1);
        else handleClose();
    };
    const handleCategorize = () => {
        markMonthlyInsightsSeen();
        navigate('/transactions?needs_category=1');
        onClose();
    };

    if (loading || !steps.length) return null;
    const current = steps[step];
    const isLast  = step === steps.length - 1;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 68px)',
        }} onClick={handleClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '24px', width: '100%', maxWidth: '520px',
                    padding: '28px 24px 0', boxSizing: 'border-box',
                    animation: 'slideUp 0.3s ease-out',
                    maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
                }}
            >
                <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

                {/* Scrollable content area */}
                <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>

                {/* Progress dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{
                            width: i === step ? 20 : 7, height: 7, borderRadius: 4,
                            background: i === step ? '#818cf8' : 'rgba(255,255,255,0.15)',
                            transition: 'all 0.25s',
                        }} />
                    ))}
                </div>

                {/* ── Most Frequent ── */}
                {current.type === 'frequent' && (
                    <>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Your most frequent transactions</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
                            Here are your most repeated purchases from {current.monthName}.
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
                            {current.frequent.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 16px',
                                    borderBottom: i < current.frequent.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(129,140,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🛍</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.vendor}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Average {formatMoney(item.avg)}</div>
                                    </div>
                                    <div style={{ fontWeight: 900, color: '#818cf8', fontSize: 15, flexShrink: 0 }}>{item.count}×</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Largest ── */}
                {current.type === 'largest' && (
                    <>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Your largest transactions</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
                            Here's a summary of your biggest purchases so far this {current.monthName}.
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
                            {current.largest.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 16px',
                                    borderBottom: i < current.largest.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💳</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.vendor || 'Unknown'}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.expense_date}</div>
                                    </div>
                                    <div style={{ fontWeight: 900, color: '#4ade80', fontSize: 15, flexShrink: 0 }}>{formatMoney(Number(item.amount_cents))}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Uncategorized ── */}
                {current.type === 'uncategorized' && (
                    <>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Your uncategorized transactions</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
                            You have <strong style={{ color: '#f97316' }}>{current.total}</strong> uncategorized transaction{current.total !== 1 ? 's' : ''} from {current.monthName}. Categorizing keeps your spending reports and tax deductions accurate.
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
                            {current.uncategorized.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 16px',
                                    borderBottom: i < current.uncategorized.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>❓</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.vendor || 'Unknown'}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.expense_date}</div>
                                    </div>
                                    <div style={{ fontWeight: 900, color: '#f97316', fontSize: 15, flexShrink: 0 }}>{formatMoney(Number(item.amount_cents))}</div>
                                </div>
                            ))}
                            {current.total > 5 && (
                                <div style={{ padding: '10px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'center' }}>
                                    + {current.total - 5} more uncategorized
                                </div>
                            )}
                        </div>
                    </>
                )}

                </div>{/* end scrollable content */}

                {/* CTA buttons — always visible, safe-area aware */}
                <div style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', paddingTop: 12, flexShrink: 0 }}>
                {current.type === 'uncategorized' ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={handleClose}
                            style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                        >
                            Later
                        </button>
                        <button
                            onClick={handleCategorize}
                            style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: '#f97316', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}
                        >
                            Go to Transactions →
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleNext}
                        style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#818cf8', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}
                    >
                        {isLast ? 'Done' : 'Continue'}
                    </button>
                )}

                {/* Skip */}
                {!isLast && (
                    <button onClick={handleClose} style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>
                        Skip monthly summary
                    </button>
                )}
                </div>
            </div>
        </div>
    );
}
