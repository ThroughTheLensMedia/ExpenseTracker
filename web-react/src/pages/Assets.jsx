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
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [form, setForm] = useState(BLANK);
    const [editingAsset, setEditingAsset] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([2024, 2025, 2026]);
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
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [selectedYear]);

    const handleSave = async () => {
        if (!form.purchase_date || !form.vendor || !form.description || !form.cost_cents) {
            setMsg('⚠️ Missing details.'); return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                cost_cents: typeof form.cost_cents === 'string' ? parseDollar(form.cost_cents) : form.cost_cents,
                disposal_value_cents: form.disposal_value_cents ? parseDollar(form.disposal_value_cents) : null,
                disposal_date: form.disposal_date || null
            };
            if (editingAsset) await apiPatch(`/assets/${editingAsset.id}`, payload);
            else await apiPost('/assets', payload);
            setForm(BLANK); setEditingAsset(null); setMsg('✅ Asset Saved'); load();
        } catch (e) { setMsg(`❌ Error: ${e.message}`); }
        finally { setSaving(false); }
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
        if (!confirm('Delete asset?')) return;
        await apiDelete(`/assets/${id}`); load();
    };

    const filteredAssets = useMemo(() => {
        const list = deprData?.assets || [];
        if (!searchTerm) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(a =>
            a.description.toLowerCase().includes(q) ||
            a.vendor.toLowerCase().includes(q) ||
            (a.serial_number || '').toLowerCase().includes(q)
        );
    }, [deprData, searchTerm]);

    const stats = useMemo(() => {
        const totalCost = assets.reduce((s, a) => s + Number(a.cost_cents || 0), 0);
        const totalDepr = deprData?.total_deduction_cents || 0;
        return { totalCost, totalDepr };
    }, [assets, deprData]);

    const STATUS_UI = {
        active: { color: '#6366f1', label: 'In Locker', bg: 'rgba(99,102,241,0.1)' },
        fully_depreciated: { color: '#4ade80', label: 'Depreciated', bg: 'rgba(74,222,128,0.1)' },
        sold: { color: '#facc15', label: 'Sold', bg: 'rgba(250,204,21,0.1)' },
        not_yet_purchased: { color: '#94a3b8', label: 'Upcoming', bg: 'rgba(148,163,184,0.1)' }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Elite Header */}
            <div className="card glass glow-blue" style={{ padding: '30px', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-1px' }}>⚙️ Equipment Locker</h2>
                        <div className="muted" style={{ fontSize: '15px' }}>Asset Inventory & MACRS Depreciation Schedule</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <small className="muted">Viewing Tax Year</small>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            style={{ width: '120px', fontSize: '18px', fontWeight: 800, marginTop: '4px', background: 'rgba(255,255,255,0.05)' }}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                    <div className="stat glass" style={{ padding: '24px', borderRadius: '24px' }}>
                        <div className="muted small">TOTAL LOCKER VALUE</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: '8px' }}>{formatMoney(stats.totalCost)}</div>
                        <div className="muted small" style={{ marginTop: '8px' }}>{assets.length} Professional Assets</div>
                    </div>
                    <div className="stat glass glow-green" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(25, 195, 125, 0.4)' }}>
                        <div className="muted small" style={{ color: '#4ade80' }}>{selectedYear} TAX DEDUCTION</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#4ade80', marginTop: '8px' }}>{formatMoney(stats.totalDepr)}</div>
                        <div className="muted small" style={{ marginTop: '8px' }}>Schedule C · Line 13</div>
                    </div>
                    <div className="stat glass" style={{ padding: '24px', borderRadius: '24px' }}>
                        <div className="muted small">ASSET MIX</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                            {CATEGORIES.slice(0, 5).map(c => (
                                <div key={c.name} title={c.name} style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                    {c.icon}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Controls */}
            <div className="card glass" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Inventory</h2>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px' }}>
                            <button
                                className={`btn sm ${viewMode === 'grid' ? 'primary' : 'secondary'}`}
                                style={{ border: 'none', borderRadius: '8px' }}
                                onClick={() => setViewMode('grid')}
                            >Grid</button>
                            <button
                                className={`btn sm ${viewMode === 'table' ? 'primary' : 'secondary'}`}
                                style={{ border: 'none', borderRadius: '8px' }}
                                onClick={() => setViewMode('table')}
                            >Table</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            placeholder="Search Locker..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '250px', background: 'rgba(255,255,255,0.05)' }}
                        />
                        {assets.length === 0 && (
                            <button className="btn primary" onClick={() => { }}>📥 Seed List</button>
                        )}
                    </div>
                </div>

                {viewMode === 'table' ? (
                    <div className="tableWrap" style={{ marginTop: '20px' }}>
                        <table className="glass">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Cost</th>
                                    <th>Tax Method</th>
                                    <th>{selectedYear} Ded.</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAssets.map(a => (
                                    <tr key={a.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{a.description}</div>
                                            <div className="muted small">{a.purchase_date} · {a.vendor}</div>
                                        </td>
                                        <td><span className="tag">{a.category}</span></td>
                                        <td style={{ fontWeight: 600 }}>{formatMoney(a.cost * 100)}</td>
                                        <td className="muted small">{a.depreciation_method}</td>
                                        <td style={{ color: '#4ade80', fontWeight: 800 }}>{formatMoney(a.deduction_this_year * 100)}</td>
                                        <td><span style={{ fontSize: '10px', fontWeight: 800, color: STATUS_UI[a.status]?.color }}>{STATUS_UI[a.status]?.label}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn sm secondary" onClick={() => handleEdit(a)}>Edit</button>
                                                <button className="btn sm danger" onClick={() => handleDelete(a.id)}>×</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="locker-grid">
                        {filteredAssets.map(a => {
                            const cat = CATEGORIES.find(c => c.name === a.category) || CATEGORIES[CATEGORIES.length - 1];
                            const ui = STATUS_UI[a.status] || STATUS_UI.active;
                            return (
                                <div key={a.id} className="gear-slot glass" style={{ opacity: a.status === 'sold' ? 0.6 : 1 }}>
                                    <div className="cat-icon">{cat.icon}</div>
                                    <div className="price-tag">{formatMoney(a.cost * 100)}</div>
                                    <div className="status-pill">
                                        <span style={{
                                            fontSize: '9px', fontWeight: 900, color: ui.color,
                                            background: ui.bg, padding: '3px 8px', borderRadius: '6px',
                                            textTransform: 'uppercase', letterSpacing: '0.05em'
                                        }}>{ui.label}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '16px', lineHeight: 1.2 }}>{a.description}</div>
                                        <div className="muted small" style={{ marginTop: '4px' }}>{a.vendor} · {a.purchase_date}</div>
                                    </div>
                                    <div className="meta">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <span className="muted">Tax {selectedYear}</span>
                                            <span style={{ fontWeight: 800, color: a.deduction_this_year > 0 ? '#4ade80' : 'inherit' }}>
                                                {formatMoney(a.deduction_this_year * 100)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <span className="muted">Method</span>
                                            <span className="muted">{a.depreciation_method === 'section_179' ? 'Sec 179' : '5-yr SL'}</span>
                                        </div>
                                    </div>
                                    <div className="actions">
                                        <button className="btn sm secondary" style={{ flex: 1 }} onClick={() => handleEdit(a)}>Edit</button>
                                        <button className="btn sm danger" onClick={() => handleDelete(a.id)}>×</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Form Glass Panel */}
            <div className="card glass" style={{ border: editingAsset ? '1px solid var(--accent)' : 'none' }}>
                <h2 style={{ marginBottom: '20px' }}>{editingAsset ? '📝 Edit Asset' : '➕ Add to Locker'}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                        <small className="muted">Purchase Date</small>
                        <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Vendor</small>
                        <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <small className="muted">Description</small>
                        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Category</small>
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                            {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <small className="muted">Cost (Purchase Price)</small>
                        <input value={form.cost_cents} onChange={e => setForm({ ...form, cost_cents: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <small className="muted">Date Sold (Optional)</small>
                        <input type="date" value={form.disposal_date || ''} onChange={e => setForm({ ...form, disposal_date: e.target.value })} />
                    </div>
                </div>
                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="btn primary" onClick={handleSave} disabled={saving} style={{ padding: '12px 30px' }}>
                        {saving ? 'Syncing...' : editingAsset ? 'Update Asset' : 'Add to Locker'}
                    </button>
                    {editingAsset && <button className="btn secondary" onClick={() => { setEditingAsset(null); setForm(BLANK); }}>Cancel</button>}
                    {msg && <span style={{ fontWeight: 800, fontSize: '13px' }}>{msg}</span>}
                </div>
            </div>
        </section>
    );
}
