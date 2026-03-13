import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete, formatMoney, fetchAllMileage } from '../api';
import { useModal } from '../components/ModalContext.jsx';
import { useAuth } from '../components/AuthContext';

export default function Mileage() {
    const { settings } = useAuth();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [mileage, setMileage] = useState([]);
    const [mileageRates, setMileageRates] = useState([]);
    const [mileageInput, setMileageInput] = useState({ 
        date: new Date().toISOString().slice(0, 10), 
        miles: '', 
        purpose: '' 
    });
    const [syncStatus, setSyncStatus] = useState('');
    const [manualRate, setManualRate] = useState({ year: new Date().getFullYear(), rate: '' });
    const [ratesOpen, setRatesOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const modal = useModal();

    const loadData = async (force = false) => {
        setLoading(true);
        try {
            const [miles, rates] = await Promise.all([
                fetchAllMileage(selectedYear),
                apiGet('/mileage/rates')
            ]);
            setMileage(miles);
            setMileageRates(rates);
        } catch (e) {
            console.error("Failed to load mileage data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const handleAddMileage = async () => {
        if (!mileageInput.miles || !mileageInput.purpose) {
            return modal.alert("Please enter both miles and purpose.");
        }
        try {
            await apiPost("/mileage", {
                log_date: mileageInput.date,
                miles: Number(mileageInput.miles),
                purpose: mileageInput.purpose
            });
            setMileageInput({ ...mileageInput, miles: '', purpose: '' });
            loadData(true);
        } catch (err) {
            modal.alert("Failed to add trip: " + err.message);
        }
    };

    const handleDeleteMileage = async (id) => {
        const ok = await modal.confirm("Delete this trip log?");
        if (!ok) return;
        try {
            await apiDelete(`/mileage/${id}`);
            loadData(true);
        } catch (err) {
            modal.alert("Failed to delete trip: " + err.message);
        }
    };

    const handleSyncIRS = async () => {
        setSyncStatus('Checking IRS.gov...');
        try {
            const result = await apiPost('/mileage/rates/sync', {});
            setSyncStatus(`✅ Updated: ${result.year} = $${Number(result.rate_per_mile).toFixed(2)}/mile`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const handleManualRate = async () => {
        if (!manualRate.rate) return;
        try {
            await apiPost('/mileage/rates', { year: manualRate.year, rate_per_mile: manualRate.rate });
            setSyncStatus(`✅ Saved: ${manualRate.year} = $${Number(manualRate.rate).toFixed(2)}/mile`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
            setManualRate({ year: new Date().getFullYear(), rate: '' });
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const totalMiles = mileage.reduce((sum, m) => sum + Number(m.miles || 0), 0);
    const currentRateObj = mileageRates.find(r => r.year === Number(selectedYear));
    const currentRate = currentRateObj?.rate_per_mile ?? 0.70;
    const mileageDeduction = totalMiles * currentRate;

    const exportCsv = () => {
        window.open(`/api/tax/export.csv?year=${encodeURIComponent(selectedYear)}`, "_blank");
    };

    return (
        <section style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '100px' }}>
            <div className="card glass glow-blue" style={{ marginBottom: '20px', padding: '24px 30px', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Mileage Tracker
                        </h1>
                        <div className="muted" style={{ marginTop: '6px', fontSize: '14px' }}>
                            IRS Standard Business Deduction • {selectedYear}
                        </div>
                    </div>
                    <div>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))} 
                            className="btn secondary" 
                            style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 900, fontSize: '14px' }}
                        >
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>FY {y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid two" style={{ gap: '20px', marginBottom: '20px' }}>
                <div className="card accent" style={{ textAlign: 'center', padding: '24px' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', marginBottom: '8px' }}>TOTAL BUSINESS DISTANCE</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>{totalMiles.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.5 }}>MI</span></div>
                </div>
                <div className="card accent" style={{ textAlign: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', marginBottom: '8px' }}>POTENTIAL TAX DEDUCTION</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#4ade80' }}>{formatMoney(mileageDeduction * 100)}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.6, marginTop: '4px' }}>Calculated at ${currentRate.toFixed(2)}/mile</div>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Log New Trip</h2>
                    <div className="tag ok" style={{ fontSize: '10px' }}>IRS COMPLIANT LOG</div>
                </div>
                
                <div className="controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '0 0 160px' }}>
                        <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Trip Date</label>
                        <input 
                            type="date" 
                            value={mileageInput.date} 
                            onChange={e => setMileageInput({ ...mileageInput, date: e.target.value })} 
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: '0 0 100px' }}>
                        <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Miles</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            value={mileageInput.miles} 
                            onChange={e => setMileageInput({ ...mileageInput, miles: e.target.value })} 
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: '2', minWidth: '250px' }}>
                        <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Purpose / Destination</label>
                        <input 
                            type="text" 
                            placeholder="Client Shoot - Downtown HQ" 
                            value={mileageInput.purpose} 
                            onChange={e => setMileageInput({ ...mileageInput, purpose: e.target.value })} 
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: '0 0 120px', display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn primary glow-blue" onClick={handleAddMileage} style={{ width: '100%', padding: '12px' }}>
                            Add Trip
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h2 style={{ margin: 0 }}>Trip History</h2>
                </div>
                <div className="tableWrap" style={{ maxHeight: '500px' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Purpose</th>
                                <th style={{ textAlign: 'center' }}>Miles</th>
                                <th style={{ textAlign: 'right' }}>Deduction</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {mileage.map(m => (
                                <tr key={m.id}>
                                    <td style={{ fontWeight: 600 }}>{m.log_date}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{m.purpose}</div>
                                        <div className="muted small" style={{ fontSize: '9px' }}>Official IRS Log ID: #{m.id}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="tag" style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 900 }}>{Number(m.miles).toLocaleString()}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#4ade80' }}>
                                        {formatMoney(Number(m.miles) * currentRate * 100)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn sm secondary" onClick={() => handleDeleteMileage(m.id)} style={{ color: '#ef4444' }}>×</button>
                                    </td>
                                </tr>
                            ))}
                            {mileage.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="muted center" style={{ padding: '60px' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>🚗</div>
                                        No business trips logged for {selectedYear} yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card">
                <div 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setRatesOpen(!ratesOpen)}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>IRS Compliance & Rates {ratesOpen ? '▲' : '▼'}</h2>
                        <div className="muted small">Configuring the global rate engine for Sch C Line 9.</div>
                    </div>
                    <button className="btn sm secondary" onClick={e => { e.stopPropagation(); handleSyncIRS(); }}>
                        {syncStatus ? syncStatus : "Sync Rates"}
                    </button>
                </div>

                {ratesOpen && (
                    <div style={{ marginTop: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                        <div className="grid two" style={{ gap: '20px' }}>
                            <div className="tableWrap">
                                <table className="sm">
                                    <thead>
                                        <tr><th>Year</th><th>Rate</th><th>Source</th></tr>
                                    </thead>
                                    <tbody>
                                        {mileageRates.map(r => (
                                            <tr key={r.year} style={r.year === selectedYear ? { background: 'rgba(99,102,241,0.1)' } : {}}>
                                                <td>{r.year}</td>
                                                <td><span className="tag ok">${Number(r.rate_per_mile).toFixed(2)}</span></td>
                                                <td className="muted small">{r.source}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h3 style={{ marginTop: 0 }}>Manual Override</h3>
                                <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input type="number" placeholder="Year" value={manualRate.year} onChange={e => setManualRate({ ...manualRate, year: e.target.value })} />
                                    <input type="number" placeholder="Rate (e.g. 0.70)" value={manualRate.rate} onChange={e => setManualRate({ ...manualRate, rate: e.target.value })} />
                                    <button className="btn secondary" onClick={handleManualRate}>Save Override</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
