import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, invalidateExpensesCache } from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Elite Invoice Branding
const BRAND_ORANGE = '#f97316';

function InvoiceItemRow({ item, index, onChange, onRemove }) {
    return (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 80px 120px 40px', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <input
                placeholder="Description (e.g. Wedding Photography Package)"
                value={item.description}
                onChange={e => onChange(index, 'description', e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px' }}
            />
            <input
                type="number"
                placeholder="Qty"
                value={item.quantity}
                onChange={e => onChange(index, 'quantity', Number(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px', textAlign: 'center' }}
            />
            <input
                type="number"
                placeholder="Price"
                value={item.unit_price}
                onChange={e => onChange(index, 'unit_price', e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px', textAlign: 'right' }}
            />
            <button className="btn sm danger" onClick={() => onRemove(index)} style={{ padding: '8px' }}>✕</button>
        </div>
    );
}

function InvoicePreview({ invoice, onClose }) {
    const previewRef = useRef();

    const subtotal = (invoice.items || []).reduce((s, it) => s + (Number(it.unit_price || 0) * (it.quantity || 1)), 0);
    const tax = Math.round(subtotal * (invoice.tax_percent / 100));
    const total = subtotal + tax - (Number(invoice.discount) || 0);

    const handleDownloadPDF = async () => {
        const element = previewRef.current;
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice_${invoice.number}.pdf`);
    };

    return (
        <div className="drawer" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 20000 }}>
            <div className="drawer-panel" style={{ width: 'min(900px, 95%)', background: '#fff', color: '#1a1a1a', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 40px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#1a1a1a' }}>Invoice Preview</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn glow-blue" onClick={handleDownloadPDF} style={{ padding: '10px 24px' }}>Download PDF</button>
                        <button className="btn secondary" onClick={onClose} style={{ color: '#1a1a1a', borderColor: '#ccc' }}>Close</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '60px 80px' }}>
                    <div ref={previewRef} style={{ background: '#fff', width: '100%', minHeight: '1000px' }}>
                        {/* INVOICE HEADER */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '60px' }}>
                            <div>
                                <img src="/logo.png" alt="TTL Logo" style={{ height: '100px', objectFit: 'contain' }} />
                                <div style={{ marginTop: '20px', fontSize: '14px', lineHeight: '1.6' }}>
                                    <div style={{ fontWeight: 800 }}>THROUGH THE LENS MEDIA</div>
                                    <div style={{ color: '#666' }}>Professional Photography & Media Services</div>
                                    <div style={{ color: '#666' }}>United States</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h1 style={{ margin: 0, fontSize: '48px', fontWeight: 200, color: BRAND_ORANGE, letterSpacing: '4px' }}>INVOICE</h1>
                                <div style={{ marginTop: '20px', fontSize: '14px' }}>
                                    <div style={{ color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Invoice Number</div>
                                    <div style={{ fontSize: '20px', fontWeight: 800 }}>#{invoice.number}</div>

                                    <div style={{ marginTop: '16px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Date issued</div>
                                    <div style={{ fontWeight: 800 }}>{invoice.date}</div>

                                    <div style={{ marginTop: '16px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Due Date</div>
                                    <div style={{ fontWeight: 800 }}>{invoice.dueDate || 'Upon Receipt'}</div>
                                </div>
                            </div>
                        </div>

                        {/* CLIENT INFO */}
                        <div style={{ marginBottom: '60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                            <div>
                                <div style={{ color: BRAND_ORANGE, textTransform: 'uppercase', fontWeight: 900, fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>Bill To</div>
                                <div style={{ fontSize: '18px', fontWeight: 800 }}>{invoice.clientName}</div>
                                <div style={{ color: '#666', fontSize: '15px', marginTop: '4px' }}>{invoice.clientEmail}</div>
                                <div style={{ color: '#666', fontSize: '15px' }}>{invoice.clientPhone}</div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${BRAND_ORANGE}` }}>
                                    <th style={{ padding: '16px 0', textAlign: 'left', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Description</th>
                                    <th style={{ padding: '16px 0', textAlign: 'center', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', width: '80px' }}>Qty</th>
                                    <th style={{ padding: '16px 0', textAlign: 'right', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', width: '120px' }}>Unit Price</th>
                                    <th style={{ padding: '16px 0', textAlign: 'right', color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', width: '120px' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items || []).map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '24px 0', fontSize: '15px', fontWeight: 700 }}>{it.description}</td>
                                        <td style={{ padding: '24px 0', textAlign: 'center', fontSize: '15px' }}>{it.quantity}</td>
                                        <td style={{ padding: '24px 0', textAlign: 'right', fontSize: '15px' }}>{formatMoney(Number(it.unit_price) * 100)}</td>
                                        <td style={{ padding: '24px 0', textAlign: 'right', fontSize: '15px', fontWeight: 800 }}>{formatMoney(Number(it.unit_price) * it.quantity * 100)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* TOTALS */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px' }}>
                                    <div style={{ color: '#666' }}>Subtotal</div>
                                    <div style={{ fontWeight: 700 }}>{formatMoney(subtotal * 100)}</div>
                                </div>
                                {invoice.tax_percent > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px' }}>
                                        <div style={{ color: '#666' }}>Tax ({invoice.tax_percent}%)</div>
                                        <div style={{ fontWeight: 700 }}>{formatMoney(tax * 100)}</div>
                                    </div>
                                )}
                                {invoice.discount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px' }}>
                                        <div style={{ color: '#666' }}>Discount</div>
                                        <div style={{ fontWeight: 700, color: '#ff4d4d' }}>-{formatMoney(Number(invoice.discount) * 100)}</div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: '1px solid #eee', marginTop: '12px' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 900, color: BRAND_ORANGE }}>Total Due</div>
                                    <div style={{ fontSize: '24px', fontWeight: 950 }}>{formatMoney(total * 100)}</div>
                                </div>
                            </div>
                        </div>

                        {/* NOTES */}
                        {invoice.notes && (
                            <div style={{ marginTop: '80px', paddingTop: '40px', borderTop: '1px solid #eee' }}>
                                <div style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Notes & Terms</div>
                                <div style={{ fontSize: '13px', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{invoice.notes}</div>
                            </div>
                        )}

                        <div style={{ marginTop: '120px', textAlign: 'center', color: '#ccc', fontSize: '11px', letterSpacing: '1px' }}>
                            THANK YOU FOR YOUR BUSINESS
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Invoice() {
    const [view, setView] = useState('invoices'); // 'invoices' | 'clients'
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form logic
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [previewingInvoice, setPreviewingInvoice] = useState(null);

    // Creator State
    const [formData, setFormData] = useState({
        number: '',
        date: new Date().toISOString().slice(0, 10),
        dueDate: '',
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        items: [{ description: '', quantity: 1, unit_price: '' }],
        tax_percent: 0,
        discount: 0,
        notes: 'Payment is due within 15 days. Thank you for choosing Through The Lens Media!'
    });

    const load = async () => {
        setLoading(true);
        try {
            const [invs, cls, lds] = await Promise.all([
                apiGet('/invoices'),
                apiGet('/invoices/clients'),
                apiGet('/leads')
            ]);
            setInvoices(invs);
            setClients(cls);
            setLeads(lds.leads || []);

            // Auto-increment invoice number
            if (invs.length > 0) {
                const last = invs[0].invoice_number;
                const match = last.match(/\d+/);
                if (match) {
                    const next = parseInt(match[0]) + 1;
                    setFormData(prev => ({ ...prev, number: last.replace(/\d+/, String(next).padStart(match[0].length, '0')) }));
                }
            } else {
                setFormData(prev => ({ ...prev, number: 'INV-1001' }));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleLeadSelect = (e) => {
        const leadId = e.target.value;
        if (!leadId) return;
        const lead = leads.find(l => String(l.id) === leadId);
        if (lead) {
            setFormData(prev => ({
                ...prev,
                clientId: lead.client_id || '', // If they have an existing client link
                clientName: lead.name,
                clientEmail: lead.email,
                clientPhone: lead.phone,
                discount: 0,
                notes: lead.notes ? `Project Notes: ${lead.notes}` : prev.notes
            }));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unit_price: '' }] }));
    };

    const removeItem = (index) => {
        if (formData.items.length === 1) return;
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    const handleCreateInvoice = async (e) => {
        e.preventDefault();
        try {
            let finalClientId = formData.clientId;

            // 1. Create client if needed
            if (!finalClientId) {
                const newClient = await apiPost('/invoices/clients', {
                    name: formData.clientName,
                    email: formData.clientEmail,
                    phone: formData.clientPhone
                });
                finalClientId = newClient.id;
            }

            // 2. Insert Invoice
            const payload = {
                client_id: finalClientId,
                invoice_number: formData.number,
                issue_date: formData.date,
                due_date: formData.dueDate || null,
                status: 'sent',
                notes: formData.notes,
                tax_percent: Number(formData.tax_percent),
                discount_cents: Math.round(Number(formData.discount) * 100),
                items: formData.items.map(it => ({
                    description: it.description,
                    quantity: Number(it.quantity),
                    unit_price_cents: Math.round(Number(it.unit_price) * 100)
                }))
            };

            await apiPost('/invoices', payload);
            setIsCreatorOpen(false);
            load();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSyncToExpenses = async (invoice) => {
        try {
            const subtotal = (invoice.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
            const tax = Math.round(subtotal * (invoice.tax_percent / 100));
            const total = subtotal + tax - (invoice.discount_cents || 0);

            await apiPost('/expenses', {
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: `Through The Lens Media - INV #${invoice.invoice_number}`,
                category: 'Photo Income',
                amount_cents: -total, // Negative is income
                notes: `Auto-synced from Invoice #${invoice.invoice_number}`,
                tax_deductible: true,
                tax_bucket: 'Gross Receipts'
            });
            invalidateExpensesCache();
            alert("Income synced to ledger!");
        } catch (err) {
            alert(err.message);
        }
    };

    const receivables = useMemo(() => {
        return invoices
            .filter(inv => inv.status === 'sent')
            .reduce((sum, inv) => {
                const sub = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                const tax = Math.round(sub * (inv.tax_percent / 100));
                return sum + sub + tax - (inv.discount_cents || 0);
            }, 0);
    }, [invoices]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Elite Invoice Dashboard */}
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>
                            Business Invoicing
                        </h1>
                        <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>
                            Through The Lens Media · Billing & Receivables
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`pill ${view === 'invoices' ? 'active' : ''}`} onClick={() => setView('invoices')}>Invoices</button>
                        <button className={`pill ${view === 'clients' ? 'active' : ''}`} onClick={() => setView('clients')}>Clients</button>
                        <button className="btn glow-blue" onClick={() => setIsCreatorOpen(true)} style={{ marginLeft: '10px', padding: '10px 24px' }}>
                            + Create Invoice
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <div className="stat glass glow-green" style={{ borderTop: '2px solid #4ade80' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>PENDING REVENUE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: '#4ade80', marginTop: '8px' }}>
                            {formatMoney(receivables)}
                        </div>
                        <div className="tag" style={{ fontSize: '9px', marginTop: '12px' }}>AWAITING PAYMENT</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '2px solid #38bdf8' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>TOTAL INVOICED</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, marginTop: '8px' }}>
                            {invoices.length}
                        </div>
                        <div className="tag" style={{ fontSize: '9px', marginTop: '12px' }}>LIFETIME DOCS</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: `2px solid ${BRAND_ORANGE}` }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>CLIENTS</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, marginTop: '8px' }}>
                            {clients.length}
                        </div>
                        <div className="tag" style={{ fontSize: '9px', marginTop: '12px' }}>INVOICE DIRECTORY</div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ padding: '24px', margin: 0 }}>
                {view === 'invoices' ? (
                    <div className="tableWrap">
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '150px' }}># / Date</th>
                                    <th>Client</th>
                                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => {
                                    const subtotal = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                                    const tax = Math.round(subtotal * (inv.tax_percent / 100));
                                    const total = subtotal + tax - (inv.discount_cents || 0);
                                    return (
                                        <tr key={inv.id}>
                                            <td style={{ fontWeight: 800 }}>
                                                <div style={{ color: BRAND_ORANGE }}>#{inv.invoice_number}</div>
                                                <div className="muted small">{inv.issue_date}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{inv.clients?.name}</div>
                                                <div className="muted small">{inv.clients?.email}</div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '15px' }}>{formatMoney(total)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`tag ${inv.status === 'paid' ? 'ok' : (inv.status === 'sent' ? 'warn' : 'secondary')}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button className="btn sm secondary" onClick={() => setPreviewingInvoice({
                                                        number: inv.invoice_number,
                                                        date: inv.issue_date,
                                                        dueDate: inv.due_date,
                                                        clientName: inv.clients?.name,
                                                        clientEmail: inv.clients?.email,
                                                        clientPhone: inv.clients?.phone,
                                                        items: inv.invoice_items.map(it => ({
                                                            description: it.description,
                                                            quantity: Number(it.quantity),
                                                            unit_price: it.unit_price_cents / 100
                                                        })),
                                                        tax_percent: inv.tax_percent,
                                                        discount: inv.discount_cents / 100,
                                                        notes: inv.notes
                                                    })}>Preview</button>
                                                    {inv.status !== 'paid' && (
                                                        <button className="btn sm primary" onClick={() => apiPatch(`/invoices/${inv.id}`, { status: 'paid' }).then(load)}>Mark Paid</button>
                                                    )}
                                                    {inv.status === 'paid' && (
                                                        <button className="btn sm glow-blue" onClick={() => handleSyncToExpenses(inv)}>Sync Ledger</button>
                                                    )}
                                                    <button className="btn sm danger" onClick={() => apiDelete(`/invoices/${inv.id}`).then(load)}>✕</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!invoices.length && <tr><td colSpan="5" className="muted center" style={{ padding: '60px' }}>No invoices found. Click "+ Create Invoice" to start.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="locker-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', margin: 0 }}>
                        {clients.map(c => (
                            <div key={c.id} className="card glass gear-slot" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div className="cat-icon" style={{ fontSize: '24px', width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)' }}>👤</div>
                                    <button className="btn sm danger" style={{ border: 'none', background: 'transparent' }} onClick={() => apiDelete(`/invoices/clients/${c.id}`).then(load)}>✕</button>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>{c.name}</h3>
                                    <div className="muted" style={{ marginTop: '4px' }}>{c.email || 'No email saved'}</div>
                                    <div className="muted small">{c.phone || 'No phone saved'}</div>
                                </div>
                                <div className="hr" style={{ margin: '8px 0' }}></div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn secondary sm" style={{ flex: 1, fontSize: '11px' }}>Project History</button>
                                    <button className="btn sm primary" style={{ flex: 1, fontSize: '11px' }} onClick={() => {
                                        setIsCreatorOpen(true);
                                        setFormData(prev => ({ ...prev, clientName: c.name, clientEmail: c.email || '', clientPhone: c.phone || '', clientId: c.id }));
                                    }}>New Invoice</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CREATOR DRAWER */}
            {isCreatorOpen && (
                <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') setIsCreatorOpen(false); }}>
                    <div className="drawer-panel" style={{ width: 'min(700px, 100%)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h2 style={{ margin: 0, fontScale: '1.4rem' }}>Create Elite Invoice</h2>
                            <button className="btn secondary" onClick={() => setIsCreatorOpen(false)}>Cancel</button>
                        </div>

                        <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>INVOICE NUMBER</small>
                                    <input value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>ISSUE DATE</small>
                                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                            </div>

                            <div className="hr"></div>

                            <div>
                                <small className="muted" style={{ fontWeight: 800 }}>IMPORT FROM CRM LEAD (OPTIONAL)</small>
                                <select onChange={handleLeadSelect} style={{ background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                                    <option value="">-- Select active lead --</option>
                                    {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.status})</option>)}
                                </select>
                            </div>

                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>CLIENT NAME</small>
                                    <input required value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>CLIENT EMAIL</small>
                                    <input value={formData.clientEmail} onChange={e => setFormData({ ...formData, clientEmail: e.target.value })} />
                                </div>
                            </div>

                            <div className="hr"></div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <small className="muted" style={{ fontWeight: 800 }}>INVOICE ITEMS</small>
                                    <button type="button" className="btn sm secondary" onClick={addItem}>+ Add Line</button>
                                </div>
                                {formData.items.map((it, idx) => (
                                    <InvoiceItemRow
                                        key={idx}
                                        item={it}
                                        index={idx}
                                        onChange={handleItemChange}
                                        onRemove={removeItem}
                                    />
                                ))}
                            </div>

                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>TAX RATE (%)</small>
                                    <input type="number" value={formData.tax_percent} onChange={e => setFormData({ ...formData, tax_percent: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>DISCOUNT ($)</small>
                                    <input type="number" value={formData.discount} onChange={e => setFormData({ ...formData, discount: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <small className="muted" style={{ fontWeight: 800 }}>NOTES & TERMS</small>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    style={{ minHeight: '100px' }}
                                />
                            </div>

                            <button type="submit" className="btn glow-blue" style={{ height: '56px', fontSize: '1.1rem' }}>
                                GENERATE INVOICE
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {previewingInvoice && (
                <InvoicePreview
                    invoice={previewingInvoice}
                    onClose={() => setPreviewingInvoice(null)}
                />
            )}

        </section>
    );
}
