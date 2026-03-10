import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, fetchExpenseYears, formatMoney } from '../api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

export default function Dashboard({ apiStatus }) {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [search, setSearch] = useState('');
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchAllExpenses();
            setExpenses(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchExpenseYears().then(yrs => { if (yrs.length > 0) setAvailableYears(yrs); });
        loadData();
    }, []);

    const years = useMemo(() => {
        const set = new Set(availableYears);
        for (const r of expenses) {
            const y = Number(String(r.expense_date || '').slice(0, 4));
            if (y) set.add(y);
        }
        return [...set].sort((a, b) => b - a);
    }, [expenses, availableYears]);

    const filtered = useMemo(() => {
        let rows = expenses.filter(r => String(r.expense_date || '').startsWith(String(selectedYear)));
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => `${r.vendor} ${r.category} ${r.notes}`.toLowerCase().includes(q));
        }
        return rows;
    }, [expenses, selectedYear, search]);

    const stats = useMemo(() => {
        let income = 0, spend = 0, missing = 0;
        const byCat = new Map();
        const monthlyData = Array(12).fill().map(() => ({ income: 0, expense: 0 }));

        for (const r of filtered) {
            const cents = Number(r.amount_cents || 0);
            const isIncome = cents < 0;
            if (isIncome) income += Math.abs(cents); else spend += cents;

            if (cents > 7500 && !r.receipt_link) missing++;

            const monthIndex = parseInt(String(r.expense_date).slice(5, 7), 10) - 1;
            if (monthIndex >= 0 && monthIndex <= 11) {
                if (isIncome) monthlyData[monthIndex].income += Math.abs(cents);
                else monthlyData[monthIndex].expense += cents;
            }

            if (cents > 0) {
                const c = r.category || 'Uncategorized';
                const cPrev = byCat.get(c) || { count: 0, cents: 0 };
                cPrev.count++; cPrev.cents += cents;
                byCat.set(c, cPrev);
            }
        }
        return { income, spend, net: income - spend, missing, topCats: [...byCat.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 5), monthlyData };
    }, [filtered]);

    const barChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
            { label: 'Income', data: stats.monthlyData.map(d => d.income / 100), backgroundColor: 'rgba(25, 195, 125, 0.6)', borderRadius: 4 },
            { label: 'Expenses', data: stats.monthlyData.map(d => d.expense / 100), backgroundColor: 'rgba(255, 77, 77, 0.6)', borderRadius: 4 }
        ],
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Elite Dashboard Header */}
            <div className="card glass glow-blue" style={{ padding: '24px', border: 'none', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>📊 Financial Command Center</h2>
                        <div className="muted" style={{ fontSize: '13px' }}>{selectedYear} Performance Summary • {apiStatus}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontWeight: 800 }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn secondary sm" onClick={loadData}>Refresh</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div className="stat glass glow-green" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>TOTAL INCOME</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>{formatMoney(stats.income)}</div>
                    </div>
                    <div className="stat glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>TOTAL SPEND</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ff4d4d', marginTop: '4px' }}>{formatMoney(stats.spend)}</div>
                    </div>
                    <div className="stat glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>NET PROFIT</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: stats.net >= 0 ? 'var(--text)' : '#ff4d4d', marginTop: '4px' }}>{formatMoney(stats.net)}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
                <div className="card glass" style={{ margin: 0, padding: '20px', height: '400px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Cash Flow Trend</h2>
                    <div style={{ height: '300px' }}>
                        <Bar data={barChartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: '#a8b6dd', size: 10 } },
                                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a8b6dd', size: 10 } }
                            }
                        }} />
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Top Expense Hub</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.topCats.map(([cat, meta]) => (
                            <div key={cat} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 800, fontSize: '13px' }}>{cat}</span>
                                    <span style={{ fontWeight: 900 }}>{formatMoney(meta.cents)}</span>
                                </div>
                                <div className="muted small" style={{ fontSize: '10px' }}>{meta.count} Transactions</div>
                            </div>
                        ))}
                        {stats.missing > 0 && (
                            <div className="tag bad" style={{ padding: '10px', borderRadius: '10px', marginTop: '8px', justifyContent: 'center' }}>
                                🚨 {stats.missing} Receipts Missing ({'>'}$75)
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </section>
    );
}
