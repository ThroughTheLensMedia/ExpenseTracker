import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, invalidateExpensesCache } from '../api';

export default function Invoice() {
    const [view, setView] = useState('invoices'); // 'invoices' | 'clients'
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showClientForm, setShowClientForm] = useState(false);
    const [syncingId, setSyncingId] = useState(null);
    const [msg, setMsg] = useState('');

    // Form logic
    const [invoiceForm, setInvoiceForm] = useState({
        client_id: '',
        invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: '',
        notes: '',
        tax_percent: 0,
        discount_cents: 0,
        items: [{ description: '', quantity: 1, unit_price_cents: 0 }]
    });

    const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });

    const load = async () => {
        setLoading(true);
        try {
            const [invs, cls] = await Promise.all([
                apiGet('/invoices'),
                apiGet('/invoices/clients')
            ]);
            setInvoices(invs);
            setClients(cls);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreateClient = async () => {
        if (!clientForm.name) return;
        try {
            await apiPost('/invoices/clients', clientForm);
            setClientForm({ name: '', email: '', phone: '', address: '', notes: '' });
            setShowClientForm(false);
            load();
        } catch (e) { setMsg(`Error: ${e.message}`); }
    };

    const handleCreateInvoice = async () => {
        if (!invoiceForm.client_id || !invoiceForm.items.length) return;
        try {
            const payload = {
                ...invoiceForm,
                items: invoiceForm.items.map(it => ({
                    ...it,
                    unit_price_cents: Math.round(parseFloat(it.unit_price) * 100)
                }))
            };
            await apiPost('/invoices', payload);
            setShowInvoiceForm(false);
            load();
        } catch (e) { setMsg(`Error: ${e.message}`); }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await apiPatch(`/invoices/${id}`, { status });
            load();
        } catch (e) { console.error(e); }
    };

    const handlePostToIncome = async (invoice) => {
        setSyncingId(invoice.id);
        try {
            // Calculate total
            const subtotal = invoice.invoice_items.reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
            const tax = subtotal * (invoice.tax_percent / 100);
            const total = Math.round(subtotal + tax - invoice.discount_cents);

            await apiPost('/expenses', {
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: `Invoice ${invoice.invoice_number} - ${invoice.clients?.name}`,
                category: 'Photo Income',
                amount_cents: -total, // Negative is income
                notes: `Auto-posted from Invoices. Invoice #${invoice.invoice_number}`,
                tax_deductible: true,
                tax_bucket: 'Photo Income'
            });
            invalidateExpensesCache();
            setMsg('✅ Income posted to Transactions!');
        } catch (e) {
            setMsg(`Failed to post: ${e.message}`);
        } finally {
            setSyncingId(null);
        }
    };

    const totalReceivable = useMemo(() => {
        return invoices
            .filter(inv => inv.status === 'sent')
            .reduce((sum, inv) => {
                const sub = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                return sum + sub;
            }, 0);
    }, [invoices]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header & Stats */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>💼 Photography CRM & Invoicing</h2>
                        <div className="muted transition-all">Manage clients, track jobs, and post income to taxes.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`btn ${view === 'invoices' ? 'primary' : 'secondary'}`} onClick={() => setView('invoices')}>Invoices</button>
                        <button className={`btn ${view === 'clients' ? 'primary' : 'secondary'}`} onClick={() => setView('clients')}>Clients</button>
                    </div>
                </div>

                <div className="grid three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div className="stat" style={{ background: 'rgba(25, 195, 125, 0.05)', border: '1px solid rgba(25, 195, 125, 0.2)' }}>
                        <div className="k">Pending Receivables (Sent)</div>
                        <div className="v" style={{ color: '#19c37d' }}>{formatMoney(totalReceivable)}</div>
                    </div>
                    <div className="stat">
                        <div className="k">Active Clients</div>
                        <div className="v">{clients.length}</div>
                    </div>
                    <div className="stat">
                        <div className="k">Total Invoiced (All Time)</div>
                        <div className="v">{formatMoney(invoices.reduce((s, inv) => s + (inv.total_cents || 0), 0))}</div>
                    </div>
                </div>
            </div>

            {view === 'invoices' ? (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h2 style={{ margin: 0 }}>Recent Invoices</h2>
                        <button className="btn primary" onClick={() => setShowInvoiceForm(true)}>+ New Invoice</button>
                    </div>

                    <div className="tableWrap">
                        <table>
                            <thead>
                                <tr>
                                    <th># / Date</th>
                                    <th>Client</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => {
                                    const subtotal = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                                    return (
                                        <tr key={inv.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{inv.invoice_number}</div>
                                                <div className="muted small">{inv.issue_date}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{inv.clients?.name}</div>
                                                <div className="muted small">{inv.clients?.email}</div>
                                            </td>
                                            <td>
                                                <select
                                                    value={inv.status}
                                                    onChange={(e) => handleUpdateStatus(inv.id, e.target.value)}
                                                    className={`tag ${inv.status === 'paid' ? 'ok' : inv.status === 'sent' ? 'warn' : ''}`}
                                                    style={{ border: 'none', background: 'transparent', padding: '2px' }}
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="sent">Sent</option>
                                                    <option value="paid">Paid</option>
                                                    <option value="void">Void</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(subtotal)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {inv.status === 'paid' && (
                                                        <button
                                                            className="btn sm ok"
                                                            style={{ fontSize: '11px', padding: '4px 8px' }}
                                                            disabled={syncingId === inv.id}
                                                            onClick={() => handlePostToIncome(inv)}
                                                        >
                                                            {syncingId === inv.id ? 'Syncing...' : '⚡ Post to Income'}
                                                        </button>
                                                    )}
                                                    <button className="btn sm danger" onClick={() => apiDelete(`/invoices/${inv.id}`).then(load)}>×</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!invoices.length && <tr><td colSpan={5} className="center muted" style={{ padding: '40px' }}>No invoices yet. Click "+ New Invoice".</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h2 style={{ margin: 0 }}>Client Directory</h2>
                        <button className="btn primary" onClick={() => setShowClientForm(true)}>+ Add Client</button>
                    </div>
                    <div className="grid two">
                        {clients.map(c => (
                            <div key={c.id} className="card" style={{ margin: 0, background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <h3 style={{ margin: 0 }}>{c.name}</h3>
                                    <button className="btn sm danger" onClick={() => apiDelete(`/invoices/clients/${c.id}`).then(load)}>Delete</button>
                                </div>
                                <div className="muted" style={{ marginTop: '6px' }}>
                                    <div>📧 {c.email || 'No email'}</div>
                                    <div>📞 {c.phone || 'No phone'}</div>
                                    <div style={{ marginTop: '8px', fontSize: '11px' }}>{c.notes}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {showClientForm && (
                <div className="drawer" onClick={() => setShowClientForm(false)}>
                    <div className="drawer-panel" onClick={e => e.stopPropagation()}>
                        <h2>Add New Client</h2>
                        <div className="row">
                            <small className="muted">Name</small>
                            <input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} />

                            <small className="muted">Email</small>
                            <input value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />

                            <small className="muted">Phone</small>
                            <input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} />

                            <small className="muted">Notes</small>
                            <textarea value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} />
                        </div>
                        <div className="controls" style={{ marginTop: '20px' }}>
                            <button className="btn primary" onClick={handleCreateClient}>Save Client</button>
                            <button className="btn secondary" onClick={() => setShowClientForm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showInvoiceForm && (
                <div className="drawer" onClick={() => setShowInvoiceForm(false)}>
                    <div className="drawer-panel" style={{ width: '680px' }} onClick={e => e.stopPropagation()}>
                        <h2>Create Photography Invoice</h2>
                        <div className="grid two">
                            <div>
                                <small className="muted">Client</small>
                                <select value={invoiceForm.client_id} onChange={e => setInvoiceForm({ ...invoiceForm, client_id: e.target.value })}>
                                    <option value="">Select a client...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <small className="muted">Invoice #</small>
                                <input value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
                            </div>
                        </div>
                        <div className="hr"></div>
                        <h3>Line Items</h3>
                        {invoiceForm.items.map((item, idx) => (
                            <div key={idx} className="controls" style={{ marginBottom: '10px' }}>
                                <input placeholder="Description" style={{ flex: 3 }} value={item.description} onChange={e => {
                                    const items = [...invoiceForm.items];
                                    items[idx].description = e.target.value;
                                    setInvoiceForm({ ...invoiceForm, items });
                                }} />
                                <input type="number" placeholder="Qty" style={{ flex: 0.5 }} value={item.quantity} onChange={e => {
                                    const items = [...invoiceForm.items];
                                    items[idx].quantity = Number(e.target.value);
                                    setInvoiceForm({ ...invoiceForm, items });
                                }} />
                                <input placeholder="Price" style={{ flex: 1 }} value={item.unit_price} onChange={e => {
                                    const items = [...invoiceForm.items];
                                    items[idx].unit_price = e.target.value;
                                    setInvoiceForm({ ...invoiceForm, items });
                                }} />
                            </div>
                        ))}
                        <button className="btn sm secondary" onClick={() => setInvoiceForm({ ...invoiceForm, items: [...invoiceForm.items, { description: '', quantity: 1, unit_price_cents: 0 }] })}>+ Add Item</button>

                        <div className="hr"></div>
                        <div className="controls" style={{ marginTop: '20px' }}>
                            <button className="btn primary" onClick={handleCreateInvoice}>Create Invoice</button>
                            <button className="btn secondary" onClick={() => setShowInvoiceForm(false)}>Cancel</button>
                        </div>
                        {msg && <div className="muted" style={{ marginTop: '10px' }}>{msg}</div>}
                    </div>
                </div>
            )}

            {msg && <div className="tag warn" style={{ position: 'fixed', bottom: '20px', right: '20px' }}>{msg} <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button></div>}
        </section>
    );
}
