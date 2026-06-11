import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';
import { CATEGORY_GROUPS, ALL_CATEGORIES } from '../../constants/categories.js';

// Map CATEGORY_GROUPS group label → API type key
const GROUP_TYPE = { Expenses: 'expense', Income: 'income', 'Misc Income': 'misc_income' };
const TYPE_LABEL = { expense: 'Expense', income: 'Income', misc_income: 'Misc Income' };

function AddCategoryForm({ type, onSaved }) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setSaving(true);
        setErr('');
        try {
            await apiPost('/categories', { name: trimmed, type });
            setName('');
            if (onSaved) onSaved();
        } catch (e) {
            setErr(e?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
            <input
                value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                placeholder="New category name…"
                style={{ flex: 1, fontSize: '13px' }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
            <button className="btn" onClick={handleSave} disabled={saving || !name.trim()} style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                {saving ? 'Saving…' : '+ Add'}
            </button>
            {err && <span style={{ color: '#f87171', fontSize: '12px' }}>{err}</span>}
        </div>
    );
}

function CustomCategoryRow({ cat, onRenamed, onDeleted }) {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(cat.name);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // null | { count }

    const handleRename = async () => {
        if (editName.trim() === cat.name) { setEditing(false); return; }
        setSaving(true);
        try {
            await apiPut(`/categories/${cat.id}`, { name: editName.trim() });
            setEditing(false);
            if (onRenamed) onRenamed();
        } catch (e) {
            alert(e?.message || 'Rename failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (force = false) => {
        setDeleting(true);
        try {
            await apiDelete(`/categories/${cat.id}${force ? '?force=true' : ''}`);
            if (onDeleted) onDeleted();
        } catch (e) {
            if (e?.status === 409 || (e?.message && e.message.includes('transaction'))) {
                const match = e.message.match(/^(\d+)/);
                setConfirmDelete({ count: match ? parseInt(match[1]) : '?' });
            } else {
                alert(e?.message || 'Delete failed.');
            }
        } finally {
            setDeleting(false);
        }
    };

    if (confirmDelete) {
        return (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <span style={{ flex: 1, fontSize: '13px', color: '#f87171' }}>
                    {confirmDelete.count} transaction{confirmDelete.count === 1 ? '' : 's'} use <strong>{cat.name}</strong>. Delete anyway?
                </span>
                <button className="btn" onClick={() => handleDelete(true)} disabled={deleting} style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(248,113,113,0.2)', color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}>
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button className="btn secondary" onClick={() => setConfirmDelete(null)} style={{ fontSize: '12px', padding: '4px 10px' }}>Cancel</button>
            </div>
        );
    }

    if (editing) {
        return (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ flex: 1, fontSize: '13px' }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
                />
                <button className="btn" onClick={handleRename} disabled={saving} style={{ fontSize: '12px', padding: '4px 10px' }}>
                    {saving ? '…' : 'Save'}
                </button>
                <button className="btn secondary" onClick={() => { setEditing(false); setEditName(cat.name); }} style={{ fontSize: '12px', padding: '4px 10px' }}>Cancel</button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)' }}>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{cat.name} <span style={{ fontSize: '11px', color: '#38bdf8' }}>✦ Custom</span></span>
            <button
                onClick={() => { setEditing(true); setEditName(cat.name); }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer' }}
            >
                Rename
            </button>
            <button
                onClick={() => handleDelete(false)}
                disabled={deleting}
                style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '11px', padding: '3px 8px', cursor: 'pointer' }}
            >
                {deleting ? '…' : 'Delete'}
            </button>
        </div>
    );
}

export default function CategoriesTab() {
    const [customCats, setCustomCats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Track which expense categories from transactions are not in any known list
    const [orphanCats, setOrphanCats] = useState([]);
    const [importing, setImporting] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await apiGet('/categories');
            setCustomCats(Array.isArray(data) ? data : []);
        } catch (_) {}
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Fetch orphan categories (freeform strings in expenses not in any list)
    useEffect(() => {
        apiGet('/expenses/distinct-categories').then(data => {
            if (!Array.isArray(data)) return;
            const allKnown = new Set(ALL_CATEGORIES);
            setOrphanCats(data.filter(c => c && !allKnown.has(c)));
        }).catch(() => {});
    }, [customCats]);

    const importOrphans = async () => {
        setImporting(true);
        let count = 0;
        for (const name of orphanCats) {
            const type = (name.toLowerCase().includes('income') || name.toLowerCase().includes('refund')) ? 'income' : 'expense';
            try { await apiPost('/categories', { name, type }); count++; } catch (_) {}
        }
        await load();
        setImporting(false);
        if (count) alert(`Imported ${count} categor${count === 1 ? 'y' : 'ies'}.`);
    };

    const catsByType = { expense: [], income: [], misc_income: [] };
    for (const c of customCats) {
        if (catsByType[c.type]) catsByType[c.type].push(c);
    }

    if (loading) return <div className="muted" style={{ padding: '40px', textAlign: 'center' }}>Loading…</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>Categories</h2>
                <p className="muted" style={{ fontSize: '13px', marginBottom: 0 }}>
                    Built-in categories are read-only. Add your own to any group — they'll appear in all dropdowns marked with ✦.
                </p>
            </div>

            {/* Orphan import banner */}
            {orphanCats.length > 0 && (
                <div className="card glass" style={{ padding: '16px 20px', border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '13px', marginBottom: '2px' }}>Unrecognized categories found</div>
                            <div className="muted" style={{ fontSize: '12px' }}>
                                {orphanCats.length} categor{orphanCats.length === 1 ? 'y' : 'ies'} in your transactions aren't in the list:{' '}
                                <em>{orphanCats.slice(0, 5).join(', ')}{orphanCats.length > 5 ? `, +${orphanCats.length - 5} more` : ''}</em>
                            </div>
                        </div>
                        <button className="btn" onClick={importOrphans} disabled={importing} style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {importing ? 'Importing…' : 'Import All'}
                        </button>
                    </div>
                </div>
            )}

            {/* One section per group */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {CATEGORY_GROUPS.map(({ group, items }) => {
                    const typeKey = GROUP_TYPE[group];
                    const myCustom = catsByType[typeKey] || [];
                    return (
                        <div key={group} className="card glass" style={{ padding: '20px 24px' }}>
                            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {group}
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '2px 6px' }}>
                                    {items.length + myCustom.length} total
                                </span>
                            </div>

                            {/* Built-in — read-only */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: myCustom.length ? '12px' : '0' }}>
                                {items.map(name => (
                                    <div key={name} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
                                        {name}
                                    </div>
                                ))}
                            </div>

                            {/* Custom — editable */}
                            {myCustom.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                    {myCustom.map(cat => (
                                        <CustomCategoryRow key={cat.id} cat={cat} onRenamed={load} onDeleted={load} />
                                    ))}
                                </div>
                            )}

                            <AddCategoryForm type={typeKey} onSaved={load} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
