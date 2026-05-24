import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.throughthelens.media';

function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
}
function formatDate(d) {
    if (!d) return 'Day of Shoot';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function PayInvoice() {
    const { token } = useParams();
    const [state, setState] = useState('loading'); // loading | ready | signing | signed | error | voided | already_signed
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [signature, setSignature] = useState('');
    const [sigError, setSigError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/pay/${token}`);
                const json = await res.json();
                if (!res.ok) {
                    if (res.status === 410) return setState('voided');
                    if (res.status === 409) return setState('already_signed');
                    setError(json.error || 'Unable to load this invoice.');
                    return setState('error');
                }
                setData(json);
                setState('ready');
            } catch (e) {
                setError('Network error. Please check your connection and try again.');
                setState('error');
            }
        }
        load();
    }, [token]);

    const handleSign = async () => {
        if (signature.trim().length < 2) {
            setSigError('Please enter your full name to approve this invoice.');
            return;
        }
        setSubmitting(true);
        setSigError('');
        try {
            const res = await fetch(`/api/pay/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature: signature.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                setSigError(json.error || 'Submission failed. Please try again.');
                return;
            }
            setState('signed');
        } catch (e) {
            setSigError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate totals
    const totals = React.useMemo(() => {
        if (!data) return null;
        const inv = data.invoice;
        const billedItems = (inv.items || []).filter(it => it.quantity > 0);
        const subtotalCents = billedItems.reduce((s, it) => s + it.unit_price_cents * it.quantity, 0);
        const taxCents = Math.round(subtotalCents * ((inv.tax_percent || 0) / 100));
        const discountPercent = (inv.discount_cents || 0) / 100;
        const discountCents = Math.round(subtotalCents * (discountPercent / 100));
        const totalCents = subtotalCents + taxCents - discountCents;
        return { subtotalCents, taxCents, discountCents, totalCents };
    }, [data]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (state === 'loading') {
        return (
            <div style={styles.page}>
                <div style={styles.center}>
                    <div style={styles.spinner} />
                    <div style={styles.loadingText}>Loading your invoice…</div>
                </div>
            </div>
        );
    }

    // ── Voided ────────────────────────────────────────────────────────────────
    if (state === 'voided') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.iconLarge}>🚫</div>
                    <h1 style={styles.h1}>Invoice Voided</h1>
                    <p style={styles.muted}>This invoice has been voided by the photographer and is no longer valid.</p>
                </div>
            </div>
        );
    }

    // ── Already signed ────────────────────────────────────────────────────────
    if (state === 'already_signed') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.iconLarge}>✅</div>
                    <h1 style={styles.h1}>Already Approved</h1>
                    <p style={styles.muted}>This invoice has already been approved and signed. No further action is needed.</p>
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (state === 'error') {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.iconLarge}>⚠️</div>
                    <h1 style={styles.h1}>Invoice Not Found</h1>
                    <p style={styles.muted}>{error}</p>
                </div>
            </div>
        );
    }

    // ── Signed confirmation ───────────────────────────────────────────────────
    if (state === 'signed') {
        const { invoice, studio } = data;
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.iconLarge}>🎉</div>
                    <h1 style={{ ...styles.h1, color: '#16a34a' }}>Invoice Approved!</h1>
                    <p style={styles.muted}>
                        Thank you, <strong>{signature}</strong>. You've approved Invoice #{invoice.invoice_number} from {studio.business_name}.
                        Your photographer has been notified.
                    </p>

                    {/* Payment instructions */}
                    {(studio.venmo_handle || studio.zelle_handle || studio.cashapp_tag) && (
                        <div style={styles.paymentBox}>
                            <div style={styles.sectionLabel}>Complete Your Payment</div>
                            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px' }}>
                                Send your payment using one of the options below. Use the invoice number as your payment reference.
                            </p>
                            <div style={styles.handleGrid}>
                                {studio.venmo_handle && (
                                    <a href={`https://venmo.com/${studio.venmo_handle.replace('@', '')}`} target="_blank" rel="noreferrer" style={styles.handleCard}>
                                        <div style={styles.handleIcon}>💜</div>
                                        <div style={styles.handleLabel}>Venmo</div>
                                        <div style={styles.handleValue}>{studio.venmo_handle}</div>
                                    </a>
                                )}
                                {studio.zelle_handle && (
                                    <div style={styles.handleCard}>
                                        <div style={styles.handleIcon}>💙</div>
                                        <div style={styles.handleLabel}>Zelle</div>
                                        <div style={styles.handleValue}>{studio.zelle_handle}</div>
                                    </div>
                                )}
                                {studio.cashapp_tag && (
                                    <a href={`https://cash.app/${studio.cashapp_tag}`} target="_blank" rel="noreferrer" style={styles.handleCard}>
                                        <div style={styles.handleIcon}>💚</div>
                                        <div style={styles.handleLabel}>CashApp</div>
                                        <div style={styles.handleValue}>{studio.cashapp_tag}</div>
                                    </a>
                                )}
                            </div>
                            <div style={styles.referenceNote}>
                                Reference: <strong>Invoice #{invoice.invoice_number}</strong>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '24px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                        Questions? Contact {studio.business_name}{studio.email ? ` at ${studio.email}` : ''}.
                    </div>
                </div>
            </div>
        );
    }

    // ── Main pay page ─────────────────────────────────────────────────────────
    const { invoice, studio } = data;
    const inv = invoice;
    const billedItems = (inv.items || []).filter(it => it.quantity > 0);
    const descOnlyItems = (inv.items || []).filter(it => it.quantity === 0);

    let displayNotes = inv.notes || '';
    let attachment = null;
    const attachmentMatch = displayNotes.match(/---ATTACHMENT---\nName: (.*)\nURL: (.*)/);
    if (attachmentMatch) {
        displayNotes = displayNotes.replace(attachmentMatch[0], '').trim();
        attachment = { name: attachmentMatch[1], url: attachmentMatch[2] };
    }
    const metaMatch = displayNotes.match(/---METADATA---\nEventName: (.*)\nEventType: (.*)/);
    if (metaMatch) {
        displayNotes = displayNotes.replace(metaMatch[0], '').trim();
    }

    return (
        <div style={styles.page}>
            {/* Studio header */}
            <div style={styles.header}>
                <div style={styles.studioName}>{studio.business_name}</div>
                <div style={styles.headerDivider} />
            </div>

            <div style={styles.card}>
                {/* Invoice meta */}
                <div style={styles.invoiceMeta}>
                    <div>
                        <div style={styles.metaLabel}>Invoice</div>
                        <div style={styles.metaValue}>#{inv.invoice_number}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={styles.metaLabel}>Due</div>
                        <div style={styles.metaValue}>{formatDate(inv.due_date)}</div>
                    </div>
                </div>

                {/* Client info */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={styles.metaLabel}>Billed To</div>
                    <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '4px' }}>{inv.client.name}</div>
                    {inv.client.email && <div style={{ fontSize: '13px', color: '#64748b' }}>{inv.client.email}</div>}
                </div>

                {/* Line items */}
                <div style={styles.divider} />
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', marginBottom: '8px' }}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, minWidth: '150px' }}>Description</th>
                                <th style={{ ...styles.th, textAlign: 'center', width: '40px' }}>Qty</th>
                                <th style={{ ...styles.th, textAlign: 'right', width: '70px' }}>Price</th>
                                <th style={{ ...styles.th, textAlign: 'right', width: '80px' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {billedItems.map((it, i) => (
                                <tr key={i}>
                                    <td style={{ ...styles.td, wordBreak: 'break-word' }}>{it.description}</td>
                                    <td style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>{it.quantity}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#64748b' }}>{formatMoney(it.unit_price_cents)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(it.unit_price_cents * it.quantity)}</td>
                                </tr>
                            ))}
                            {descOnlyItems.map((it, i) => (
                                <tr key={`desc-${i}`}>
                                    <td style={{ ...styles.td, color: '#94a3b8', fontStyle: 'italic' }} colSpan={4}>{it.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div style={{ ...styles.divider, marginTop: 0 }} />
                {totals.taxCents > 0 && (
                    <div style={styles.totalRow}>
                        <span style={{ color: '#64748b' }}>Tax ({inv.tax_percent}%)</span>
                        <span style={{ color: '#64748b' }}>{formatMoney(totals.taxCents)}</span>
                    </div>
                )}
                {totals.discountCents > 0 && (
                    <div style={styles.totalRow}>
                        <span style={{ color: '#64748b' }}>Discount</span>
                        <span style={{ color: '#64748b' }}>−{formatMoney(totals.discountCents)}</span>
                    </div>
                )}
                <div style={{ ...styles.totalRow, fontWeight: 900, fontSize: '20px', marginTop: '8px' }}>
                    <span>Total Due</span>
                    <span style={{ color: '#f97316' }}>{formatMoney(totals.totalCents)}</span>
                </div>

                {/* Notes */}
                {(displayNotes || attachment) && (
                    <div style={styles.notes}>
                        <div style={styles.notesLabel}>Notes from {studio.business_name}</div>
                        {displayNotes && <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{displayNotes}</p>}
                        {attachment && (
                            <div style={{ marginTop: '16px' }}>
                                <a href={attachment.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: '#fff', color: '#f97316', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none', border: '1px solid #f97316' }}>
                                    📄 View {attachment.name}
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* Photographer signed badge */}
                {inv.photographer_signed && (
                    <div style={styles.sigBadge}>
                        ✍️ Signed by {studio.business_name}
                    </div>
                )}
            </div>

            {/* E-Signature section */}
            <div style={{ ...styles.card, marginTop: 0 }}>
                <div style={styles.sectionLabel}>Approve This Invoice</div>
                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px', lineHeight: 1.6 }}>
                    By typing your full name below and clicking <strong>I Agree & Submit</strong>, you confirm that you have reviewed
                    this invoice and authorize payment of <strong style={{ color: '#f97316' }}>{formatMoney(totals.totalCents)}</strong> to {studio.business_name}.
                </p>

                {/* Payment terms */}
                <div style={{ background: '#fef9f5', border: '1px solid #fed7aa', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Payment Information</div>
                    <ul style={{ margin: '0 0 12px', padding: '0 0 0 18px', fontSize: '14px', color: '#475569', lineHeight: 1.7 }}>
                        <li>A <strong>50% deposit</strong> is required to secure your date.</li>
                        <li>The remaining balance is due <strong>before the session</strong> (or on the day of the session).</li>
                        <li>Payment via <strong>Cash, Stripe, Venmo, or Zelle</strong> are acceptable.</li>
                    </ul>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                        Once I receive your deposit, I will send a confirmation email with your booked date and time. Thank you! Looking forward to working with you.
                    </p>
                </div>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Your Full Name (E-Signature)
                </label>
                <input
                    id="pay-signature-input"
                    type="text"
                    placeholder="e.g. Sarah Johnson"
                    value={signature}
                    onChange={e => { setSignature(e.target.value); setSigError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSign()}
                    style={{
                        width: '100%', boxSizing: 'border-box', padding: '14px 16px',
                        fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic',
                        border: `2px solid ${sigError ? '#ef4444' : '#e2e8f0'}`,
                        borderRadius: '10px', color: '#1e293b', outline: 'none',
                        background: '#fff', marginBottom: '8px',
                        transition: 'border-color 0.2s'
                    }}
                />
                {sigError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{sigError}</div>}

                <button
                    id="pay-submit-btn"
                    onClick={handleSign}
                    disabled={submitting}
                    style={{
                        width: '100%', padding: '16px', background: submitting ? '#94a3b8' : '#f97316',
                        color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900,
                        fontSize: '16px', cursor: submitting ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s', letterSpacing: '0.02em'
                    }}
                >
                    {submitting ? '⏳ Submitting…' : 'I Agree & Submit →'}
                </button>

                <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', margin: '12px 0 0 0' }}>
                    Your typed name serves as your electronic signature and agreement to this invoice.
                </p>
            </div>

            {/* Payment handles */}
            {(studio.venmo_handle || studio.zelle_handle || studio.cashapp_tag) && (
                <div style={{ ...styles.card, marginTop: 0 }}>
                    <div style={styles.sectionLabel}>Payment Options</div>
                    <div style={styles.handleGrid}>
                        {studio.venmo_handle && (
                            <a href={`https://venmo.com/${studio.venmo_handle.replace('@', '')}`} target="_blank" rel="noreferrer" style={styles.handleCard}>
                                <div style={styles.handleIcon}>💜</div>
                                <div style={styles.handleLabel}>Venmo</div>
                                <div style={styles.handleValue}>{studio.venmo_handle}</div>
                            </a>
                        )}
                        {studio.zelle_handle && (
                            <div style={styles.handleCard}>
                                <div style={styles.handleIcon}>💙</div>
                                <div style={styles.handleLabel}>Zelle</div>
                                <div style={styles.handleValue}>{studio.zelle_handle}</div>
                            </div>
                        )}
                        {studio.cashapp_tag && (
                            <a href={`https://cash.app/${studio.cashapp_tag}`} target="_blank" rel="noreferrer" style={styles.handleCard}>
                                <div style={styles.handleIcon}>💚</div>
                                <div style={styles.handleLabel}>CashApp</div>
                                <div style={styles.handleValue}>{studio.cashapp_tag}</div>
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '24px 0 40px', fontSize: '12px', color: '#cbd5e1' }}>
                {studio.business_name}{studio.email ? ` · ${studio.email}` : ''}{studio.phone ? ` · ${studio.phone}` : ''}
                <br /><span style={{ opacity: 0.5 }}>Powered by Lumière Ledger</span>
            </div>
        </div>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
    page: { minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', color: '#1e293b' },
    center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' },
    spinner: { width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#f97316', animation: 'spin 0.8s linear infinite' },
    loadingText: { fontSize: '14px', color: '#94a3b8', fontWeight: 600 },
    header: { maxWidth: '640px', margin: '0 auto', padding: '32px 20px 8px', textAlign: 'center' },
    studioName: { fontSize: '22px', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.02em' },
    headerDivider: { width: '40px', height: '2px', background: '#f97316', margin: '12px auto 0' },
    card: { maxWidth: '640px', margin: '20px auto', background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
    iconLarge: { fontSize: '48px', textAlign: 'center', marginBottom: '16px' },
    h1: { fontSize: '24px', fontWeight: 900, margin: '0 0 12px', textAlign: 'center' },
    muted: { fontSize: '15px', color: '#64748b', textAlign: 'center', lineHeight: 1.6, margin: 0 },
    invoiceMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid #f1f5f9' },
    metaLabel: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' },
    metaValue: { fontSize: '18px', fontWeight: 900, color: '#1e293b' },
    divider: { borderTop: '2px solid #f1f5f9', margin: '16px 0' },
    th: { textAlign: 'left', padding: '8px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 },
    td: { padding: '10px 0', borderBottom: '1px solid #f8fafc', fontSize: '14px' },
    totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 600, padding: '4px 0' },
    notes: { marginTop: '20px', padding: '16px', background: '#fef9f6', borderRadius: '10px', borderLeft: '3px solid #f97316' },
    notesLabel: { fontSize: '11px', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
    sigBadge: { marginTop: '16px', padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#16a34a', textAlign: 'center' },
    sectionLabel: { fontSize: '11px', fontWeight: 900, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' },
    paymentBox: { marginTop: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' },
    handleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' },
    handleCard: { display: 'block', textDecoration: 'none', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow 0.2s', color: 'inherit' },
    handleIcon: { fontSize: '24px', marginBottom: '6px' },
    handleLabel: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' },
    handleValue: { fontSize: '14px', fontWeight: 700, color: '#1e293b', wordBreak: 'break-all' },
    referenceNote: { fontSize: '13px', color: '#475569', textAlign: 'center', marginTop: '12px' },
};
