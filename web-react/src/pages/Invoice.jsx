import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, invalidateExpensesCache } from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useModal } from '../components/ModalContext.jsx';

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

function InvoicePreview({ invoice, settings = {}, onClose, onSendEmail }) {
    const modal = useModal();
    const previewRef = useRef();
    const [isProcessing, setIsProcessing] = useState(false);

    // Data Normalization: Handle both API structure and Draft State structure
    const data = useMemo(() => {
        const rawSource = (invoice.items && invoice.items.length > 0) ? invoice.items : (invoice.invoice_items || []);

        const items = rawSource.map(it => ({
            description: it.description || '---',
            quantity: parseFloat(it.quantity) || 0,
            unit_price: it.unit_price_cents ? (it.unit_price_cents / 100) : (parseFloat(it.unit_price) || 0)
        }));

        // Work in cents to match ledger logic exactly
        const subtotalCents = items.reduce((s, it) => s + Math.round(it.unit_price * 100 * it.quantity), 0);
        
        // Treat discount correctly
        let discountPercent = 0;
        if (invoice.discount_cents !== undefined) {
            discountPercent = (invoice.discount_cents / 100);
        } else {
            discountPercent = parseFloat(invoice.discount) || 0;
        }

        const taxPercent = parseFloat(invoice.tax_percent) || 0;
        const discountCents = Math.round(subtotalCents * (discountPercent / 100));
        const taxCents = Math.round(subtotalCents * (taxPercent / 100));
        const totalCents = subtotalCents + taxCents - discountCents;

        return {
            number: invoice.number || invoice.invoice_number || '---',
            date: invoice.date || invoice.issue_date || '---',
            dueDate: invoice.dueDate || invoice.due_date,
            clientName: invoice.clientName || invoice.clients?.name || '---',
            clientEmail: invoice.clientEmail || invoice.clients?.email || '',
            clientPhone: invoice.clientPhone || invoice.clients?.phone || '',
            items,
            subtotal: subtotalCents / 100,
            taxVal: taxCents / 100,
            discount: discountCents / 100,
            discountPercent,
            total: totalCents / 100,
            tax_percent: taxPercent
        };
    }, [invoice]);

    const handleDownloadPDF = async () => {
        const element = previewRef.current;
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice_${data.number}.pdf`);
    };

    const handleSendWithPDF = async () => {
        if (!onSendEmail) return;
        setIsProcessing(true);
        try {
            const element = previewRef.current;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdf = new jsPDF('p', 'mm', 'a4', true); // Use compression
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            // Generate Base64 for attachment
            const pdfBase64 = pdf.output('datauristring').split(',')[1];
            await onSendEmail(invoice, pdfBase64);
        } catch (err) {
            console.error("PDF Send Error:", err);
            modal.alert("Failed to package PDF for email.");
        } finally {
            setIsProcessing(false);
        }
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
                        {(invoice.status === 'draft' || invoice.status === 'sent') && (
                            <button className="btn glow-blue" onClick={handleSendWithPDF} disabled={isProcessing} style={{ padding: '10px 24px' }}>
                                {isProcessing ? '⏳ Preparing PDF...' : (invoice.status === 'sent' ? 'Resend to Client' : 'Email to Client')}
                            </button>
                        )}
                        <button className="btn secondary" onClick={handleDownloadPDF} style={{ padding: '10px 24px', color: '#fff' }}>Capture PDF Assets</button>
                        <button className="btn secondary" onClick={onClose} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>Return to Studio</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                    <div ref={previewRef} style={{ background: '#fff', width: '8.5in', minWidth: '8.5in', minHeight: '11in', margin: '0 auto', padding: '1in', boxShadow: '0 0 60px rgba(0,0,0,0.15)', position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

                        {/* HEADER */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                            <div>
                                {settings?.logo_url ? (
                                    <div style={{ width: '350px', height: '180px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', background: '#fff' }}>
                                        <img src={settings.logo_url} alt="Studio Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: '220px', height: '220px', background: '#fafafa', border: '3px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                        <div style={{ fontSize: '52px' }}>📸</div>
                                        <div style={{ fontSize: '14px', fontWeight: 950, textTransform: 'uppercase', marginTop: '10px', letterSpacing: '2px' }}>Pure Capture</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h1 style={{ margin: 0, fontSize: '38px', fontWeight: 300, color: '#000', letterSpacing: '4px', textTransform: 'uppercase' }}>INVOICE</h1>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                                    {settings?.tax_id && <div>Tax ID: {settings.tax_id}</div>}
                                    {settings?.studio_address && <div style={{ whiteSpace: 'pre-wrap' }}>{settings.studio_address}</div>}
                                </div>
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
                        <div style={{ background: '#444', color: '#fff', display: 'flex', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', borderRadius: '4px 4px 0 0' }}>
                            <div style={{ flex: 1, padding: '15px 20px', letterSpacing: '1px' }}>Service Description</div>
                            <div style={{ width: '80px', padding: '15px', textAlign: 'center' }}>Qty</div>
                            <div style={{ width: '120px', padding: '15px', textAlign: 'right' }}>Unit Price</div>
                            <div style={{ width: '120px', padding: '15px 20px', textAlign: 'right' }}>Total</div>
                        </div>

                        {/* LINE ITEMS LIST */}
                        <div style={{ marginBottom: '60px' }}>
                            {data.items.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No line items generated for this snapshot.</div>
                            ) : data.items.map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #f9f9f9', fontSize: '14px', alignItems: 'center', padding: '10px 0' }}>
                                    <div style={{ flex: 1, padding: '10px 20px', fontWeight: 500 }}>{it.description || '---'}</div>
                                    <div style={{ width: '80px', padding: '10px', textAlign: 'center' }}>{it.quantity}</div>
                                    <div style={{ width: '120px', padding: '10px', textAlign: 'right' }}>{formatMoney(Number(it.unit_price) * 100)}</div>
                                    <div style={{ width: '120px', padding: '10px 20px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(Number(it.unit_price) * it.quantity * 100)}</div>
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
                                {data.discountPercent > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', padding: '8px 20px', color: '#ff4d4d', fontWeight: 600 }}>
                                        <div>Discount ({data.discountPercent}%)</div>
                                        <div style={{ textAlign: 'right' }}>-{formatMoney(data.discount * 100)}</div>
                                    </div>
                                )}
                                {data.tax_percent > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', padding: '8px 20px', color: '#666' }}>
                                        <div>Tax Rate ({data.tax_percent}%)</div>
                                        <div style={{ textAlign: 'right' }}>{formatMoney(data.taxVal * 100)}</div>
                                    </div>
                                )}
                                <div style={{ marginTop: '15px', borderTop: '2px solid #000', padding: '20px 0', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '15px', alignItems: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Due</div>
                                    <div style={{ textAlign: 'right', fontSize: '32px', fontWeight: 900, color: '#000' }}>{formatMoney(data.total * 100)}</div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM SECTIONS */}
                        <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
                            <div style={{ display: 'flex', gap: '40px', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '60px' }}>
                                <div style={{ flex: 1, fontSize: '13px', lineHeight: '1.8' }}>
                                    {invoice.notes && (
                                        <div style={{ marginBottom: '25px' }}>
                                            <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', color: '#000' }}>Notes</div>
                                            <div style={{ color: '#000' }}>{invoice.notes}</div>
                                        </div>
                                    )}
                                    {settings?.standard_terms && (
                                        <div style={{ marginBottom: '25px' }}>
                                            <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', color: '#000' }}>Studio Terms</div>
                                            <div style={{ color: '#000' }}>{settings.standard_terms}</div>
                                        </div>
                                    )}

                                    {settings?.payment_methods && (
                                        <div style={{ marginBottom: '25px' }}>
                                            <div style={{ fontWeight: 950, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', color: '#000' }}>Payment Instructions</div>
                                            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{settings.payment_methods}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* FOOTER ANCHOR LINE */}
                            <div style={{ borderTop: '2px solid #000', marginTop: '20px', paddingBottom: '30px' }}></div>

                            {/* FOOTER */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '32px',
                                    fontWeight: 950,
                                    textTransform: 'uppercase',
                                    letterSpacing: '6px',
                                    color: '#000',
                                    marginBottom: '8px'
                                }}>
                                    {settings?.business_name || 'Through The Lens Media'}
                                </div>
                                <div style={{
                                    fontFamily: 'Papyrus, "Palatino Linotype", "Book Antiqua", Palatino, serif',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    letterSpacing: '3px',
                                    color: '#666'
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
        </div>
    );
}

export default function Invoice() {
    const modal = useModal();
    const [view, setView] = useState('invoices');
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [leads, setLeads] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState(null); // Track which invoice is currently emailing

    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [previewingInvoice, setPreviewingInvoice] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null); // {type: 'ok'|'bad', text: '' }

    const [formData, setFormData] = useState({
        number: '',
        date: new Date().toISOString().slice(0, 10),
        dueDate: '',
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        items: [{ description: '', quantity: 1, unit_price: '' }],
        tax_percent: '',
        discount: '',
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
            tax_percent: '',
            discount: '',
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
                tax_percent: fullInv.tax_percent !== undefined ? fullInv.tax_percent : '',
                discount: fullInv.discount_cents !== undefined ? (fullInv.discount_cents / 100) : '',
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
            const discountPercent = (invoice.discount_cents || 0) / 100;
            const discountAmount = Math.round(subtotal * (discountPercent / 100));
            const total = subtotal + tax - discountAmount;

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

    const handleSendEmail = async (invoice, pdfBase64 = null) => {
        const ok = await modal.confirm(`Are you sure you want to officially dispatch Invoice #${invoice.invoice_number} to ${invoice.clients?.name || 'the client'}?`);
        if (!ok) return;
        
        setSendingId(invoice.id);
        setStatusMsg(null);
        try {
            await apiPatch(`/invoices/${invoice.id}`, { 
                status: 'sent',
                pdf_base64: pdfBase64 // Send generated PDF if available
            });
            await load();
            setStatusMsg({ type: 'ok', text: `Success! Invoice #${invoice.invoice_number} has been dispatched.` });
            if (pdfBase64) {
                setPreviewingInvoice(null); // Close preview if sending from there
            }
            modal.alert(`Voice of the Studio: Invoice #${invoice.invoice_number} dispatched successfully!`);
        } catch (err) {
            console.error("Email failed", err);
            setStatusMsg({ type: 'bad', text: `Email failed: ${err.message}` });
        } finally {
            setSendingId(null);
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
        const ok = await modal.confirm("Are you sure you want to permanently delete this invoice?");
        if (!ok) return;
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
                const discountPercent = (inv.discount_cents || 0) / 100;
                const discountAmount = Math.round(sub * (discountPercent / 100));
                return sum + sub + tax - discountAmount;
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
                        <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>Accounts Receivables</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        <button className={`pill ${view === 'invoices' ? 'active' : ''}`} onClick={() => setView('invoices')}>Invoice</button>
                        <button className={`pill ${view === 'clients' ? 'active' : ''}`} onClick={() => setView('clients')}>Clients</button>
                        <button className="btn glow-blue" onClick={() => setIsCreatorOpen(true)} style={{ padding: '10px 24px' }}>+ Create Invoice</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <div className="stat glass" style={{ borderTop: '4px solid #4ade80', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>PENDING REVENUE</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#4ade80', marginTop: '8px' }}>{formatMoney(receivables)}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #38bdf8', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>TOTAL INVOICED</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '8px' }}>{invoices.length}</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: '4px solid #fbbf24', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>REVIEW QUEUE</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fbbf24', marginTop: '8px' }}>{draftCount} Drafts</div>
                    </div>
                    <div className="stat glass" style={{ borderTop: `2px solid ${BRAND_ORANGE}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <div className="muted small" style={{ fontWeight: 800 }}>CLIENT BASE</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '8px' }}>{clients.length}</div>
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
                                    const discountPercent = (inv.discount_cents || 0) / 100;
                                    const discountAmount = Math.round(subtotal * (discountPercent / 100));
                                    const total = subtotal + tax - discountAmount;
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
                                                        <button 
                                                            className="btn sm glow-blue" 
                                                            onClick={() => handleSendEmail(inv)}
                                                            disabled={sendingId === inv.id}
                                                        >
                                                            {sendingId === inv.id ? '⏳ Emailing...' : 'Send Email'}
                                                        </button>
                                                    )}
                                                    {inv.status === 'sent' && (
                                                        <>
                                                            <button className="btn sm secondary" onClick={() => handlePreview(inv)}>Resend</button>
                                                            <button className="btn sm primary" onClick={() => handleMarkPaid(inv.id)}>Mark Paid</button>
                                                        </>
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
                                    <select
                                        onChange={handleLeadSelect}
                                        style={{
                                            background: formData.leadId ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                                            borderColor: formData.leadId ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)'
                                        }}
                                    >
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
                                    <input type="number" placeholder="0" value={formData.tax_percent} onChange={e => setFormData({ ...formData, tax_percent: e.target.value })} />
                                </div>
                                <div>
                                    <small className="muted" style={{ fontWeight: 800 }}>DISCOUNT (%)</small>
                                    <input type="number" placeholder="0" value={formData.discount} onChange={e => setFormData({ ...formData, discount: e.target.value })} />
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

            {previewingInvoice && <InvoicePreview 
                invoice={previewingInvoice} 
                settings={settings} 
                onClose={() => setPreviewingInvoice(null)} 
                onSendEmail={handleSendEmail}
            />}

        </section>
    );
}
