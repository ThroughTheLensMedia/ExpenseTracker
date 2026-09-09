import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardMetrics, getDashboardMetricsCache } from '../api';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents || 0) / 100);
const titleCase = value => String(value || '').replace(/\b\w/g, letter => letter.toUpperCase());
const monthName = value => new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2026, Number(value) - 1, 1));

export default function PersonalDashboard() {
    const navigate = useNavigate();
    const year = new Date().getFullYear();
    const [metrics, setMetrics] = useState(() => getDashboardMetricsCache(year));
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardMetrics(year, true).then(({ data }) => setMetrics(data)).catch(e => setError(e.message));
    }, [year]);

    const recurring = (metrics?.analytics?.recurringVendors || []).filter(item => item.flags?.isSubscription);
    const recurringTotal = recurring.reduce((sum, item) => sum + (item.avgMonthlyCents || 0), 0);
    const categories = metrics?.analytics?.topCategoriesMonth || [];
    const months = (metrics?.performance || []).filter(m => m.income || m.spend).slice(-6);
    const cards = [
        ['Income This Month', metrics?.snapshot?.mtdIncome, '#4ade80'],
        ['Spending This Month', metrics?.snapshot?.mtdSpend, '#f97316'],
        ['Cash Flow This Month', metrics?.snapshot?.mtdNet, '#38bdf8'],
        ['Recurring Monthly Bills', recurringTotal, '#a78bfa'],
    ];

    return <section style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto' }}>
        <div className="card glass glow-blue" style={{ padding: 'clamp(24px, 6vw, 40px)', margin: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 7vw, 2.4rem)' }}>Your Money Overview</h1>
            <p className="muted" style={{ marginBottom: 0 }}>A clear view of what came in, what went out, and what repeats.</p>
        </div>
        {error && <div className="card glass" style={{ padding: 18, borderColor: '#ef4444' }}>Could not load your overview: {error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 14 }}>
            {cards.map(([label, value, color]) => <button key={label} className="card glass" onClick={() => navigate('/transactions')} style={{ padding: 22, margin: 0, cursor: 'pointer', color: 'white', textAlign: 'left', borderTop: `4px solid ${color}` }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 'clamp(1.7rem, 8vw, 2.3rem)', fontWeight: 950, color, marginTop: 8 }}>{metrics ? money(value) : '—'}</div>
            </button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
            <div className="card glass" style={{ padding: 22, margin: 0, minWidth: 0 }}>
                <h2 style={{ marginTop: 0 }}>Recent Cash Flow</h2>
                {months.length ? months.map(month => <div key={month.month} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 13 }}><strong>{monthName(month.month)}</strong><span style={{ color: '#4ade80' }}>{money(month.income)}</span><span style={{ color: '#f97316' }}>{money(month.spend)}</span></div>) : <p className="muted">Import transactions to see monthly trends.</p>}
            </div>
            <div className="card glass" style={{ padding: 22, margin: 0, minWidth: 0 }}>
                <h2 style={{ marginTop: 0 }}>Top Spending Categories</h2>
                {categories.length ? categories.slice(0, 6).map(item => <div key={item.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}><span>{item.category}</span><strong>{money(item.cents)}</strong></div>) : <p className="muted">No spending categories yet.</p>}
            </div>
            <div className="card glass" style={{ padding: 22, margin: 0, minWidth: 0 }}>
                <h2 style={{ marginTop: 0 }}>Recurring Bills</h2>
                {recurring.length ? recurring.slice(0, 6).map(item => <div key={item.vendor} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}><span>{titleCase(item.vendor)}</span><strong>{money(item.avgMonthlyCents)}/mo</strong></div>) : <p className="muted">Recurring charges will appear after enough history is imported.</p>}
            </div>
        </div>
        <button className="btn primary" style={{ alignSelf: 'center' }} onClick={() => navigate('/transactions')}>Review Transactions</button>
    </section>;
}
