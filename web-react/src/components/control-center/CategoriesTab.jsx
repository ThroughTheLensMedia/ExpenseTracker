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

function guessType(name) {
    const lc = name.toLowerCase();
    if (lc.includes('income') || lc.includes('refund') || lc.includes('reimburs') || lc.includes('cashback') || lc.includes('reward') || lc.includes('transfer') || lc.includes('deposit')) return 'income';
    return 'expense';
}

export default function CategoriesTab() {
    const [customCats, setCustomCats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Orphan review state
    const [orphanCats, setOrphanCats] = useState([]); // raw strings from DB
    const [showReview, setShowReview] = useState(false);
    // reviewItems: [{ name, editName, type, skip }]
    const [reviewItems, setReviewItems] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { imported, skipped }

    const load = useCallback(async () => {
        try {
            const data = await apiGet('/categories');
            setCustomCats(Array.isArray(data) ? data : []);
        } catch (_) {}
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Fetch orphan categories (freeform strings not in any known list)
    useEffect(() => {
        apiGet('/expenses/distinct-categories').then(data => {
            if (!Array.isArray(data)) return;
            const allKnown = new Set([...ALL_CATEGORIES, ...customCats.map(c => c.name)]);
            const orphans = data.filter(c => c && !allKnown.has(c));
            setOrphanCats(orphans);
            // Reset review items whenever the orphan list changes
            setReviewItems(orphans.map(name => ({ name, editName: name, type: guessType(name), skip: false })));
        }).catch(() => {});
    }, [customCats]);

    const updateItem = (i, patch) =>
        setReviewItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));

    const handleImportSelected = async () => {
        setImporting(true);
        let imported = 0, skipped = 0;
        for (const item of reviewItems) {
            if (item.skip) { skipped++; continue; }
            try { await apiPost('/categories', { name: item.editName.trim(), type: item.type }); imported++; }
            catch (_) { skipped++; }
        }
        await load();
        setImporting(false);
        setShowReview(false);
        setImportResult({ imported, skipped });
        setTimeout(() => setImportResult(null), 5000);
    };

    const toImport = reviewItems.filter(it => !it.skip).length;

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

            {/* Import result toast */}
            {importResult && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>
                    ✓ Imported {importResult.imported} categor{importResult.imported === 1 ? 'y' : 'ies'}{importResult.skipped > 0 ? ` · ${importResult.skipped} skipped` : ''}
                </div>
            )}

            {/* Orphan review banner */}
            {orphanCats.length > 0 && !showReview && (
                <div className="card glass" style={{ padding: '16px 20px', border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '13px', marginBottom: '2px' }}>Unrecognized categories found</div>
                            <div className="muted" style={{ fontSize: '12px' }}>
                                {orphanCats.length} categor{orphanCats.length === 1 ? 'y' : 'ies'} in your transactions aren't in the list:{' '}
                                <em>{orphanCats.slice(0, 5).join(', ')}{orphanCats.length > 5 ? `, +${orphanCats.length - 5} more` : ''}</em>
                            </div>
                        </div>
                        <button className="btn" onClick={() => setShowReview(true)} style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            Review &amp; Import
                        </button>
                    </div>
                </div>
            )}

            {/* Orphan review panel */}
            {showReview && (
                <div className="card glass" style={{ padding: '20px 24px', border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '14px', marginBottom: '2px' }}>Review Unrecognized Categories</div>
                            <div className="muted" style={{ fontSize: '12px' }}>Edit names or types, then uncheck any you want to skip. {toImport} of {reviewItems.length} will be imported.</div>
                        </div>
                        <button className="btn secondary" onClick={() => setShowReview(false)} style={{ fontSize: '12px' }}>Cancel</button>
                    </div>

                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 140px 60px', gap: '8px', padding: '0 4px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }}>
                        <div />
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category Name</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skip</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto', marginBottom: '16px' }}>
                        {reviewItems.map((item, i) => (
                            <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 140px 60px', gap: '8px', alignItems: 'center', opacity: item.skip ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                                <div style={{ fontSize: '13px', color: item.skip ? 'rgba(255,255,255,0.2)' : '#4ade80' }}>
                                    {item.skip ? '—' : '✓'}
                                </div>
                                <input
                                    value={item.editName}
                                    onChange={e => updateItem(i, { editName: e.target.value })}
                                    disabled={item.skip}
                                    style={{ fontSize: '13px', padding: '5px 8px' }}
                                />
                                <select
                                    value={item.type}
                                    onChange={e => updateItem(i, { type: e.target.value })}
                                    disabled={item.skip}
                                    style={{ fontSize: '12px', padding: '5px 6px' }}
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="misc_income">Misc Income</option>
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={item.skip}
                                        onChange={e => updateItem(i, { skip: e.target.checked })}
                                        style={{ width: 'auto', margin: 0 }}
                                    />
                                </label>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn secondary" onClick={() => setReviewItems(prev => prev.map(it => ({ ...it, skip: true })))} style={{ fontSize: '12px' }}>Skip All</button>
                        <button className="btn secondary" onClick={() => setReviewItems(prev => prev.map(it => ({ ...it, skip: false })))} style={{ fontSize: '12px' }}>Select All</button>
                        <button className="btn" onClick={handleImportSelected} disabled={importing || toImport === 0} style={{ fontSize: '12px' }}>
                            {importing ? 'Importing…' : `Import ${toImport}`}
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
