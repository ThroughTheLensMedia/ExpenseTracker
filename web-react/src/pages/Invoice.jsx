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
                placeholder="Description"
                value={item.description || ''}
                onChange={e => onChange(index, 'description', e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px' }}
            />
            <input
                type="number"
                placeholder="Qty"
                value={item.quantity || ''}
                onChange={e => onChange(index, 'quantity', Number(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px', textAlign: 'center' }}
            />
            <input
                type="number"
                placeholder="Price"
                value={item.unit_price || ''}
                onChange={e => onChange(index, 'unit_price', e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', fontSize: '13px', textAlign: 'right' }}
            />
            <button type="button" className="btn sm danger" onClick={() => onRemove(index)} style={{ padding: '8px' }}>✕</button>
        </div>
    );
}

function InvoicePreview({ invoice, settings = {}, onClose }) {
    const previewRef = useRef();

    // Data Normalization: Handle both API structure and Draft State structure
    const data = useMemo(() => {
        // Defensive check: find which array has the actual data
        const rawSource = (invoice.items && invoice.items.length > 0) ? invoice.items : (invoice.invoice_items || []);

        const items = rawSource.map(it => ({
            description: it.description || '---',
            quantity: parseFloat(it.quantity) || 0,
            unit_price: it.unit_price_cents ? (it.unit_price_cents / 100) : (parseFloat(it.unit_price) || 0)
        }));

        const subtotal = items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
        const discount = invoice.discount_cents ? (invoice.discount_cents / 100) : (parseFloat(invoice.discount) || 0);
        const taxVal = Math.round(subtotal * ((invoice.tax_percent || 0) / 100));
        const total = subtotal + taxVal - discount;

        return {
            number: invoice.number || invoice.invoice_number || '---',
            date: invoice.date || invoice.issue_date || '---',
            dueDate: invoice.dueDate || invoice.due_date,
            clientName: invoice.clientName || invoice.clients?.name || '---',
            clientEmail: invoice.clientEmail || invoice.clients?.email || '',
            clientPhone: invoice.clientPhone || invoice.clients?.phone || '',
            items,
            subtotal,
            taxVal,
            discount,
            total,
            tax_percent: invoice.tax_percent || 0
        };
    }, [invoice]);

    const handleDownloadPDF = async () => {
        const element = previewRef.current;
        const canvas = await html2canvas(element, { scale: 3, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice_${data.number}.pdf`);
    };

    const formatDate = (d) => {
        if (!d) return '---';
        const date = new Date(d);
        return isNaN(date.getTime()) ? d : date.toLocaleDateString();
    };

    return (
        <div className="drawer" style={{ background: 'rgba(0,0,0,0.92)', zIndex: 20000 }}>
            <div className="drawer-panel" style={{ width: 'min(1000px, 98%)', background: '#f5f5f5', color: '#1a1a1a', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 40px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                    <h3 style={{ margin: 0, color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '13px' }}>Executive Snapshot</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn glow-blue" onClick={handleDownloadPDF} style={{ padding: '10px 24px' }}>Capture PDF Assets</button>
                        <button className="btn secondary" onClick={onClose} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>Return to Studio</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                    <div ref={previewRef} style={{ background: '#fff', width: '210mm', minWidth: '210mm', minHeight: '297mm', margin: '0 auto', padding: '80px 100px', boxShadow: '0 0 60px rgba(0,0,0,0.15)', position: 'relative', boxSizing: 'border-box' }}>

                        {/* HEADER */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '80px' }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '42px', fontWeight: 300, color: '#000', letterSpacing: '4px', textTransform: 'uppercase' }}>INVOICE</h1>
                                <div style={{ marginTop: '30px', fontSize: '12px', color: '#666', lineHeight: '1.8' }}>
                                    <div style={{ fontWeight: 900, color: '#000', fontSize: '16px', marginBottom: '8px' }}>{settings?.business_name || 'Through The Lens Media'}</div>
                                    {settings?.tax_id && <div>Tax ID: {settings.tax_id}</div>}
                                    {settings?.studio_address && <div style={{ whiteSpace: 'pre-wrap' }}>{settings.studio_address}</div>}
                                </div>
                            </div>
                            <div>
                                {settings?.logo_url ? (
                                    <div style={{ width: '220px', height: '140px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: '#fff' }}>
                                        <img src={settings.logo_url} alt="Studio Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: '180px', height: '180px', background: '#fafafa', border: '3px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                        <div style={{ fontSize: '42px' }}>📸</div>
                                        <div style={{ fontSize: '12px', fontWeight: 950, textTransform: 'uppercase', marginTop: '10px', letterSpacing: '2px' }}>Pure Capture</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BILL TO & DETAILS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '80px' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '8px', display: 'inline-block' }}>BILL TO</div>
                                <div style={{ fontSize: '16px', fontWeight: 800 }}>{data.clientName}</div>
                                <div style={{ fontSize: '14px', color: '#444', marginTop: '4px' }}>{data.clientEmail}</div>
                                <div style={{ fontSize: '14px', color: '#444' }}>{data.clientPhone}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', fontSize: '14px' }}>
                                <div style={{ fontWeight: 800, color: '#666' }}>Invoice No.</div>
                                <div style={{ textAlign: 'right', fontWeight: 900 }}>{data.number}</div>
                                <div style={{ fontWeight: 800, color: '#666' }}>Issue Date</div>
                                <div style={{ textAlign: 'right' }}>{formatDate(data.date)}</div>
                                <div style={{ fontWeight: 800, color: '#666' }}>Due Date</div>
                                <div style={{ textAlign: 'right' }}>{data.dueDate ? formatDate(data.dueDate) : 'Day of Photoshoot'}</div>
                            </div>
                        </div>

                        {/* LINE ITEMS HEADER */}
                        <div style={{ background: '#000', color: '#fff', display: 'flex', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', borderRadius: '4px 4px 0 0' }}>
                            <div style={{ flex: 1, padding: '15px 20px', letterSpacing: '1px' }}>Service Description</div>
                            <div style={{ width: '80px', padding: '15px', textAlign: 'center' }}>Qty</div>
                            <div style={{ width: '120px', padding: '15px', textAlign: 'right' }}>Unit Price</div>
                            <div style={{ width: '120px', padding: '15px 20px', textAlign: 'right' }}>Total</div>
                        </div>

                        {/* LINE ITEMS LIST */}
                        <div style={{ marginBottom: '60px', border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
                            {data.items.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No line items generated for this snapshot.</div>
                            ) : data.items.map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', borderBottom: idx === data.items.length - 1 ? 'none' : '1px solid #f5f5f5', fontSize: '14px', alignItems: 'center' }}>
                                    <div style={{ flex: 1, padding: '20px', fontWeight: 500 }}>{it.description || '---'}</div>
                                    <div style={{ width: '80px', padding: '20px', textAlign: 'center' }}>{it.quantity}</div>
                                    <div style={{ width: '120px', padding: '20px', textAlign: 'right' }}>{formatMoney(Number(it.unit_price) * 100)}</div>
                                    <div style={{ width: '120px', padding: '20px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(Number(it.unit_price) * it.quantity * 100)}</div>
                                </div>
                            ))}
                        </div>

                        {/* TOTALS BOX */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <div style={{ width: '320px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', padding: '8px 20px', color: '#666' }}>
                                    <div>Subtotal</div>
                                    <div style={{ textAlign: 'right' }}>{formatMoney(data.subtotal * 100)}</div>
                                </div>
                                {data.discount > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', padding: '8px 20px', color: '#ff4d4d', fontWeight: 600 }}>
                                        <div>Studio Discount</div>
                                        <div style={{ textAlign: 'right' }}>-{formatMoney(data.discount * 100)}</div>
                                    </div>
                                )}
                                {data.tax_percent > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', padding: '8px 20px', color: '#666' }}>
                                        <div>Tax Rate ({data.tax_percent}%)</div>
                                        <div style={{ textAlign: 'right' }}>{formatMoney(data.taxVal * 100)}</div>
                                    </div>
                                )}
                                <div style={{ marginTop: '15px', background: '#fcfcfc', borderTop: '2px solid #000', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '15px', alignItems: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Due</div>
                                    <div style={{ textAlign: 'right', fontSize: '32px', fontWeight: 900, color: '#000' }}>{formatMoney(data.total * 100)}</div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM SECTIONS */}
                        <div style={{ marginTop: '60px', fontSize: '13px', lineHeight: '1.8' }}>
                            {invoice.notes && (
                                <div style={{ marginBottom: '30px' }}>
                                    <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px' }}>Notes</div>
                                    <div style={{ color: '#444', background: '#fafafa', padding: '15px', borderRadius: '4px' }}>{invoice.notes}</div>
                                </div>
                            )}
                            {settings?.standard_terms && (
                                <div style={{ marginBottom: '30px' }}>
                                    <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px' }}>Studio Terms</div>
                                    <div style={{ color: '#666', fontSize: '12px' }}>{settings.standard_terms}</div>
                                </div>
                            )}

                            {settings?.payment_methods && (
                                <div style={{ padding: '40px 0', minHeight: '120px' }}>
                                    <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '15px', color: '#888' }}>Payment Instructions</div>
                                    <div style={{ color: '#000', fontWeight: 700, fontSize: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{settings.payment_methods}</div>
                                </div>
                            )}
                        </div>

                        {/* FOOTER */}
                        <div style={{ marginTop: '100px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '40px' }}>
                            <div style={{
                                fontFamily: 'Papyrus, "Palatino Linotype", "Book Antiqua", Palatino, serif',
                                fontSize: '17px',
                                fontWeight: 'bold',
                                letterSpacing: '2px',
                                color: '#000'
                            }}>
                                {settings?.website || 'throughthelens.media'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#999', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {settings?.business_email || settings?.contact_email || ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Invoice() {
    const [view, setView] = useState('invoices');
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [leads, setLeads] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [previewingInvoice, setPreviewingInvoice] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null); // { type: 'ok'|'bad', text: '' }

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
        leadId: '',
        notes: ''
    });

    const resetFormData = () => {
        setFormData({
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
            leadId: '',
            notes: ''
        });
        setEditingId(null);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [invs, cls, lds, st] = await Promise.all([
                apiGet('/invoices'),
                apiGet('/invoices/clients'),
                apiGet('/leads'),
                apiGet('/settings').catch(() => ({}))
            ]);
            setInvoices(invs);
            setClients(cls);
            setLeads(lds.leads || []);
            const settingsData = st || {};
            setSettings(settingsData);

            // Set default notes if empty and auto-increment invoice number
            setFormData(prev => ({
                ...prev,
                notes: prev.notes || settingsData.invoice_notes || ''
            }));

            if (invs.length > 0) {
                // Scan ledger for highest numeric value to prevent collisions
                let max = 1000;
                let prefix = 'INV-';
                invs.forEach(inv => {
                    const match = inv.invoice_number.match(/(\d+)/);
                    if (match) {
                        const val = parseInt(match[1], 10);
                        if (val > max) max = val;
                        // Extract prefix if it varies, otherwise default to INV-
                        const pMatch = inv.invoice_number.match(/^([A-Za-z0-9]+-)/);
                        if (pMatch) prefix = pMatch[1];
                    }
                });
                const nextNum = max + 1;
                setFormData(prev => ({ ...prev, number: `${prefix}${nextNum}` }));
            } else {
                setFormData(prev => ({ ...prev, number: 'INV-1001' }));
            }
        } catch (e) {
            console.error("Invoice load error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { description: '', quantity: 1, unit_price: '' }]
        }));
    };

    const handleLeadSelect = (val) => {
        const leadId = typeof val === 'object' ? val.target.value : val;
        if (!leadId) return;
        const lead = leads.find(l => String(l.id) === leadId);
        if (lead) {
            const existingClient = clients.find(c => c.email?.toLowerCase() === lead.email?.toLowerCase());

            setFormData(prev => ({
                ...prev,
                leadId: lead.id || '',
                clientId: existingClient ? existingClient.id : '',
                clientName: lead.name || '',
                clientEmail: lead.email || '',
                clientPhone: lead.phone || '',
                discount: 0
            }));
        }
    };

    const handleEdit = async (inv) => {
        setLoading(true);
        try {
            const fullInv = await apiGet(`/invoices/${inv.id}`);
            setEditingId(fullInv.id);
            const invItems = fullInv.invoice_items || [];
            setFormData({
                number: fullInv.invoice_number,
                date: fullInv.issue_date,
                dueDate: fullInv.due_date || '',
                clientId: fullInv.client_id,
                clientName: fullInv.clients?.name || '',
                clientEmail: fullInv.clients?.email || '',
                clientPhone: fullInv.clients?.phone || '',
                items: invItems.length > 0 ? invItems.map(it => ({
                    description: it.description,
                    quantity: it.quantity,
                    unit_price: (it.unit_price_cents / 100).toFixed(2)
                })) : [{ description: '', quantity: 1, unit_price: '' }],
                tax_percent: fullInv.tax_percent || 0,
                discount: (fullInv.discount_cents / 100).toFixed(2),
                leadId: fullInv.lead_id || '',
                notes: fullInv.notes || ''
            });
            setIsCreatorOpen(true);
        } catch (e) {
            console.error("Failed to load invoice items", e);
            setStatusMsg({ type: 'bad', text: "Failed to load full invoice details." });
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (inv) => {
        setLoading(true);
        try {
            const fullInv = await apiGet(`/invoices/${inv.id}`);
            setPreviewingInvoice(fullInv);
        } catch (e) {
            console.error("Failed to preview", e);
            setStatusMsg({ type: 'bad', text: "Failed to load preview details." });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvoice = async (e) => {
        if (e) e.preventDefault();
        setStatusMsg(null);

        // Client-side validation
        if (!formData.clientName) {
            setStatusMsg({ type: 'bad', text: 'Client Name is required.' });
            return;
        }
        if (!formData.number) {
            setStatusMsg({ type: 'bad', text: 'Invoice Number is required.' });
            return;
        }
        const emptyItem = formData.items.findIndex(it => !it.description.trim());
        if (emptyItem !== -1) {
            setStatusMsg({ type: 'bad', text: `Line Item #${emptyItem + 1} must have a description.` });
            return;
        }

        setLoading(true);
        try {
            let finalClientId = formData.clientId;
            if (!finalClientId) {
                const newClient = await apiPost('/invoices/clients', {
                    name: formData.clientName,
                    email: formData.clientEmail,
                    phone: formData.clientPhone
                });
                finalClientId = newClient.id;
            }

            const payload = {
                client_id: finalClientId,
                lead_id: formData.leadId || null,
                invoice_number: formData.number,
                issue_date: formData.date,
                due_date: formData.dueDate || null,
                status: editingId ? undefined : 'draft', // Preserve status on edit, default to draft on new
                notes: formData.notes,
                tax_percent: Number(formData.tax_percent),
                discount_cents: Math.round(Number(formData.discount) * 100),
                items: formData.items.map(it => ({
                    description: it.description,
                    quantity: Number(it.quantity),
                    unit_price_cents: Math.round(Number(it.unit_price) * 100)
                }))
            };

            if (editingId) {
                await apiPatch(`/invoices/${editingId}`, payload);
            } else {
                await apiPost('/invoices', payload);
            }

            // Success handshake
            setLoading(false);
            setIsCreatorOpen(false);
            resetFormData();

            // Async non-blocking load
            setTimeout(load, 10);
        } catch (err) {
            let errorText = err.message;
            try {
                // Try to parse Zod / JSON errors
                const parsed = JSON.parse(err.message);
                if (Array.isArray(parsed) && parsed[0]?.message) {
                    errorText = `${parsed[0].path?.join(' -> ') || 'Error'}: ${parsed[0].message}`;
                }
            } catch (e) { /* use raw message */ }

            setStatusMsg({ type: 'bad', text: errorText });
            setLoading(false);
        }
    };

    const handleSyncToExpenses = async (invoice) => {
        try {
            const subtotal = (invoice.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
            const tax = Math.round(subtotal * (invoice.tax_percent / 100));
            const total = subtotal + tax - (invoice.discount_cents || 0);

            await apiPost('/expenses', {
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: `${settings.business_name || 'Studio'} - INV #${invoice.invoice_number}`,
                category: 'Photo Income',
                amount_cents: -total,
                notes: `Auto-synced from Invoice #${invoice.invoice_number}`,
                tax_deductible: true,
                tax_bucket: 'Gross Receipts'
            });
            setStatusMsg({ type: 'ok', text: "Income synced to ledger!" });
        } catch (err) {
            console.error("Sync failed", err);
            setStatusMsg({ type: 'bad', text: "Sync failed. Check console." });
        }
    };

    const handleSendEmail = async (invoice) => {
        try {
            await apiPatch(`/invoices/${invoice.id}`, { status: 'sent' });
            load();
            setStatusMsg({ type: 'ok', text: `Invoice #${invoice.invoice_number} dispatched to client successfully!` });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    const handleMarkPaid = async (id) => {
        try {
            await apiPatch(`/invoices/${id}`, { status: 'paid' });
            load();
            setStatusMsg({ type: 'ok', text: "Invoice marked as Paid!" });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
        }
    };

    const handleDeleteInvoice = async (id) => {
        if (!confirm("Are you sure you want to permanently delete this invoice?")) return;
        try {
            await apiDelete(`/invoices/${id}`);
            load();
            setStatusMsg({ type: 'ok', text: "Invoice deleted successfully." });
        } catch (err) {
            setStatusMsg({ type: 'bad', text: err.message });
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

    const draftCount = useMemo(() => {
        return invoices.filter(inv => inv.status === 'draft').length;
    }, [invoices]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Dashboard Card */}
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Business Invoicing</h1>
                        <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>{settings.business_name || 'Elite Photography Studio'} · Receivables Control</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`pill ${view === 'invoices' ? 'active' : ''}`} onClick={() => setView('invoices')}>Ledger</button>
                        <button className={`pill ${view === 'clients' ? 'active' : ''}`} onClick={() => setView('clients')}>Clients</button>
                        <button className="btn glow-blue" onClick={() => setIsCreatorOpen(true)} style={{ marginLeft: '10px', padding: '10px 24px' }}>+ Create Invoice</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <div className="stat glass" style={{ borderTop: '4px solid #4ade80' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>PENDING REVENUE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: '#4ade80', marginTop: '8px' }}>{formatMoney(receivables)}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #38bdf8' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>TOTAL INVOICED</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, marginTop: '8px' }}>{invoices.length}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #fbbf24' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>REVIEW QUEUE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: '#fbbf24', marginTop: '8px' }}>{draftCount} Drafts</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: `2px solid ${BRAND_ORANGE}` }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>CLIENT BASE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, marginTop: '8px' }}>{clients.length}</div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ padding: '24px', margin: 0 }}>
                {statusMsg && !isCreatorOpen && (
                    <div className={`tag ${statusMsg.type === 'ok' ? 'ok' : 'bad'}`} style={{ marginBottom: '16px', justifyContent: 'center', width: '100%', padding: '12px' }}>
                        {statusMsg.text}
                    </div>
                )}
                {view === 'invoices' ? (
                    <div className="tableWrap">
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th># / Date</th>
                                    <th>Client</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
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
                                            <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatMoney(total)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`tag ${inv.status === 'paid' ? 'ok' : 'warn'}`}>{inv.status}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button className="btn sm secondary" onClick={() => handlePreview(inv)}>Preview</button>
                                                    {(inv.status === 'draft' || inv.status === 'sent') && (
                                                        <button className="btn sm secondary" onClick={() => handleEdit(inv)}>Edit</button>
                                                    )}
                                                    {inv.status === 'draft' && (
                                                        <button className="btn sm glow-blue" onClick={() => handleSendEmail(inv)}>Send Email</button>
                                                    )}
                                                    {inv.status === 'sent' && (
                                                        <button className="btn sm primary" onClick={() => handleMarkPaid(inv.id)}>Mark Paid</button>
                                                    )}
                                                    {inv.status === 'paid' && (
                                                        <button className="btn sm glow-blue" onClick={() => handleSyncToExpenses(inv)}>Sync Ledger</button>
                                                    )}
                                                    <button className="btn sm sm-icon" onClick={() => handleDeleteInvoice(inv.id)} style={{ padding: '0 8px', color: '#ff4d4d' }}>✕</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!invoices.length && <tr><td colSpan="5" className="muted center" style={{ padding: '60px' }}>No invoices.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="locker-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', margin: 0 }}>
                        {clients.map(c => (
                            <div key={c.id} className="card glass gear-slot" style={{ margin: 0, padding: '24px' }}>
                                <h3 style={{ margin: 0, fontWeight: 900 }}>{c.name}</h3>
                                <div className="muted small">{c.email}</div>
                                <div className="hr" style={{ margin: '15px 0' }}></div>
                                <button className="btn sm primary" style={{ width: '100%' }} onClick={() => {
                                    setIsCreatorOpen(true);
                                    setFormData(prev => ({ ...prev, clientName: c.name || '', clientEmail: c.email || '', clientPhone: c.phone || '', clientId: c.id }));
                                }}>New Invoice</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CREATOR DRAWER */}
            {isCreatorOpen && (
                <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') { setIsCreatorOpen(false); resetFormData(); } }}>
                    <div className="drawer-panel" style={{ width: 'min(700px, 100%)', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{editingId ? 'Edit' : 'Create'} Invoice</h2>
                            <button type="button" className="btn secondary" onClick={() => { setIsCreatorOpen(false); resetFormData(); }}>Cancel</button>
                        </div>

                        <form onSubmit={handleCreateInvoice} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>INVOICE NUMBER</small>
                                    <input value={formData.number || ''} onChange={e => setFormData({ ...formData, number: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>ISSUE DATE</small>
                                    <input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>DUE DATE (OPTIONAL)</small>
                                    <input type="date" value={formData.dueDate || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                                    <div className="muted extra-small" style={{ marginTop: '4px' }}>Defaults to "Day of Photoshoot" if empty.</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="button" className="btn sm secondary" style={{ width: '100%' }} onClick={() => setPreviewingInvoice(formData)}>
                                        👁️ Preview Current Draft
                                    </button>
                                </div>
                            </div>

                            <div className="hr"></div>

                            {!editingId && (
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>CRM IMPORT (OPTIONAL)</small>
                                    <select onChange={handleLeadSelect} style={{ background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                                        <option value="">-- No lead selected --</option>
                                        {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>CLIENT NAME</small>
                                    <input required value={formData.clientName || ''} onChange={e => setFormData({ ...formData, clientName: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>CLIENT EMAIL</small>
                                    <input value={formData.clientEmail || ''} onChange={e => setFormData({ ...formData, clientEmail: e.target.value })} />
                                </div>
                            </div>

                            <div className="hr"></div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <small className="muted" style={{ fontWeight: 800 }}>LINE ITEMS</small>
                                    <button type="button" className="btn sm secondary" onClick={addItem}>+ Add Line</button>
                                </div>
                                {formData.items.map((it, idx) => (
                                    <InvoiceItemRow key={idx} item={it} index={idx} onChange={(i, f, v) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            items: prev.items.map((item, index) => index === i ? { ...item, [f]: v } : item)
                                        }));
                                    }} onRemove={i => {
                                        if (formData.items.length > 1) setFormData({ ...formData, items: formData.items.filter((_, idx) => idx !== i) });
                                    }} />
                                ))}
                            </div>

                            <div className="grid two">
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>TAX RATE (%)</small>
                                    <input type="number" value={formData.tax_percent || 0} onChange={e => setFormData({ ...formData, tax_percent: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>DISCOUNT ($)</small>
                                    <input type="number" value={formData.discount || 0} onChange={e => setFormData({ ...formData, discount: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <small className="muted" style={{ fontWeight: 800 }}>PERSONALIZED SIGNATURE & TERMS</small>
                                <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ minHeight: '120px' }} />
                                <div style={{ height: '100px' }} /> {/* Spacing for fixed footer */}
                            </div>
                        </form>

                        <div style={{ position: 'sticky', bottom: 0, background: '#121c32', padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 -10px 40px rgba(0,0,0,0.3)', zIndex: 10 }}>
                            {statusMsg && (
                                <div className={`tag ${statusMsg.type === 'ok' ? 'ok' : 'bad'}`} style={{ marginBottom: '16px', justifyContent: 'center', width: '100%', padding: '12px' }}>
                                    {statusMsg.text}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleCreateInvoice}
                                disabled={loading}
                                className="btn glow-blue"
                                style={{ height: '56px', fontSize: '1.2rem', width: '100%' }}
                            >
                                {loading ? '⏳ SAVING...' : (editingId ? 'UPDATE INVOICE' : 'SAVE DRAFT INVOICE')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewingInvoice && <InvoicePreview invoice={previewingInvoice} settings={settings} onClose={() => setPreviewingInvoice(null)} />}

        </section>
    );
}
