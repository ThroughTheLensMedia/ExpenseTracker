import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, fetchExpenseYears } from '../api';

const CATEGORIES = [
    { name: 'Camera', icon: '📷' },
    { name: 'Lens', icon: '🔍' },
    { name: 'Drone', icon: '🛸' },
    { name: 'Laptop', icon: '💻' },
    { name: 'Flash', icon: '🔦' },
    { name: 'Gimbal', icon: '⚖️' },
    { name: 'Ipad', icon: '📱' },
    { name: 'Lighting', icon: '💡' },
    { name: 'Other', icon: '📦' }
];

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

const BLANK = {
    purchase_date: '', vendor: '', description: '', category: 'Camera',
    cost_cents: '', serial_number: '', receipt_on_file: false,
    depreciation_method: 'straight_line', notes: '',
    disposal_date: '', disposal_value_cents: ''
};

export default function Assets() {
    const [assets, setAssets] = useState([]);
    const [deprData, setDeprData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(BLANK);
    const [editingAsset, setEditingAsset] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    const [searchTerm, setSearchTerm] = useState('');
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
            if (y.length) setYears([...new Set([...y, 2024, 2025, 2026])].sort((a, b) => b - a));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [selectedYear]);

    const handleSave = async () => {
        if (!form.purchase_date || !form.vendor || !form.description || !form.cost_cents) {
            setMsg('⚠️ Please fill in Date, Vendor, Description, and Cost.');
            return;
        }
        setSaving(true);
        setMsg('');
        try {
            const payload = {
                ...form,
                cost_cents: typeof form.cost_cents === 'string' ? parseDollar(form.cost_cents) : form.cost_cents,
                disposal_value_cents: form.disposal_value_cents ? parseDollar(form.disposal_value_cents) : null,
                disposal_date: form.disposal_date || null
            };

            if (editingAsset) {
                await apiPatch(`/assets/${editingAsset.id}`, payload);
                setMsg('✅ Asset updated!');
            } else {
                await apiPost('/assets', payload);
                setMsg('✅ Asset saved!');
            }
            setForm(BLANK);
            setEditingAsset(null);
            load();
        } catch (e) {
            setMsg(`❌ Error: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (asset) => {
        setEditingAsset(asset);
        setForm({
            ...asset,
            cost_cents: (Number(asset.cost_cents) / 100).toFixed(2),
            disposal_value_cents: asset.disposal_value_cents ? (Number(asset.disposal_value_cents) / 100).toFixed(2) : '',
            disposal_date: asset.disposal_date || ''
        });
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!confirm('Permanently delete this asset?')) return;
        try {
            await apiDelete(`/assets/${id}`);
            load();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleSeedAll = async () => {
        if (!confirm(`Import all ${SEED_ASSETS.length} gear items from the State Farm list?`)) return;
        setMsg('⏳ Importing gear list...');
        let ok = 0;
        for (const a of SEED_ASSETS) {
            try {
                await apiPost('/assets', { ...a, useful_life_years: 5 });
                ok++;
            } catch (_) { }
        }
        setMsg(`✅ Imported ${ok} of ${SEED_ASSETS.length} assets.`);
        setSeeded(true);
        load();
    };

    const filteredAssets = useMemo(() => {
        const list = deprData?.assets || [];
        if (!searchTerm) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(a =>
            a.description.toLowerCase().includes(q) ||
            a.vendor.toLowerCase().includes(q) ||
            (a.serial_number || '').toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        );
    }, [deprData, searchTerm]);

    const totalCost = assets.reduce((s, a) => s + Number(a.cost_cents || 0), 0);
    const totalDepr = deprData?.total_deduction_cents || 0;

    const STATUS_UI = {
        active: { color: '#6366f1', label: 'In Use', bg: 'rgba(99,102,241,0.1)' },
        fully_depreciated: { color: '#4ade80', label: 'Depreciated', bg: 'rgba(74,222,128,0.1)' },
        sold: { color: '#facc15', label: 'Sold', bg: 'rgba(250,204,21,0.1)' },
        not_yet_purchased: { color: '#94a3b8', label: 'Upcoming', bg: 'rgba(148,163,184,0.1)' }
    };

    if (loading && !assets.length) return <div className="card">Loading Assets...</div>;

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header & Impact stats */}
            <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>⚙️ Equipment Locker</h2>
                        <div className="muted" style={{ marginTop: '4px' }}>
                            Inventory & Tax Depreciation Schedule · {selectedYear}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <small className="muted">Viewing Tax Year</small>
                            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: '100px' }}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="card accent" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <div className="muted small">Total Gear Value</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{formatMoney(totalCost)}</div>
                        <div className="muted small" style={{ marginTop: '4px' }}>Across {assets.length} items</div>
                    </div>
                    <div className="card accent" style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.05))', border: '1px solid rgba(74,222,128,0.2)' }}>
                        <div className="muted small">{selectedYear} Deduction</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4ade80' }}>{formatMoney(totalDepr)}</div>
                        <div className="muted small" style={{ marginTop: '4px' }}>Schedule C · Line 13</div>
                    </div>
                    <div className="card accent" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.1))' }}>
                        <div className="muted small">Current Asset Mix</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
                            {CATEGORIES.slice(0, 4).map(c => (
                                <span key={c.name} title={c.name} style={{ fontSize: '1.2rem', opacity: 0.8 }}>{c.icon}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory List */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h2 style={{ margin: 0 }}>Inventory Schedule</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Search description, serial, or vendor..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '280px', fontSize: '13px' }}
                        />
                        {assets.length === 0 && !seeded && (
                            <button className="btn primary" onClick={handleSeedAll}>
                                📥 Import Gear List
                            </button>
                        )}
                    </div>
                </div>

                <div className="tableWrap" style={{ maxHeight: '600px' }}>
                    <table>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                            <tr>
                                <th>Item / Date</th>
                                <th>Category</th>
                                <th style={{ textAlign: 'right' }}>Cost</th>
                                <th>Tax Method</th>
                                <th style={{ textAlign: 'right' }}>{selectedYear} Deduction</th>
                                <th style={{ textAlign: 'right' }}>Basis</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.map(a => {
                                const ui = STATUS_UI[a.status] || STATUS_UI.active;
                                const cat = CATEGORIES.find(c => c.name === a.category) || CATEGORIES[CATEGORIES.length - 1];
                                return (
                                    <tr key={a.id} style={{ opacity: a.status === 'not_yet_purchased' ? 0.5 : a.status === 'sold' ? 0.7 : 1 }}>
                                        <td>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <div style={{ fontSize: '20px', background: 'rgba(255,255,255,0.05)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>
                                                    {cat.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>{a.description}</div>
                                                    <div className="muted small">
                                                        {a.purchase_date} · {a.vendor}
                                                        {a.serial_number && <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>S/N: {a.serial_number}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className="tag" style={{ fontSize: '11px' }}>{a.category}</span></td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(a.cost * 100)}</td>
                                        <td className="muted small">
                                            {a.depreciation_method === 'section_179' ? 'Section 179' : `${a.useful_life_years}-yr SL`}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: a.deduction_this_year > 0 ? '#4ade80' : 'inherit' }}>
                                            {a.deduction_this_year > 0 ? formatMoney(a.deduction_this_year * 100) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{formatMoney(a.remaining_basis * 100)}</td>
                                        <td>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 800, color: ui.color,
                                                background: ui.bg, padding: '4px 8px', borderRadius: '6px',
                                                textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {ui.label}
                                            </span>
                                            {a.status === 'sold' && a.disposal_date && (
                                                <div className="muted" style={{ fontSize: '9px', marginTop: '4px' }}>Sold {a.disposal_date}</div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button className="btn sm secondary" onClick={() => handleEdit(a)}>Edit</button>
                                                <button className="btn sm danger" onClick={() => handleDelete(a.id)}>×</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!filteredAssets.length && (
                                <tr><td colSpan={8} className="center muted" style={{ padding: '60px' }}>No equipment matches your search.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Form */}
            <div className="card" id="asset-form" style={{
                border: editingAsset ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: editingAsset ? 'rgba(99,102,241,0.03)' : 'inherit'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0 }}>{editingAsset ? '📝 Edit Asset' : '➕ Add Equipment'}</h2>
                    {editingAsset && <button className="btn sm secondary" onClick={() => { setEditingAsset(null); setForm(BLANK); }}>Cancel Edit</button>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    <div className="form-group">
                        <small className="muted">Purchase Date *</small>
                        <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Vendor *</small>
                        <input type="text" placeholder="e.g. Adorama" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <small className="muted">Description *</small>
                        <input type="text" placeholder="e.g. Sony A7M4 Full-Frame Camera Body" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Category</small>
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                            {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <small className="muted">Cost (Purchase Price) *</small>
                        <input type="text" placeholder="$2,695.00" value={form.cost_cents} onChange={e => setForm({ ...form, cost_cents: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Serial Number</small>
                        <input type="text" placeholder="S/N" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Depreciation Method</small>
                        <select value={form.depreciation_method} onChange={e => setForm({ ...form, depreciation_method: e.target.value })}>
                            <option value="straight_line">5-Year Straight-Line</option>
                            <option value="section_179">Section 179 (Full Deduction Yr 1)</option>
                        </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1', height: '1px', background: 'var(--line)', margin: '14px 0' }}></div>

                    {/* Disposal Fields */}
                    <div className="form-group">
                        <small className="muted">Date Sold / Disposed</small>
                        <input type="date" value={form.disposal_date || ''} onChange={e => setForm({ ...form, disposal_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Sale Price (if sold)</small>
                        <input type="text" placeholder="$0.00" value={form.disposal_value_cents || ''} onChange={e => setForm({ ...form, disposal_value_cents: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <small className="muted">Notes</small>
                        <input type="text" placeholder="Any details..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="btn primary" onClick={handleSave} disabled={saving} style={{ padding: '12px 24px' }}>
                        {saving ? 'Saving...' : editingAsset ? 'Update Asset' : 'Save Asset'}
                    </button>
                    {msg && <span style={{ color: msg.includes('❌') ? '#f87171' : '#4ade80', fontWeight: 700, fontSize: '13px' }}>{msg}</span>}
                </div>
            </div>
        </section>
    );
}
