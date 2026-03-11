import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, fetchExpenseYears } from '../api';
import { useModal } from '../components/ModalContext.jsx';

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

const BLANK = {
    purchase_date: '', vendor: '', description: '', category: 'Camera',
    cost_cents: '', serial_number: '', receipt_on_file: false,
    depreciation_method: 'straight_line', notes: '',
    disposal_date: '', disposal_value_cents: ''
};

export default function Assets() {
    const modal = useModal();
    const [assets, setAssets] = useState([]);
    const [deprData, setDeprData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table'); // Default changed to 'table'
    const [form, setForm] = useState(BLANK);
    const [editingAsset, setEditingAsset] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([2024, 2025, 2026]);
    const [searchTerm, setSearchTerm] = useState('');

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
        // Handle both cost (dollars from depr route) and cost_cents (cents from raw route)
        let displayCost = '';
        if (asset.cost !== undefined) displayCost = Number(asset.cost).toFixed(2);
        else if (asset.cost_cents !== undefined) displayCost = (Number(asset.cost_cents) / 100).toFixed(2);

        setForm({
            ...asset,
            cost_cents: displayCost,
            disposal_value_cents: asset.disposal_value_cents ? (Number(asset.disposal_value_cents) / 100).toFixed(2) : '',
            disposal_date: asset.disposal_date || ''
        });
        // Scroll to form for visibility
        setTimeout(() => {
            const formHeading = document.querySelector('h3');
            if (formHeading) formHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const handleDelete = async (id) => {
        const ok = await modal.confirm('Delete this equipment asset?');
        if (!ok) return;
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
        active: { color: '#6366f1', label: 'Locker', bg: 'rgba(99,102,241,0.1)' },
        fully_depreciated: { color: '#4ade80', label: 'Depreciated', bg: 'rgba(74,222,128,0.1)' },
        sold: { color: '#facc15', label: 'Sold', bg: 'rgba(250,204,21,0.1)' },
        not_yet_purchased: { color: '#94a3b8', label: 'Upcoming', bg: 'rgba(148,163,184,0.1)' }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Elite Compact Header */}
            <div className="card glass glow-blue" style={{ padding: '20px 24px', border: 'none', margin: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.5px' }}>⚙️ Equipment Locker</h2>
                        <div className="muted" style={{ fontSize: '13px' }}>MACRS Depreciation Dashboard</div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                            <small className="muted" style={{ display: 'block', letterSpacing: '0.05em', fontSize: '10px' }}>TAX YEAR</small>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                style={{ width: '90px', fontSize: '15px', fontWeight: 800, marginTop: '2px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div className="stat glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>TOTAL LOCKER VALUE</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, marginTop: '4px' }}>{formatMoney(stats.totalCost)}</div>
                        <div className="muted small" style={{ fontSize: '11px', marginTop: '4px' }}>{assets.length} Active Items</div>
                    </div>
                    <div className="stat glass glow-green" style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid rgba(25, 195, 125, 0.4)' }}>
                        <div className="muted small" style={{ color: '#4ade80', fontSize: '10px' }}>{selectedYear} TAX DEDUCTION</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>{formatMoney(stats.totalDepr)}</div>
                        <div className="muted small" style={{ fontSize: '11px', marginTop: '4px' }}>Sch C · Line 13</div>
                    </div>
                    <div className="stat glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>ASSET MIX</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            {CATEGORIES.slice(0, 7).map(c => (
                                <div key={c.name} title={c.name} style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                                    {c.icon}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card glass" style={{ padding: '16px 20px', margin: '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Inventory</h2>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px' }}>
                                    <button
                                        className={`btn ${viewMode === 'grid' ? 'primary' : 'secondary'}`}
                                        style={{ border: 'none', borderRadius: '7px', fontSize: '11px', padding: '4px 10px' }}
                                        onClick={() => setViewMode('grid')}
                                    >Grid</button>
                                    <button
                                        className={`btn ${viewMode === 'table' ? 'primary' : 'secondary'}`}
                                        style={{ border: 'none', borderRadius: '7px', fontSize: '11px', padding: '4px 10px' }}
                                        onClick={() => setViewMode('table')}
                                    >Table</button>
                                </div>
                            </div>
                            <input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: '180px', fontSize: '12px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}
                            />
                        </div>

                        {viewMode === 'table' ? (
                            <div className="tableWrap" style={{ maxHeight: '600px' }}>
                                <table className="glass" style={{ minWidth: '600px' }}>
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Cost</th>
                                            <th>{selectedYear} Ded.</th>
                                            <th>Status</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAssets.map(a => (
                                            <tr key={a.id}>
                                                <td style={{ padding: '8px 10px' }}>
                                                    <div style={{ fontWeight: 700 }}>{a.description}</div>
                                                    <div className="muted small" style={{ fontSize: '10px' }}>{a.purchase_date} · {a.vendor}</div>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{formatMoney(a.cost * 100)}</td>
                                                <td style={{ color: '#4ade80', fontWeight: 800 }}>{formatMoney(a.deduction_this_year * 100)}</td>
                                                <td><span style={{ fontSize: '9px', fontWeight: 800, color: STATUS_UI[a.status]?.color }}>{STATUS_UI[a.status]?.label}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button className="btn sm secondary" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleEdit(a)}>Edit</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="locker-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginTop: '0' }}>
                                {filteredAssets.map(a => {
                                    const cat = CATEGORIES.find(c => c.name === a.category) || CATEGORIES[CATEGORIES.length - 1];
                                    const ui = STATUS_UI[a.status] || STATUS_UI.active;
                                    return (
                                        <div key={a.id} className="gear-slot glass" style={{ opacity: a.status === 'sold' ? 0.6 : 1, padding: '14px', borderRadius: '18px' }}>
                                            <div className="cat-icon" style={{ width: '38px', height: '38px', fontSize: '20px', borderRadius: '12px' }}>{cat.icon}</div>
                                            <div className="price-tag" style={{ top: '14px', right: '14px', fontSize: '12px' }}>{formatMoney(a.cost * 100)}</div>
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ fontWeight: 800, fontSize: '13px', lineHeight: 1.2 }}>{a.description}</div>
                                                <div className="muted small" style={{ fontSize: '10px', marginTop: '2px' }}>{a.vendor}</div>
                                            </div>
                                            <div className="meta" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '9px', fontWeight: 900, color: ui.color, background: ui.bg, padding: '2px 6px', borderRadius: '5px' }}>{ui.label}</span>
                                                <span style={{ fontWeight: 800, color: a.deduction_this_year > 0 ? '#4ade80' : 'inherit', fontSize: '11px' }}>
                                                    {formatMoney(a.deduction_this_year * 100)}
                                                </span>
                                            </div>
                                            <div className="actions" style={{ marginTop: '10px', opacity: 1 }}>
                                                <button className="btn sm secondary" style={{ flex: 1, fontSize: '10px', padding: '3px' }} onClick={() => handleEdit(a)}>Edit</button>
                                                <button className="btn sm danger" style={{ fontSize: '10px', padding: '3px' }} onClick={() => handleDelete(a.id)}>×</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Form */}
                <div className="card glass" style={{ padding: '16px 20px', border: editingAsset ? '1px solid var(--accent)' : 'none', position: 'sticky', top: '16px', margin: '0' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>{editingAsset ? '📝 Edit Asset' : '➕ Add to Locker'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <small className="muted" style={{ fontSize: '10px' }}>Description</small>
                            <input style={{ fontSize: '12px', padding: '8px' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Sony A7IV..." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <small className="muted" style={{ fontSize: '10px' }}>Category</small>
                                <select style={{ fontSize: '12px', padding: '8px' }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                    {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <small className="muted" style={{ fontSize: '10px' }}>Cost</small>
                                <input style={{ fontSize: '12px', padding: '8px' }} value={form.cost_cents} onChange={e => setForm({ ...form, cost_cents: e.target.value })} placeholder="0.00" />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <small className="muted" style={{ fontSize: '10px' }}>Purchase Date</small>
                                <input type="date" style={{ fontSize: '12px', padding: '8px' }} value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontSize: '10px' }}>Vendor</small>
                                <input style={{ fontSize: '12px', padding: '8px' }} value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Adorama..." />
                            </div>
                        </div>
                        <div className="hr"></div>
                        <div>
                            <small className="muted" style={{ fontSize: '10px' }}>Date Sold (Optional)</small>
                            <input type="date" style={{ fontSize: '12px', padding: '8px' }} value={form.disposal_date || ''} onChange={e => setForm({ ...form, disposal_date: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="btn primary" onClick={handleSave} disabled={saving} style={{ padding: '10px', fontSize: '13px' }}>
                            {saving ? 'Saving...' : editingAsset ? 'Update Asset' : 'Add to Locker'}
                        </button>
                        {editingAsset && <button className="btn secondary" style={{ fontSize: '12px' }} onClick={() => { setEditingAsset(null); setForm(BLANK); }}>Cancel</button>}
                        {msg && <div className="muted" style={{ fontSize: '11px', textAlign: 'center', fontWeight: 800 }}>{msg}</div>}
                    </div>
                </div>

            </div>
        </section>
    );
}
