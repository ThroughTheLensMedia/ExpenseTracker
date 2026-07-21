import React from 'react';

// Safe cents→dollar formatter — never shows "$NaN" if a value is missing.
const fmtCents = (cents) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format((cents || 0) / 100);

export const SectionHeader = () => (
    <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
        <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Operational Intelligence</h2>
            <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Recurring Vendors & Subscription Leakage</div>
        </div>
    </div>
);

export const ControlSummaryPanel = ({ summary, activeFilter, onChangeFilter }) => {
    const isSubActive = activeFilter === 'subscription';
    
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div 
                onClick={() => onChangeFilter && onChangeFilter(isSubActive ? 'all' : 'subscription')}
                style={{ cursor: 'pointer', padding: '15px', background: isSubActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)', border: isSubActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
            >
                <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Active Subscriptions</div>
                <div style={{ fontWeight: 900, color: 'white', fontSize: '24px', marginTop: '4px' }}>{summary.active_count}</div>
            </div>
            
            <div style={{ padding: '15px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: '#38bdf8' }}>Approx Monthly Expense</div>
                <div className="money" style={{ fontWeight: 900, color: '#38bdf8', fontSize: '24px', marginTop: '4px' }}>${fmtCents(summary.monthly_total)}<span style={{ fontSize: '12px' }}>/mo</span></div>
            </div>

            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Committed Annual</div>
                <div className="money" style={{ fontWeight: 900, color: 'white', fontSize: '24px', marginTop: '4px' }}>${fmtCents(summary.annual_total)}<span style={{ fontSize: '12px' }}>/yr</span></div>
            </div>

            <div style={{ padding: '15px', background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: '#f97316' }}>Flagged for Review</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <div style={{ fontWeight: 900, color: '#f97316', fontSize: '24px' }}>{summary.review_count}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(249,115,22,0.7)', fontWeight: 700 }}>${fmtCents(summary.review_monthly_total)}/mo exposure</div>
                </div>
            </div>
        </div>
    );
};

export const SubscriptionActionStrip = ({ reviewCount, duplicateCount, unusedCount, ignoredCount, activeFilter, onChange }) => {
    const filters = [
        { id: 'review', label: 'Review Candidates', count: reviewCount },
        { id: 'duplicate', label: 'Duplicates', count: duplicateCount },
        { id: 'unused', label: 'Unused', count: unusedCount },
        { id: 'ignored', label: 'Ignored', count: ignoredCount }
    ];

    return (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '0px', marginBottom: '0px' }}>
            {filters.map(f => (
                <button
                    key={f.id}
                    onClick={() => onChange(activeFilter === f.id ? 'all' : f.id)}
                    style={{
                        padding: '8px 16px',
                        background: activeFilter === f.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${activeFilter === f.id ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: activeFilter === f.id ? '#38bdf8' : 'white',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {f.label}: {f.count}
                </button>
            ))}
        </div>
    );
};

export const TopOffendersSnapshot = ({ offenders }) => {
    if (!offenders || offenders.length === 0) return null;
    
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Spend</span>
            {offenders.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'capitalize' }}>{o.vendor}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>—</span>
                    <span className="money" style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>${fmtCents(o.monthly_cost)}/mo</span>
                </div>
            ))}
        </div>
    );
};

export const RecurringVendorsTable = ({ rows, onRowClick, onIgnoreToggle }) => {
    return (
        <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '12px 15px', textAlign: 'left', fontWeight: 800, color: 'rgba(255,255,255,0.5)', width: '25%' }}>VENDOR</th>
                        <th style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 800, color: 'rgba(255,255,255,0.5)', width: '20%' }}>EST. MONTHLY</th>
                        <th style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 800, color: 'rgba(255,255,255,0.5)', width: '20%' }}>PROJECTED ANNUAL</th>
                        <th style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>FLAGS</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>No matching vendors.</td></tr>
                    ) : null}
                    {rows.map((row, idx) => (
                        <tr onClick={() => onRowClick && onRowClick(row.vendor)} key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer' }} className="table-row-hover">
                            <td style={{ padding: '12px 15px', fontWeight: 800, textTransform: 'capitalize' }}>{row.vendor}</td>
                            <td className="money" style={{ padding: '12px 15px', textAlign: 'right' }}>
                                ${fmtCents(row.monthly_cost)}/mo
                                {row.cadenceLabel && row.cadenceLabel !== 'Monthly' && (
                                    <div
                                        style={{
                                            fontSize: '9px', fontWeight: 900, letterSpacing: '0.04em', marginTop: '2px',
                                            color: row.cadenceLabel === 'Unconfirmed' ? 'rgba(255,255,255,0.35)' : '#fbbf24',
                                        }}
                                        title={row.cadenceLabel === 'Unconfirmed'
                                            ? 'Only one charge seen yet — this figure assumes monthly until confirmed. Set the Billing Cycle on the transaction if it actually charges less often.'
                                            : `Charges ${row.cadenceLabel.toLowerCase()}, not monthly — this is an averaged monthly-equivalent figure.`}
                                    >
                                        {row.cadenceLabel.toUpperCase()}
                                    </div>
                                )}
                            </td>
                            <td className="money" style={{ padding: '12px 15px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>${fmtCents(row.annual_cost)}/yr</td>
                            <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    {row.isSubscription && <span style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 800 }}>SUB</span>}
                                    {row.flag === 'review' && <span style={{ color: '#f97316', fontSize: '10px', fontWeight: 800 }}>REVIEW</span>}
                                    {row.flag === 'duplicate' && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 800 }}>DUPLICATE</span>}
                                    {row.flag === 'unused' && <span style={{ color: '#a855f7', fontSize: '10px', fontWeight: 800 }}>UNUSED</span>}
                                    {row.flag === 'ignored' && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800 }}>IGNORED</span>}
                                    <button 
                                        className="btn sm"
                                        style={{ 
                                            padding: '4px 8px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.05em', 
                                            background: row.flag === 'ignored' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.05)', 
                                            color: row.flag === 'ignored' ? '#4ade80' : 'rgba(255,255,255,0.7)', 
                                            border: 'none', borderRadius: '6px', marginLeft: '10px' 
                                        }}
                                        onClick={(e) => onIgnoreToggle && onIgnoreToggle(e, row.vendor, row.flag === 'ignored')}
                                    >
                                        {row.flag === 'ignored' ? 'RESTORE' : 'IGNORE'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
