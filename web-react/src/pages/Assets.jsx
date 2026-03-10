import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiDelete, formatMoney, fetchExpenseYears } from '../api';

const CATEGORIES = ['Camera', 'Lens', 'Drone', 'Laptop', 'Flash', 'Gimbal', 'Ipad', 'Other'];

function parseDollar(s) {
    return Math.round(parseFloat(String(s || '0').replace(/[$,]/g, '')) * 100);
}

// Pre-loaded from State Farm photography insurance spreadsheet
const SEED_ASSETS = [
    { purchase_date: '2022-09-19', vendor: "Abe's of Maine", description: 'Sony A7M4', category: 'Camera', cost_cents: parseDollar('$2,695.00'), serial_number: '8523567', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2022-07-27', vendor: 'Apple', description: 'MacBook Air (M2)', category: 'Laptop', cost_cents: parseDollar('$1,852.13'), serial_number: 'F16X3P79DX', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-12-13', vendor: "Abe's of Maine", description: 'Sigma 24-70mm f/2.8 DG DN Art', category: 'Lens', cost_cents: parseDollar('$1,099.00'), serial_number: '57592280', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-10-31', vendor: 'Adorama', description: 'Sigma 50mm f/1.4 DG DN', category: 'Lens', cost_cents: parseDollar('$1,000.09'), serial_number: '57144869', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2020-10-14', vendor: 'Adorama', description: 'Tamron 70-300mm f/4.5-6.3 Di III RXD', category: 'Lens', cost_cents: parseDollar('$664.32'), serial_number: 'N/A', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2020-02-19', vendor: 'Adorama', description: 'Sony E 18-135mm f/3.5-5.6', category: 'Lens', cost_cents: parseDollar('$593.90'), serial_number: '1967401', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-05-08', vendor: 'Amazon', description: 'Sigma 150-600mm f/5-6.3 DG DN OS', category: 'Lens', cost_cents: parseDollar('$1,624.54'), serial_number: '56528920', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2022-12-13', vendor: 'Amazon', description: 'Godox V1-S Round Head Flash', category: 'Flash', cost_cents: parseDollar('$293.59'), serial_number: 'N/A', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2022-11-08', vendor: 'Amazon', description: 'Tamron 28-200mm f/2.8-5.6 Di III RXD', category: 'Lens', cost_cents: parseDollar('$790.05'), serial_number: '104086', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2019-09-18', vendor: 'AAFES', description: 'Sony A6300', category: 'Camera', cost_cents: parseDollar('$939.98'), serial_number: '3488155', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-05-24', vendor: 'DJI', description: 'DJI Mini 3 Pro (DJI RC)', category: 'Drone', cost_cents: parseDollar('$1,248.00'), serial_number: '1581F7XFA565GML8DM73', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-01-07', vendor: 'DJI', description: 'Osmo Mobile 6 Platinum Gray', category: 'Gimbal', cost_cents: parseDollar('$152.13'), serial_number: '74BVM23811', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-05-19', vendor: 'Amazon', description: 'Sigma 105mm f/2.8 DG DN Macro', category: 'Lens', cost_cents: parseDollar('$799.00'), serial_number: '56841143', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2025-09-09', vendor: 'BlueTech Solutions Co', description: 'DJI Mavic 4 Pro Creator Drone', category: 'Drone', cost_cents: parseDollar('$2,871.03'), serial_number: '1581F986C257W00235BJ', receipt_on_file: true, depreciation_method: 'straight_line', notes: 'Receipt in Own Folder' },
    { purchase_date: '2025-09-09', vendor: 'BlueTech Solutions Co', description: 'Sony FX3A', category: 'Camera', cost_cents: parseDollar('$3,571.28'), serial_number: '6000387', receipt_on_file: true, depreciation_method: 'straight_line', notes: 'Wise transaction — Receipt in Own Folder' },
    { purchase_date: '2024-03-21', vendor: 'Adorama', description: 'Sigma 70-200mm f/2.8 DG DN OS Sports', category: 'Lens', cost_cents: parseDollar('$1,499.00'), serial_number: '56528920', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2025-04-30', vendor: 'Amazon', description: 'Apple iPad Air 13-inch (MCNN4LL/A)', category: 'Ipad', cost_cents: parseDollar('$799.00'), serial_number: 'H1GV22H9Q2', receipt_on_file: true, depreciation_method: 'straight_line', notes: '' },
    { purchase_date: '2023-01-22', vendor: 'Feiyu', description: 'Feiyu SCORP 2 Gimbal', category: 'Gimbal', cost_cents: parseDollar('$463.50'), serial_number: 'H100233300020', receipt_on_file: true, depreciation_method: 'straight_line', notes: 'Sold' },
];

const BLANK = { purchase_date: '', vendor: '', description: '', category: 'Camera', cost_cents: '', serial_number: '', receipt_on_file: false, depreciation_method: 'straight_line', notes: '' };

export default function Assets() {
    const [assets, setAssets] = useState([]);
    const [deprData, setDeprData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(BLANK);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    const [seeded, setSeeded] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [a, d, y] = await Promise.all([
                apiGet('/assets'),
                apiGet(`/assets/depreciation?year=${selectedYear}`),
                fetchExpenseYears()
            ]);
            setAssets(a);
            setDeprData(d);
            if (y.length) setYears([...new Set([...y, 2025, 2026])].sort((a, b) => b - a));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [selectedYear]);

    const handleSave = async () => {
        if (!form.purchase_date || !form.vendor || !form.description || !form.cost_cents) {
            setMsg('Please fill in Date, Vendor, Description, and Cost.'); return;
        }
        setSaving(true); setMsg('');
        try {
            await apiPost('/assets', {
                ...form,
                cost_cents: Math.round(parseFloat(String(form.cost_cents).replace(/[$,]/g, '')) * 100)
            });
            setForm(BLANK);
            setMsg('✅ Asset saved!');
            load();
        } catch (e) { setMsg(`Error: ${e.message}`); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this asset?')) return;
        await apiDelete(`/assets/${id}`);
        load();
    };

    const handleSeedAll = async () => {
        if (!confirm(`Import all ${SEED_ASSETS.length} gear items from the State Farm list? Duplicates may appear if any already exist.`)) return;
        setMsg('Importing gear list...');
        let ok = 0;
        for (const a of SEED_ASSETS) {
            try { await apiPost('/assets', { ...a, useful_life_years: 5 }); ok++; } catch (_) { }
        }
        setMsg(`✅ Imported ${ok} of ${SEED_ASSETS.length} assets.`);
        setSeeded(true);
        load();
    };

    const totalCost = assets.reduce((s, a) => s + Number(a.cost_cents || 0), 0);
    const totalDepr = deprData?.total_deduction_cents || 0;

    const STATUS_COLOR = { active: '#6366f1', fully_depreciated: '#4ade80', not_yet_purchased: '#94a3b8' };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>📷 Equipment & Depreciation</h2>
                        <div className="muted small" style={{ marginTop: '4px' }}>
                            IRS Schedule C · Line 13 (Depreciation) — MACRS 5-year life for cameras, lenses &amp; electronics
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <small className="muted">Tax Year</small>
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {/* Summary banners */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <div className="card accent" style={{ flex: 1, textAlign: 'center', padding: '14px', minWidth: '150px' }}>
                        <div className="muted small">Total Gear Value</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{formatMoney(totalCost)}</div>
                    </div>
                    <div className="card accent" style={{ flex: 1, textAlign: 'center', padding: '14px', minWidth: '150px' }}>
                        <div className="muted small">{selectedYear} Depreciation Deduction</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80' }}>{formatMoney(totalDepr)}</div>
                        <div className="muted small">Schedule C · Line 13</div>
                    </div>
                    <div className="card accent" style={{ flex: 1, textAlign: 'center', padding: '14px', minWidth: '150px' }}>
                        <div className="muted small">Assets Tracked</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{assets.length}</div>
                    </div>
                </div>
            </div>

            {/* Depreciation Schedule */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ margin: 0 }}>Depreciation Schedule — {selectedYear}</h2>
                    {assets.length === 0 && !seeded && (
                        <button className="btn primary" onClick={handleSeedAll}>
                            📥 Import State Farm Gear List ({SEED_ASSETS.length} items)
                        </button>
                    )}
                </div>

                {msg && <div className="tag ok" style={{ marginBottom: '10px' }}>{msg}</div>}

                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Cat</th>
                                <th style={{ textAlign: 'right' }}>Cost</th>
                                <th>Method</th>
                                <th>Life</th>
                                <th style={{ textAlign: 'right' }}>{selectedYear} Deduction</th>
                                <th style={{ textAlign: 'right' }}>Remaining Basis</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(deprData?.assets || []).map(a => (
                                <tr key={a.id} style={{ opacity: a.status === 'not_yet_purchased' ? 0.5 : 1 }}>
                                    <td style={{ fontSize: '0.85rem' }}>{a.purchase_date}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{a.description}</div>
                                        <div className="muted small">{a.vendor} {a.serial_number ? `· S/N: ${a.serial_number}` : ''}</div>
                                    </td>
                                    <td><span className="tag" style={{ fontSize: '0.72rem' }}>{a.category}</span></td>
                                    <td style={{ textAlign: 'right' }}>{formatMoney(a.cost * 100)}</td>
                                    <td className="muted small">{a.depreciation_method === 'section_179' ? 'Sec 179' : '5-yr SL'}</td>
                                    <td className="muted small">{a.useful_life_years}yr</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: a.deduction_this_year > 0 ? '#4ade80' : 'inherit' }}>
                                        {a.deduction_this_year > 0 ? formatMoney(a.deduction_this_year * 100) : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatMoney(a.remaining_basis * 100)}</td>
                                    <td>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_COLOR[a.status] || '#94a3b8', textTransform: 'uppercase' }}>
                                            {a.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td><button className="btn sm danger" onClick={() => handleDelete(a.id)}>×</button></td>
                                </tr>
                            ))}
                            {!deprData?.assets?.length && (
                                <tr><td colSpan={10} className="muted center">
                                    No assets yet — click "Import State Farm Gear List" above or add manually below.
                                </td></tr>
                            )}
                        </tbody>
                        {!!totalDepr && (
                            <tfoot>
                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderTop: '2px solid rgba(255,255,255,0.15)' }}>
                                    <td colSpan={6} style={{ fontWeight: 700, padding: '10px 8px' }}>Total {selectedYear} Depreciation (Schedule C · Line 13)</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: '#4ade80' }}>{formatMoney(totalDepr)}</td>
                                    <td colSpan={3}></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Add new asset */}
            <div className="card">
                <h2>Add Equipment Asset</h2>
                <div className="muted small" style={{ marginBottom: '14px' }}>
                    Add any gear purchased for the photo/video business. 5-year MACRS is the IRS default for cameras &amp; electronics. Use Section 179 to deduct the full cost in the year of purchase.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    <div>
                        <small className="muted">Purchase Date *</small>
                        <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                    <div>
                        <small className="muted">Vendor *</small>
                        <input type="text" placeholder="e.g. Adorama" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted">Description *</small>
                        <input type="text" placeholder="e.g. Sony A7M4 Full-Frame Camera Body" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                        <small className="muted">Category</small>
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <small className="muted">Cost *</small>
                        <input type="text" placeholder="$2,695.00" value={form.cost_cents} onChange={e => setForm({ ...form, cost_cents: e.target.value })} />
                    </div>
                    <div>
                        <small className="muted">Serial Number</small>
                        <input type="text" placeholder="S/N from receipt" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                    </div>
                    <div>
                        <small className="muted">Depreciation Method</small>
                        <select value={form.depreciation_method} onChange={e => setForm({ ...form, depreciation_method: e.target.value })}>
                            <option value="straight_line">5-Year Straight-Line</option>
                            <option value="section_179">Section 179 (Full deduction yr 1)</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.receipt_on_file} onChange={e => setForm({ ...form, receipt_on_file: e.target.checked })} />
                            <span>Receipt on file</span>
                        </label>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <small className="muted">Notes</small>
                        <input type="text" placeholder="e.g. Wise transaction, BlueTech vendor" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Add Asset'}
                    </button>
                    <button className="btn secondary" onClick={() => setForm(BLANK)}>Clear</button>
                    {msg && <span className="muted small">{msg}</span>}
                </div>
            </div>
        </section>
    );
}
