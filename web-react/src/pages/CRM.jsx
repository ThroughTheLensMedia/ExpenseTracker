import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, formatMoney } from '../api';

const COLUMNS = [
    { id: 'New Lead', label: 'New Lead', color: '#a8b6dd', glow: 'rgba(168, 182, 221, 0.2)' },
    { id: 'Quoted', label: 'Quoted', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.2)' },
    { id: 'Booked', label: 'Booked', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.2)' },
    { id: 'Paid', label: 'Paid', color: '#4ade80', glow: 'rgba(74, 222, 128, 0.2)' },
    { id: 'Lost', label: 'Lost', color: '#ff4d4d', glow: 'rgba(255, 77, 77, 0.2)' }
];

export default function CRM() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formType, setFormType] = useState('Wedding');
    const [formValue, setFormValue] = useState('');
    const [formNotes, setFormNotes] = useState('');

    const loadLeads = async () => {
        setLoading(true);
        try {
            const res = await apiGet('/leads');
            setLeads(res.leads || []);
        } catch (e) {
            console.error("Failed to load leads:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        const payload = {
            name: formName,
            email: formEmail,
            phone: formPhone,
            project_type: formType,
            quoted_value_cents: Math.round(Number(formValue) * 100) || 0,
            notes: formNotes
        };

        try {
            if (editingLead) {
                await apiPatch(`/leads/${editingLead.id}`, payload);
            } else {
                await apiPost('/leads', payload);
            }
            setEditingLead(null);
            setIsDrawerOpen(false);
            clearForm();
            loadLeads();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleMove = async (lead, newStatus) => {
        try {
            // Optimistic update
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
            await apiPatch(`/leads/${lead.id}`, { status: newStatus });
        } catch (err) {
            loadLeads(); // revert
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this lead permanently?")) return;
        try {
            await apiDelete(`/leads/${id}`);
            setLeads(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    const clearForm = () => {
        setFormName('');
        setFormEmail('');
        setFormPhone('');
        setFormType('Wedding');
        setFormValue('');
        setFormNotes('');
    };

    const openEditor = (lead = null) => {
        if (lead) {
            setEditingLead(lead);
            setFormName(lead.name || '');
            setFormEmail(lead.email || '');
            setFormPhone(lead.phone || '');
            setFormType(lead.project_type || 'Wedding');
            setFormValue((lead.quoted_value_cents / 100).toFixed(2));
            setFormNotes(lead.notes || '');
        } else {
            setEditingLead(null);
            clearForm();
        }
        console.log("Opening editor for lead:", lead);
        setIsDrawerOpen(true);
    };

    const closeEditor = () => {
        setIsDrawerOpen(false);
        setEditingLead(null);
    };

    return (
        <section className="dashboard">
            {/* Dashboard header with explicit z-index to ensure it is above anything but the drawer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>Lead CRM Console</h1>
                    <div className="muted" style={{ fontSize: '12px' }}>Studio Pipeline Management</div>
                </div>
                <button className="btn glow-blue" onClick={() => { console.log("Button clicked"); openEditor(); }} style={{ padding: '10px 20px' }}>
                    + New Lead
                </button>
            </div>

            {/* Kanban Board Container - Forced Scrollability and Max Reach */}
            <div style={{
                display: 'flex',
                gap: '20px',
                overflowX: 'auto',
                paddingBottom: '24px',
                alignItems: 'flex-start',
                minHeight: '70vh',
                width: '100%',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch'
            }}>
                {COLUMNS.map(col => {
                    const columnLeads = leads.filter(l => (l.status || 'New Lead') === col.id);
                    const totalValue = columnLeads.reduce((s, l) => s + (l.quoted_value_cents || 0), 0);

                    return (
                        <div key={col.id} style={{
                            flex: '0 0 280px',
                            background: 'rgba(15, 26, 51, 0.7)',
                            borderTop: `4px solid ${col.color}`,
                            borderRadius: '20px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxShadow: `0 10px 30px rgba(0,0,0,0.3), 0 0 20px ${col.glow}`,
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 800, color: col.color, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' }}>
                                    {col.label} <span style={{ opacity: 0.6 }}>({columnLeads.length})</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#a8b6dd', fontWeight: 'bold' }}>
                                    {formatMoney(totalValue)}
                                </div>
                            </div>

                            {columnLeads.length === 0 ? (
                                <div className="muted" style={{ fontSize: '11px', textAlign: 'center', margin: '20px 0', borderStyle: 'dashed', borderWidth: '1px', borderColor: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '8px' }}>
                                    Drop area empty
                                </div>
                            ) : (
                                columnLeads.map(lead => (
                                    <div key={lead.id} className="card glass" style={{ margin: 0, padding: '12px', cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>{lead.name}</div>
                                            <div style={{ fontWeight: 900, fontSize: '13px', color: col.color }}>{formatMoney(lead.quoted_value_cents)}</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#a8b6dd' }}>{lead.project_type}</span>
                                        </div>

                                        {(lead.email || lead.phone) && (
                                            <div style={{ fontSize: '11px', color: '#a8b6dd', lineHeight: 1.4, marginTop: '4px' }}>
                                                {lead.email && <div>✉️ {lead.email}</div>}
                                                {lead.phone && <div>📞 {lead.phone}</div>}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select
                                                    value={lead.status}
                                                    onChange={(e) => handleMove(lead, e.target.value)}
                                                    style={{ fontSize: '11px', padding: '2px 4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', color: '#fff', borderRadius: '4px' }}
                                                >
                                                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => openEditor(lead)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                                                <button onClick={() => handleDelete(lead.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '11px' }}>Drop</button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Editor Drawer */}
            {isDrawerOpen && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
                    background: 'rgba(15, 26, 51, 0.98)', borderLeft: '1px solid var(--line)',
                    padding: '24px', zIndex: 10000, boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
                    overflowY: 'auto'
                }}>
                    <h2 style={{ marginTop: 0, color: '#fff' }}>{formName ? 'Edit Lead' : 'New Lead'}</h2>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                        <div>
                            <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Client / Project Name</label>
                            <input required value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%' }} placeholder="e.g. Smith Wedding" />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Value ($)</label>
                                <input required type="number" step="0.01" value={formValue} onChange={e => setFormValue(e.target.value)} style={{ width: '100%' }} placeholder="2500.00" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Project Type</label>
                                <select value={formType} onChange={e => setFormType(e.target.value)} style={{ width: '100%' }}>
                                    <option value="Wedding">Wedding</option>
                                    <option value="Videography">Videography</option>
                                    <option value="Portrait">Portrait</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Email</label>
                            <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} style={{ width: '100%' }} placeholder="client@example.com" />
                        </div>
                        <div>
                            <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Phone</label>
                            <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} style={{ width: '100%' }} placeholder="(555) 555-5555" />
                        </div>
                        <div>
                            <label className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Notes & Concept</label>
                            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} placeholder="Discussed sunset vibes..." />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button type="button" className="btn secondary" onClick={closeEditor} style={{ flex: 1 }}>Cancel</button>
                            <button type="submit" className="btn" style={{ flex: 1 }}>Save Lead</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Editor Backdrop */}
            {isDrawerOpen && (
                <div onClick={closeEditor} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999, backdropFilter: 'blur(3px)'
                }} />
            )}
        </section>
    );
}
