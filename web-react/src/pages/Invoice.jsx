import { apiGet, apiPost, apiPatch, apiDelete, formatMoney, invalidateExpensesCache } from '../api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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

    const load = async () => {
        setLoading(true);
        try {
            const [invs, cls] = await Promise.all([
                apiGet('/invoices'),
                apiGet('/invoices/clients')
            ]);
            setInvoices(invs);
            setClients(cls);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handlePostToIncome = async (invoice) => {
        setSyncingId(invoice.id);
        setMsg('⚡ Posting income to Transactions...');
        try {
            const subtotal = (invoice.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
            const total = Math.round(subtotal * (1 + (invoice.tax_percent / 100)) - (invoice.discount_cents || 0));

            await apiPost('/expenses', {
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: `INV #${invoice.invoice_number} - ${invoice.clients?.name}`,
                category: 'Photo Income',
                amount_cents: -total, // Negative for income
                notes: `Auto-posted from Invoice system.`,
                tax_deductible: true,
                tax_bucket: 'Photo Income'
            });
            invalidateExpensesCache();
            setMsg('✅ Income sync complete!');
            setTimeout(() => setMsg(''), 3000);
        } catch (e) {
            setMsg(`❌ Failed: ${e.message}`);
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

    const handleDownloadPDF = async (invId) => {
        setMsg('📄 Generating PDF...');
        try {
            const inv = await apiGet(`/invoices/${invId}`);
            const doc = new jsPDF();

            // Logo / Header
            doc.setFontSize(24);
            doc.text("INVOICE", 140, 25);

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Through The Lens Media", 14, 25);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text("Professional Photography Services", 14, 30);

            // Invoice Metadata
            doc.text(`Invoice #: ${inv.invoice_number}`, 140, 35);
            doc.text(`Date: ${inv.issue_date}`, 140, 40);
            if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 45);

            // Client
            doc.setFont("helvetica", "bold");
            doc.text("BILL TO:", 14, 55);
            doc.setFont("helvetica", "normal");
            doc.text(inv.clients?.name || 'Unknown Client', 14, 60);
            if (inv.clients?.email) doc.text(inv.clients.email, 14, 65);

            // Items
            const tableRows = (inv.invoice_items || []).map(it => [
                it.description,
                it.quantity,
                formatMoney(it.unit_price_cents),
                formatMoney(it.unit_price_cents * it.quantity)
            ]);

            doc.autoTable({
                startY: 75,
                head: [['Description', 'Qty', 'Unit Price', 'Total']],
                body: tableRows,
                headStyles: { fillColor: [15, 26, 51] }
            });

            // Totals
            const finalY = doc.lastAutoTable.finalY + 10;
            const subtotal = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
            const tax = Math.round(subtotal * (inv.tax_percent / 100));
            const discount = inv.discount_cents || 0;
            const total = subtotal + tax - discount;

            doc.text(`Subtotal:`, 140, finalY);
            doc.text(formatMoney(subtotal), 180, finalY, { align: 'right' });

            if (tax > 0) {
                doc.text(`Tax (${inv.tax_percent}%):`, 140, finalY + 5);
                doc.text(formatMoney(tax), 180, finalY + 5, { align: 'right' });
            }
            if (discount > 0) {
                doc.text(`Discount:`, 140, finalY + 10);
                doc.text(`-${formatMoney(discount)}`, 180, finalY + 10, { align: 'right' });
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(`TOTAL DUE:`, 140, finalY + 18);
            doc.text(formatMoney(total), 180, finalY + 18, { align: 'right' });

            if (inv.notes) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.text("Notes:", 14, finalY + 30);
                doc.text(inv.notes, 14, finalY + 35);
            }

            doc.save(`Invoice_${inv.invoice_number}.pdf`);
            setMsg('✅ PDF Downloaded!');
            setTimeout(() => setMsg(''), 2000);
        } catch (e) {
            setMsg(`❌ PDF Error: ${e.message}`);
        }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Elite Invoice Header */}
            <div className="card glass glow-blue" style={{ padding: '24px', border: 'none', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>💼 Photo Jobs & Invoicing</h2>
                        <div className="muted" style={{ fontSize: '13px' }}>Manage client work and sync income to tax ledger.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`btn ${view === 'invoices' ? 'primary' : 'secondary'}`} onClick={() => setView('invoices')}>Invoices</button>
                        <button className={`btn ${view === 'clients' ? 'primary' : 'secondary'}`} onClick={() => setView('clients')}>Clients</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div className="stat glass glow-green" style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid rgba(25, 195, 125, 0.4)' }}>
                        <div className="muted small" style={{ color: '#4ade80', fontSize: '10px' }}>PENDING RECEIVABLES</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>{formatMoney(totalReceivable)}</div>
                        <div className="muted small" style={{ fontSize: '11px', marginTop: '4px' }}>Status: Sent</div>
                    </div>
                    <div className="stat glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div className="muted small" style={{ fontSize: '10px' }}>CLIENT DIRECTORY</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, marginTop: '4px' }}>{clients.length}</div>
                        <div className="muted small" style={{ fontSize: '11px', marginTop: '4px' }}>Active Projects</div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ padding: '20px', margin: 0 }}>
                {view === 'invoices' ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Invoice History</h2>
                            <button className="btn primary sm" onClick={() => setMsg('Feature coming soon...')}>+ Create Invoice</button>
                        </div>
                        <div className="tableWrap">
                            <table className="glass">
                                <thead>
                                    <tr>
                                        <th># / Date</th>
                                        <th>Client</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => {
                                        const subtotal = (inv.invoice_items || []).reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                                        return (
                                            <tr key={inv.id}>
                                                <td>
                                                    <div style={{ fontWeight: 800 }}>{inv.invoice_number}</div>
                                                    <div className="muted small">{inv.issue_date}</div>
                                                </td>
                                                <td>{inv.clients?.name}</td>
                                                <td style={{ fontWeight: 800 }}>{formatMoney(subtotal)}</td>
                                                <td>
                                                    <span className={`tag ${inv.status === 'paid' ? 'ok' : 'warn'}`}>{inv.status}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            className="btn secondary sm"
                                                            style={{ fontSize: '10px', padding: '4px 10px' }}
                                                            onClick={() => handleDownloadPDF(inv.id)}
                                                        >📄 PDF</button>
                                                        {inv.status === 'paid' && (
                                                            <button
                                                                className="btn primary sm"
                                                                style={{ fontSize: '10px', padding: '4px 10px' }}
                                                                onClick={() => handlePostToIncome(inv)}
                                                                disabled={syncingId === inv.id}
                                                            >⚡ Sync Income</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!invoices.length && <tr><td colSpan="5" className="muted center" style={{ padding: '30px' }}>No invoices yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Client Directory</h2>
                            <button className="btn primary sm">+ Add Client</button>
                        </div>
                        <div className="locker-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 0 }}>
                            {clients.map(c => (
                                <div key={c.id} className="gear-slot glass" style={{ padding: '16px' }}>
                                    <div className="cat-icon" style={{ width: '40px', height: '40px', fontSize: '20px' }}>👤</div>
                                    <h3 style={{ margin: '8px 0 4px', fontSize: '1rem' }}>{c.name}</h3>
                                    <div className="muted small">{c.email || 'No email saved'}</div>
                                    <div className="actions" style={{ marginTop: '14px', opacity: 1 }}>
                                        <button className="btn sm secondary" style={{ flex: 1 }}>View Jobs</button>
                                        <button className="btn sm danger" onClick={() => apiDelete(`/invoices/clients/${c.id}`).then(load)}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {msg && <div className="tag warn" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, padding: '12px 20px', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>{msg}</div>}
        </section>
    );
}
