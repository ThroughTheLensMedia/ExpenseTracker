import React from 'react';
import { PiggyBank } from 'lucide-react';

// Same quarterly estimated-tax deadlines used in api/routes/brain.js
function nextDeadline(year) {
    const today = new Date().toISOString().slice(0, 10);
    const deadlines = [
        { date: `${year}-04-15`, label: `Q1 ${year}` },
        { date: `${year}-06-15`, label: `Q2 ${year}` },
        { date: `${year}-09-15`, label: `Q3 ${year}` },
        { date: `${year + 1}-01-15`, label: `Q4 ${year}` },
    ];
    return deadlines.find(d => d.date >= today) || deadlines[deadlines.length - 1];
}

function formatDeadline(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TaxSetAsideWidget({ ytdNetCents = 0, taxRate = 30, onEditRate }) {
    const deadline = nextDeadline(new Date().getFullYear());
    const setAsideCents = Math.max(0, ytdNetCents) * (taxRate / 100);

    return (
        <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: '4px solid #fcd34d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <PiggyBank size={18} style={{ color: '#fcd34d' }} />
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Quarterly Tax Set-Aside</h2>
            </div>
            <div className="money amt-deduction" style={{ fontSize: '2rem', fontWeight: 950 }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(setAsideCents / 100)}
            </div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                Estimated for {deadline.label} — due {formatDeadline(deadline.date)}
            </div>
            <button
                onClick={onEditRate}
                style={{ marginTop: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
                Based on a {taxRate}% estimate — adjust in Profile
            </button>
        </div>
    );
}
