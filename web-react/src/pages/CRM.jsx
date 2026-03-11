import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, NavLink, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, formatMoney } from '../api';
import Invoice from './Invoice';

const ACTIVE_COLUMNS = [
    { id: 'New Lead', label: 'New Lead', color: '#a8b6dd', glow: 'rgba(168, 182, 221, 0.2)' },
    { id: 'Quoted', label: 'Quoted', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.2)' },
    { id: 'Booked', label: 'Booked', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.2)' }
];

function PipelineView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Archive View State
    const [archiveTarget, setArchiveTarget] = useState(null); // 'Paid' or 'Lost'
    const [archiveSearch, setArchiveSearch] = useState('');

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
        if (searchParams.get('new') === 'true') {
            openEditor();
            setSearchParams({});
        }
    }, []);

    const archiveStats = useMemo(() => {
        return {
            Paid: leads.filter(l => l.status === 'Paid'),
            Lost: leads.filter(l => l.status === 'Lost')
        };
    }, [leads]);

    const activeArchiveLeads = useMemo(() => {
        if (!archiveTarget) return [];
        return archiveStats[archiveTarget].filter(l =>
            l.name.toLowerCase().includes(archiveSearch.toLowerCase()) ||
            (l.email && l.email.toLowerCase().includes(archiveSearch.toLowerCase()))
        );
    }, [archiveTarget, archiveStats, archiveSearch]);

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
            setIsDrawerOpen(false);
            setEditingLead(null);
            clearForm();
            loadLeads();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleMove = async (lead, newStatus) => {
        try {
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
            await apiPatch(`/leads/${lead.id}`, { status: newStatus });
        } catch (err) {
            loadLeads();
            alert(err.message);
        }
    };

    const clearForm = () => {
        setFormName(''); setFormEmail(''); setFormPhone('');
        setFormType('Wedding'); setFormValue(''); setFormNotes('');
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
        setIsDrawerOpen(true);
    };

    const closeEditor = () => {
        setIsDrawerOpen(false);
        setEditingLead(null);
    };

    const exportToCSV = () => {
        if (leads.length === 0) return;
        const headers = ["Name", "Email", "Phone", "Status", "Project Type", "Quoted Value ($)", "Created At"];
        const rows = leads.map(l => [
            `"${l.name}"`, `"${l.email}"`, `"${l.phone}"`, `"${l.status}"`,
            `"${l.project_type}"`, (l.quoted_value_cents / 100).toFixed(2), l.created_at
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `TTL_CRM_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>CRM Console</h1>
                    <div className="muted" style={{ fontWeight: 600 }}>Through The Lens · Studio Pipeline</div>

                    <div className="glass mobile-only" style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', display: 'flex', gap: '16px', fontSize: '11px', justifyContent: 'space-between' }}>
                        <div onClick={() => setArchiveTarget('Paid')} style={{ flex: 1 }}>
                            <span className="muted" style={{ fontSize: '9px', textTransform: 'uppercase' }}>Paid 👁️</span>
                            <div style={{ color: '#4ade80', fontWeight: 900 }}>{archiveStats.Paid.length} Clients</div>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <div onClick={() => setArchiveTarget('Lost')} style={{ flex: 1, textAlign: 'right' }}>
                            <span className="muted" style={{ fontSize: '9px', textTransform: 'uppercase' }}>Lost 👁️</span>
                            <div style={{ color: '#ff4d4d', fontWeight: 900 }}>{archiveStats.Lost.length} Rows</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="glass desktop-only" style={{ padding: '8px 16px', borderRadius: '12px', display: 'flex', gap: '20px', fontSize: '12px' }}>
                        <div onClick={() => setArchiveTarget('Paid')} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                            <span className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Success (Paid) 👁️</span>
                            <span style={{ color: '#4ade80', fontWeight: 900 }}>{archiveStats.Paid.length} Clients</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <div onClick={() => setArchiveTarget('Lost')} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                            <span className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Lost Archive 👁️</span>
                            <span style={{ color: '#ff4d4d', fontWeight: 900 }}>{archiveStats.Lost.length} Rows</span>
                        </div>
                    </div>
                    <button className="btn" onClick={exportToCSV} style={{ padding: '10px 16px', fontSize: '12px' }}>📤 Export</button>
                    <button className="btn glow-blue" onClick={() => openEditor()} style={{ padding: '10px 20px', fontWeight: 900 }}>+ New Lead</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', minHeight: '65vh' }}>
                {ACTIVE_COLUMNS.map(col => {
                    const columnLeads = leads.filter(l => (l.status || 'New Lead') === col.id);
                    const totalValue = columnLeads.reduce((s, l) => s + (l.quoted_value_cents || 0), 0);
                    return (
                        <div key={col.id} className="crm-column" style={{ background: 'rgba(15, 26, 51, 0.4)', borderTop: `4px solid ${col.color}`, borderRadius: '24px', padding: '20px', boxShadow: `0 15px 35px rgba(0,0,0,0.2), 0 0 20px ${col.glow}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontWeight: 900, color: col.color, textTransform: 'uppercase', fontSize: '13px' }}>{col.label} <span style={{ opacity: 0.5 }}>{columnLeads.length}</span></div>
                                <div style={{ fontSize: '12px', fontWeight: 900, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>{formatMoney(totalValue)}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {columnLeads.length === 0 ? <div className="muted" style={{ padding: '40px 20px', textAlign: 'center' }}>No active {col.label.toLowerCase()}s</div> :
                                    columnLeads.map(lead => (
                                        <div key={lead.id} className="card glass" style={{ margin: 0, padding: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <div style={{ fontWeight: 900 }}>{lead.name}</div>
                                                <div style={{ color: col.color }}>{formatMoney(lead.quoted_value_cents)}</div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                <select value={lead.status} onChange={(e) => handleMove(lead, e.target.value)} style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)' }}>
                                                    {[...ACTIVE_COLUMNS, { id: 'Paid', label: 'Mark as Paid' }, { id: 'Lost', label: 'Archived / Lost' }].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                </select>
                                                <button onClick={() => openEditor(lead)} className="btn sm secondary" style={{ fontSize: '10px' }}>Edit</button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    );
                })}
            </div>

            {isDrawerOpen && (
                <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') closeEditor(); }}>
                    <div className="drawer-panel glass" style={{ borderLeft: '1px solid var(--line)' }}>
                        <h2 style={{ marginTop: 0 }}>{editingLead ? 'Edit Project' : 'New Project'}</h2>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input required value={formName} onChange={e => setFormName(e.target.value)} placeholder="Client Name" />
                            <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="Value" />
                            <select value={formType} onChange={e => setFormType(e.target.value)}>
                                <option value="Wedding">Wedding</option><option value="Videography">Videography</option>
                                <option value="Portrait">Portrait</option><option value="Commercial">Commercial</option>
                            </select>
                            <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email" />
                            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notes" style={{ minHeight: '120px' }} />
                            <button type="submit" className="btn primary">Save Details</button>
                            <button type="button" className="btn secondary" onClick={closeEditor}>Cancel</button>
                        </form>
                    </div>
                </div>
            )}

            {archiveTarget && (
                <div className="drawer glass" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', padding: '24px', zIndex: 11000, background: 'rgba(15, 26, 51, 0.98)' }}>
                    <h2>{archiveTarget} Leads</h2>
                    <input placeholder="Search..." value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        {activeArchiveLeads.map(l => (
                            <div key={l.id} className="card glass" style={{ margin: 0, padding: '12px' }}>
                                <div style={{ fontWeight: 800 }}>{l.name}</div>
                                <div className="muted small">{formatMoney(l.quoted_value_cents)}</div>
                                <button onClick={() => { setArchiveTarget(null); openEditor(l); }} className="btn sm secondary" style={{ marginTop: '8px' }}>Edit</button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setArchiveTarget(null)} className="btn secondary" style={{ marginTop: '20px' }}>Close</button>
                </div>
            )}

            {(isDrawerOpen || archiveTarget) && <div onClick={() => { closeEditor(); setArchiveTarget(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />}
        </>
    );
}

export default function CRM() {
    return (
        <section className="dashboard">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
                <NavLink to="/crm" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} end>
                    Pipeline
                </NavLink>
                <NavLink to="/crm/invoices" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>
                    Invoices
                </NavLink>
            </div>

            <Routes>
                <Route index element={<PipelineView />} />
                <Route path="invoices" element={<Invoice />} />
            </Routes>
        </section>
    );
}

