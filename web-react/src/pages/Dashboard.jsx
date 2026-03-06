import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, formatMoney } from '../api';
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

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchAllExpenses();
            setExpenses(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const years = useMemo(() => {
        const set = new Set();
        for (const r of expenses) {
            const y = Number(String(r.expense_date || '').slice(0, 4));
            if (y) set.add(y);
        }
        const arr = [...set].sort((a, b) => b - a);
        if (!arr.length) arr.push(new Date().getFullYear());
        // User requested 2025 default explicitly earlier
        if (!arr.includes(2025)) arr.push(2025);
        return arr.sort((a, b) => b - a);
    }, [expenses]);

    // Ensure default year selection
    useEffect(() => {
        if (!years.includes(selectedYear) && years.length > 0) {
            setSelectedYear(2025);
        }
    }, [years, selectedYear]);

    // Derived Stats
    const filtered = useMemo(() => {
        let rows = expenses.filter(r => String(r.expense_date || '').startsWith(String(selectedYear)));
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => {
                const hay = `${r.vendor || ''} ${r.category || ''} ${r.notes || ''}`.toLowerCase();
                return hay.includes(q);
            });
        }
        return rows;
    }, [expenses, selectedYear, search]);

    const stats = useMemo(() => {
        let income = 0, spend = 0, missing = 0;
        const byCat = new Map();
        const byVendor = new Map();
        const monthlyData = Array(12).fill().map(() => ({ income: 0, expense: 0 }));

        for (const r of filtered) {
            const cents = Number(r.amount_cents || 0);
            const isIncome = cents < 0;

            if (isIncome) income += Math.abs(cents);
            else spend += cents;

            if (cents > 7500 && !r.receipt_link) missing++;

            // Monthly aggregation
            const monthIndex = parseInt(String(r.expense_date).slice(5, 7), 10) - 1;
            if (monthIndex >= 0 && monthIndex <= 11) {
                if (isIncome) monthlyData[monthIndex].income += Math.abs(cents);
                else monthlyData[monthIndex].expense += cents;
            }

            if (cents > 0) {
                const c = r.category || 'Uncategorized';
                const v = r.vendor || 'Unknown';

                const cPrev = byCat.get(c) || { count: 0, cents: 0 };
                cPrev.count++; cPrev.cents += cents;
                byCat.set(c, cPrev);

                const vPrev = byVendor.get(v) || { count: 0, cents: 0 };
                vPrev.count++; vPrev.cents += cents;
                byVendor.set(v, vPrev);
            }
        }

        const topCats = [...byCat.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 5);
        const topVendors = [...byVendor.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 10);

        return { income, spend, net: income - spend, missing, topCats, topVendors, monthlyData };
    }, [filtered]);

    // Chart Data Preparation
    const barChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
            {
                label: 'Income',
                data: stats.monthlyData.map(d => d.income / 100),
                backgroundColor: 'rgba(25, 195, 125, 0.7)',
            },
            {
                label: 'Expenses',
                data: stats.monthlyData.map(d => d.expense / 100),
                backgroundColor: 'rgba(255, 77, 77, 0.7)',
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e9eefc' } }
        },
        scales: {
            y: { ticks: { color: '#a8b6dd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { ticks: { color: '#a8b6dd' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
    };

    const doughnutData = {
        labels: stats.topCats.map(c => c[0]),
        datasets: [
            {
                data: stats.topCats.map(c => c[1].cents / 100),
                backgroundColor: [
                    '#2f6bff', '#19c37d', '#f7b955', '#ff4d4d', '#a8b6dd'
                ],
                borderWidth: 0,
            }
        ]
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#e9eefc' } }
        }
    };

    return (
        <section className="card">
            <h2>
                <span>Dashboard</span>
                <span className="muted" style={{ marginLeft: '8px' }}>{apiStatus}</span>
            </h2>

            <div className="controls">
                <div className="grow">
                    <small className="muted">Year</small>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="grow">
                    <small className="muted">Search</small>
                    <input
                        placeholder="Vendor, category, notes…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button className="btn secondary" onClick={loadData} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="grid two" style={{ marginTop: '12px' }}>
                <div className="stat">
                    <div className="k">Total income</div>
                    <div className="v">{formatMoney(stats.income)}</div>
                </div>
                <div className="stat">
                    <div className="k">Total spend</div>
                    <div className="v">{formatMoney(stats.spend)}</div>
                </div>
                <div className="stat">
                    <div className="k">Net</div>
                    <div className="v">{formatMoney(stats.net)}</div>
                </div>
                <div className="stat">
                    <div className="k">Receipts needed (&gt;$75, missing)</div>
                    <div className="v">{stats.missing}</div>
                </div>
            </div>

            {/* --- NEW VISUALIZATIONS SECTION --- */}
            <div className="grid two" style={{ marginTop: '12px' }}>
                <div className="card" style={{ margin: 0, height: '300px' }}>
                    <h2>Monthly Cash Flow</h2>
                    <div style={{ position: 'relative', height: '230px', width: '100%' }}>
                        <Bar data={barChartData} options={chartOptions} />
                    </div>
                </div>

                <div className="card" style={{ margin: 0, height: '300px' }}>
                    <h2>Top Categories (Spend)</h2>
                    <div style={{ position: 'relative', height: '230px', width: '100%' }}>
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                    </div>
                </div>
            </div>

            <div className="grid two" style={{ marginTop: '12px' }}>
                <div className="card" style={{ margin: 0 }}>
                    <h2>Top Categories Data</h2>
                    <div className="tableWrap">
                        <table style={{ minWidth: '400px' }}>
                            <thead><tr><th>Category</th><th>Transactions</th><th>Spend</th></tr></thead>
                            <tbody>
                                {stats.topCats.map(([cat, meta]) => (
                                    <tr key={cat}>
                                        <td>{cat}</td>
                                        <td>{meta.count}</td>
                                        <td>{formatMoney(meta.cents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                    <h2>Top Vendors (Spend)</h2>
                    <div className="tableWrap">
                        <table style={{ minWidth: '400px' }}>
                            <thead><tr><th>Vendor</th><th>Transactions</th><th>Spend</th></tr></thead>
                            <tbody>
                                {stats.topVendors.map(([v, meta]) => (
                                    <tr key={v}>
                                        <td>{v}</td>
                                        <td>{meta.count}</td>
                                        <td>{formatMoney(meta.cents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}
