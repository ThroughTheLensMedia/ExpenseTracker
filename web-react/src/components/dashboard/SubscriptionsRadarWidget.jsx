import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat } from 'lucide-react';

export default function SubscriptionsRadarWidget({ recurringVendors }) {
    const navigate = useNavigate();

    const { subs, monthlyTotal } = useMemo(() => {
        const list = (recurringVendors || [])
            .filter(v => v?.flags?.isSubscription && !v?.flags?.ignored)
            .sort((a, b) => (b.avgMonthlyCents || 0) - (a.avgMonthlyCents || 0));
        const total = list.reduce((s, v) => s + Number(v.avgMonthlyCents || 0), 0);
        return { subs: list, monthlyTotal: total };
    }, [recurringVendors]);

    const fmt = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents || 0) / 100);

    return (
        <div
            className="card glass card-hover"
            style={{ margin: 0, padding: '24px', borderTop: '4px solid #38bdf8', cursor: subs.length ? 'pointer' : 'default' }}
            onClick={() => subs.length && navigate('/transactions?search=' + encodeURIComponent(subs[0].vendor))}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Repeat size={18} style={{ color: '#38bdf8' }} />
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Subscriptions Radar</h2>
            </div>

            {subs.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>No recurring subscriptions detected yet.</div>
            ) : (
                <>
                    <div className="money" style={{ fontSize: '2rem', fontWeight: 950, color: '#38bdf8' }}>
                        {fmt(monthlyTotal)}<span style={{ fontSize: 14 }}>/mo</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 6, marginBottom: 14 }}>
                        across {subs.length} subscription{subs.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {subs.slice(0, 3).map(v => (
                            <div key={v.vendor} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                                <span style={{ textTransform: 'capitalize', color: 'rgba(255,255,255,0.7)' }}>{v.vendor}</span>
                                <span className="money" style={{ color: 'rgba(255,255,255,0.5)' }}>{fmt(v.avgMonthlyCents)}/mo</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
