import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiPatch, apiDelete, formatMoney, invalidateCache, fetchAllClients, fetchAllInvoices } from '../api';
import { useModal } from '../components/ModalContext.jsx';

const BRAND_ORANGE = '#f97316';
const EMPTY_STATS = { openCount: 0, openTotal: 0, paidCount: 0, paidTotal: 0 };

function invoiceTotal(inv) {
    const subtotal = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
    const tax = Math.round(subtotal * (inv.tax_percent / 100));
    const discountPercent = (inv.discount_cents || 0) / 100;
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    return subtotal + tax - discountAmount;
}

export default function Clients() {
    const modal = useModal();
    const navigate = useNavigate();

    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState(null);

    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', dir: 'asc' });

    const [viewingClient, setViewingClient] = useState(null);
    const [editingClient, setEditingClient] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
    const [mergingClient, setMergingClient] = useState(null);
    const [mergeTargetId, setMergeTargetId] = useState('');
    const [emailingClient, setEmailingClient] = useState(null);
    const [emailForm, setEmailForm] = useState({ subject: '', message: '' });

    const load = async () => {
        setLoading(true);
        try {
            const [cls, invs] = await Promise.all([
                fetchAllClients(true),
                fetchAllInvoices(true)
            ]);
            setClients(cls);
            setInvoices(invs);
        } catch (e) {
            console.error('Clients load error:', e);
            setStatusMsg({ type: 'bad', text: 'Failed to load clients.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSort = (key) => {
        if (sortConfig.key === key) {
            setSortConfig({ key, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortConfig({ key, dir: key === 'lifetimeValue' ? 'desc' : 'asc' });
        }
    };

    // Open = status 'sent' (awaiting payment). Paid = status 'paid'. Drafts aren't
    // real money owed yet, so they're excluded here — same semantics already used
    // by Invoice.jsx's "Pending Revenue"/receivables and its client detail drawer.
    const statsByClient = useMemo(() => {
        const m = new Map();
        invoices.forEach(inv => {
            if (inv.client_id == null) return;
            if (inv.status !== 'sent' && inv.status !== 'paid') return;
            const total = invoiceTotal(inv);
            const entry = m.get(inv.client_id) || { ...EMPTY_STATS };
            if (inv.status === 'sent') {
                entry.openCount += 1;
                entry.openTotal += total;
            } else {
                entry.paidCount += 1;
                entry.paidTotal += total;
            }
            m.set(inv.client_id, entry);
        });
        return m;
    }, [invoices]);

    const totals = useMemo(() => {
        let lifetimeValue = 0;
        let outstanding = 0;
        clients.forEach(c => {
            const s = statsByClient.get(c.id) || EMPTY_STATS;
            lifetimeValue += s.paidTotal;
            outstanding += s.openTotal;
        });
        return { lifetimeValue, outstanding };
    }, [clients, statsByClient]);

    const viewingClientInvoices = useMemo(() => {
        if (!viewingClient) return [];
        return invoices
            .filter(inv => inv.client_id === viewingClient.id)
            .map(inv => ({ ...inv, total: invoiceTotal(inv) }))
            .sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date));
    }, [viewingClient, invoices]);

    const visibleClients = useMemo(() => {
        const term = filterText.toLowerCase();
        const filtered = !term ? clients : clients.filter(c => {
            const name = (c.name || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return name.includes(term) || email.includes(term) || phone.includes(term);
        });
        const dirMod = sortConfig.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const sA = statsByClient.get(a.id) || EMPTY_STATS;
            const sB = statsByClient.get(b.id) || EMPTY_STATS;
            if (sortConfig.key === 'open') return (sA.openCount - sB.openCount) * dirMod;
            if (sortConfig.key === 'paid') return (sA.paidCount - sB.paidCount) * dirMod;
            if (sortConfig.key === 'lifetimeValue') return (sA.paidTotal - sB.paidTotal) * dirMod;
            const vA = (a[sortConfig.key] || '').toLowerCase();
            const vB = (b[sortConfig.key] || '').toLowerCase();
            if (vA < vB) return -1 * dirMod;
            if (vA > vB) return 1 * dirMod;
            return 0;
        });
    }, [clients, filterText, sortConfig, statsByClient]);

    const goToNewInvoice = (client) => {
        navigate(`/crm/financials?newInvoiceClientId=${client.id}`);
    };

    const handleDeleteClient = async (client) => {
        const ok = await modal.confirm(`Are you sure you want to permanently delete ${client.name}?`);
        if (!ok) return;
        try {
            await apiDelete(`/invoices/clients/${client.id}`);
            invalidateCache('clients');
            await load();
            setStatusMsg({ type: 'ok', text: 'Client deleted successfully.' });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    const handleMergeClients = async (source, targetId) => {
        const target = clients.find(c => String(c.id) === String(targetId));
        const s = statsByClient.get(source.id) || EMPTY_STATS;
        const n = s.openCount + s.paidCount;
        const ok = await modal.confirm(
            `${n} invoice${n === 1 ? '' : 's'} will move from "${source.name}" to "${target?.name}". ` +
            `"${source.name}" will then be permanently deleted. Continue?`
        );
        if (!ok) return;
        try {
            await apiPost('/invoices/clients/merge', { source_client_id: source.id, target_client_id: targetId });
            invalidateCache('clients');
            setMergingClient(null);
            await load();
            setStatusMsg({ type: 'ok', text: `Merged into ${target?.name}.` });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    const handleEmailClient = async (client) => {
        try {
            await apiPost(`/invoices/clients/${client.id}/email`, emailForm);
            setEmailingClient(null);
            setStatusMsg({ type: 'ok', text: `Email queued to ${client.name}.` });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    const handleSaveEdit = async (client) => {
        try {
            await apiPatch(`/invoices/clients/${client.id}`, editForm);
            invalidateCache('clients');
            setEditingClient(null);
            await load();
            setStatusMsg({ type: 'ok', text: 'Client updated.' });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Dashboard Card */}
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Clients</h1>
                    <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>Search, contact, and manage everyone on file</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <div className="stat glass" style={{ borderTop: '2px solid ' + BRAND_ORANGE, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>TOTAL CLIENTS</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '8px' }}>{clients.length}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #4ade80', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>LIFETIME VALUE</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#4ade80', marginTop: '8px' }}>{formatMoney(totals.lifetimeValue)}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #fbbf24', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>OUTSTANDING</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fbbf24', marginTop: '8px' }}>{formatMoney(totals.outstanding)}</div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ padding: '24px', margin: 0 }}>
                {statusMsg && (
                    <div className={`tag ${statusMsg.type === 'ok' ? 'ok' : 'bad'}`} style={{ marginBottom: '16px', justifyContent: 'center', width: '100%', padding: '12px' }}>
                        {statusMsg.text}
                    </div>
                )}

                <div className="tableWrap">
                    <div style={{ padding: '16px 16px 0' }}>
                        <input
                            placeholder="Search clients by name, email, or phone..."
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            style={{ maxWidth: '360px' }}
                        />
                    </div>
                    {loading && !clients.length ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading clients...</div>
                    ) : (
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Name {sortConfig.key === 'name' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Email {sortConfig.key === 'email' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th onClick={() => handleSort('phone')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Phone {sortConfig.key === 'phone' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th onClick={() => handleSort('open')} style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                        Open {sortConfig.key === 'open' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th onClick={() => handleSort('paid')} style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                        Paid {sortConfig.key === 'paid' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th onClick={() => handleSort('lifetimeValue')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                                        Lifetime Value {sortConfig.key === 'lifetimeValue' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleClients.map(c => {
                                    const s = statsByClient.get(c.id) || EMPTY_STATS;
                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 700 }}>
                                                <span
                                                    onClick={() => setViewingClient(c)}
                                                    style={{ cursor: 'pointer', color: BRAND_ORANGE, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                                                >
                                                    {c.name}
                                                </span>
                                            </td>
                                            <td className="muted small">{c.email || '--'}</td>
                                            <td className="muted small">{c.phone || '--'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {s.openCount > 0 ? <span className="tag warn">{s.openCount}</span> : <span className="muted small">0</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{s.paidCount}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#4ade80' }}>{formatMoney(s.paidTotal)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                    <button className="btn sm primary" onClick={() => goToNewInvoice(c)}>New Invoice</button>
                                                    <button className="btn sm secondary" onClick={() => {
                                                        setEditingClient(c);
                                                        setEditForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
                                                    }}>Edit</button>
                                                    <button className="btn sm secondary" onClick={() => {
                                                        setEmailingClient(c);
                                                        setEmailForm({ subject: '', message: '' });
                                                    }}>Email</button>
                                                    <button className="btn sm secondary" onClick={() => {
                                                        setMergingClient(c);
                                                        setMergeTargetId('');
                                                    }}>Merge into...</button>
                                                    <button className="btn sm sm-icon" onClick={() => handleDeleteClient(c)} style={{ padding: '0 8px', color: '#ff4d4d' }}>✕</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!visibleClients.length && <tr><td colSpan="7" className="muted center" style={{ padding: '60px' }}>No clients found.</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* CLIENT DETAIL DRAWER */}
            {viewingClient && (
                <div className="drawer">
                    <div className="drawer-panel" style={{ width: 'min(560px, 100%)', padding: '24px' }}>
                        <h2 style={{ marginTop: 0 }}>{viewingClient.name}</h2>
                        <div className="muted small" style={{ marginBottom: '8px' }}>
                            {viewingClient.email || 'no email'}{viewingClient.phone ? ` · ${viewingClient.phone}` : ''}
                        </div>
                        {viewingClient.address && <div className="muted small" style={{ marginBottom: '8px' }}>{viewingClient.address}</div>}
                        {viewingClient.notes && (
                            <div className="muted extra-small" style={{ marginBottom: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                {viewingClient.notes}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', marginBottom: '24px' }}>
                            <div className="stat" style={{ flex: 1 }}>
                                <div className="k">Total Paid</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#4ade80' }}>{formatMoney((statsByClient.get(viewingClient.id) || EMPTY_STATS).paidTotal)}</div>
                            </div>
                            <div className="stat" style={{ flex: 1 }}>
                                <div className="k">Outstanding</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#facc15' }}>{formatMoney((statsByClient.get(viewingClient.id) || EMPTY_STATS).openTotal)}</div>
                            </div>
                        </div>

                        <small className="muted" style={{ fontWeight: 800 }}>INVOICES ({viewingClientInvoices.length})</small>
                        <div className="muted extra-small" style={{ marginTop: '4px', marginBottom: '10px' }}>
                            Click an invoice to open it on the Invoicing page.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {viewingClientInvoices.map(inv => (
                                <div
                                    key={inv.id}
                                    onClick={() => navigate('/crm/financials')}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 800, color: BRAND_ORANGE }}>#{inv.invoice_number}</div>
                                        <div className="muted small">{inv.issue_date}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 900 }}>{formatMoney(inv.total)}</div>
                                        <span className={`tag ${inv.status === 'paid' ? 'ok' : 'warn'}`}>{inv.status}</span>
                                    </div>
                                </div>
                            ))}
                            {!viewingClientInvoices.length && <div className="muted small" style={{ padding: '20px 0', textAlign: 'center' }}>No invoices yet.</div>}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={() => setViewingClient(null)}>Close</button>
                            <button className="btn primary" onClick={() => { const c = viewingClient; setViewingClient(null); goToNewInvoice(c); }}>New Invoice</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT CLIENT DRAWER */}
            {editingClient && (
                <div className="drawer">
                    <div className="drawer-panel" style={{ width: 'min(560px, 100%)', padding: '24px' }}>
                        <h2 style={{ marginTop: 0 }}>Edit {editingClient.name}</h2>

                        <small className="muted" style={{ fontWeight: 800 }}>NAME</small>
                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ marginTop: '6px' }} />

                        <div className="grid two" style={{ marginTop: '16px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 800 }}>EMAIL</small>
                                <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ marginTop: '6px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 800 }}>PHONE</small>
                                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ marginTop: '6px' }} />
                            </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <small className="muted" style={{ fontWeight: 800 }}>ADDRESS</small>
                            <input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} style={{ marginTop: '6px' }} />
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <small className="muted" style={{ fontWeight: 800 }}>NOTES</small>
                            <textarea
                                rows={4}
                                value={editForm.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                style={{ width: '100%', marginTop: '6px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={() => setEditingClient(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                disabled={!editForm.name.trim()}
                                onClick={() => handleSaveEdit(editingClient)}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MERGE CLIENT DRAWER */}
            {mergingClient && (
                <div className="drawer">
                    <div className="drawer-panel" style={{ width: 'min(420px, 100%)', padding: '24px' }}>
                        <h2 style={{ marginTop: 0 }}>Merge "{mergingClient.name}"</h2>
                        <p className="muted small">
                            All invoices and leads linked to this client will move to the client you choose below,
                            then "{mergingClient.name}" will be permanently deleted.
                        </p>
                        <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)}>
                            <option value="">-- Select target client --</option>
                            {clients.filter(c => c.id !== mergingClient.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.email || 'no email'})</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={() => setMergingClient(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                disabled={!mergeTargetId}
                                onClick={() => handleMergeClients(mergingClient, mergeTargetId)}
                            >
                                Merge
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EMAIL CLIENT DRAWER */}
            {emailingClient && (
                <div className="drawer">
                    <div className="drawer-panel" style={{ width: 'min(560px, 100%)', padding: '24px' }}>
                        <h2 style={{ marginTop: 0 }}>Email {emailingClient.name}</h2>
                        <div className="muted small" style={{ marginBottom: '16px' }}>To: {emailingClient.email || 'no email on file'}</div>
                        <small className="muted" style={{ fontWeight: 800 }}>SUBJECT</small>
                        <input value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} style={{ marginTop: '6px' }} />
                        <small className="muted" style={{ fontWeight: 800, marginTop: '16px', display: 'block' }}>MESSAGE</small>
                        <textarea
                            rows={8}
                            value={emailForm.message}
                            onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                            style={{ width: '100%', marginTop: '6px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={() => setEmailingClient(null)}>Cancel</button>
                            <button
                                className="btn primary"
                                disabled={!emailingClient.email || !emailForm.subject.trim() || !emailForm.message.trim()}
                                onClick={() => handleEmailClient(emailingClient)}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
