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

    const pipelineStats = useMemo(() => {
        const activeLeads = leads.filter(l => !['Paid', 'Lost'].includes(l.status));
        const potential = activeLeads.reduce((s, l) => s + (l.quoted_value_cents || 0), 0);
        const bookedCount = leads.filter(l => l.status === 'Booked').length;
        return { potential, bookedCount };
    }, [leads]);

    const activeDraftCount = useMemo(() => leads.filter(l => l.status === 'New Lead' || !l.status).length, [leads]);

    return (
        <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Pipeline Dashboard Card */}
                <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Executive Pipeline</h1>
                            <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>Through The Lens · Studio Leads & Sales Funnel</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button className="btn secondary sm" onClick={exportToCSV}>📤 Export CSV</button>
                            <button className="btn glow-blue" onClick={() => openEditor()} style={{ padding: '10px 24px', fontWeight: 900 }}>+ New Project</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '30px' }}>
                        <div className="stat glass" style={{ borderTop: '4px solid #38bdf8', textAlign: 'center', padding: '24px' }}>
                            <div className="muted small" style={{ fontWeight: 800 }}>PIPELINE VALUE</div>
                            <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#38bdf8', marginTop: '8px' }}>{formatMoney(pipelineStats.potential)}</div>
                        </div>
                        <div className="stat glass" style={{ borderTop: '4px solid #a8b6dd', textAlign: 'center', padding: '24px' }}>
                            <div className="muted small" style={{ fontWeight: 800 }}>NEW INTEREST</div>
                            <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '8px' }}>{activeDraftCount} Leads</div>
                        </div>
                        <div className="stat glass" style={{ borderTop: '4px solid #fbbf24', textAlign: 'center', padding: '24px' }}>
                            <div className="muted small" style={{ fontWeight: 800 }}>BOOKED RATIO</div>
                            <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fbbf24', marginTop: '8px' }}>{pipelineStats.bookedCount} Projects</div>
                        </div>
                        <div className="stat glass" style={{ borderTop: '4px solid #4ade80', cursor: 'pointer', textAlign: 'center', padding: '24px' }} onClick={() => setArchiveTarget('Paid')}>
                            <div className="muted small" style={{ fontWeight: 800 }}>CONVERTED / PAID 👁️</div>
                            <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#4ade80', marginTop: '8px' }}>{archiveStats.Paid.length} Clients</div>
                        </div>
                    </div>
                </div>

                {/* Archive Notification Bar (Subtle) */}
                {archiveStats.Lost.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <div onClick={() => setArchiveTarget('Lost')} className="tag" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,100,100,0.2)', color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                            VIEW LOST ARCHIVE ({archiveStats.Lost.length})
                        </div>
                    </div>
                )}

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
            </section>

            {isDrawerOpen && (
                <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') closeEditor(); }}>
                    <div className="drawer-panel glass" style={{ borderLeft: '1px solid var(--line)' }}>
                        <h2 style={{ marginTop: 0 }}>{editingLead ? 'Edit Project' : 'New Project'}</h2>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
                            <div>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Client / Project Name</label>
                                <input required value={formName} onChange={e => setFormName(e.target.value)} style={{ padding: '12px' }} placeholder="e.g. Smith Wedding" />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Value ($)</label>
                                    <input required type="number" step="0.01" value={formValue} onChange={e => setFormValue(e.target.value)} style={{ padding: '12px' }} placeholder="2500.00" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Type</label>
                                    <select value={formType} onChange={e => setFormType(e.target.value)} style={{ padding: '12px' }}>
                                        <option value="Wedding">Wedding</option>
                                        <option value="Videography">Videography</option>
                                        <option value="Portrait">Portrait</option>
                                        <option value="Commercial">Commercial</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Email</label>
                                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} style={{ padding: '12px' }} placeholder="client@example.com" />
                            </div>
                            <div>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Phone</label>
                                <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} style={{ padding: '12px' }} placeholder="(555) 555-5555" />
                            </div>
                            <div>
                                <label className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Project Notes</label>
                                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ minHeight: '120px', padding: '12px' }} placeholder="Scope details, concept, etc..." />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button type="button" className="btn secondary" onClick={closeEditor} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="btn glow-blue" style={{ flex: 2 }}>Save Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {archiveTarget && (
                <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') setArchiveTarget(null); }}>
                    <div className="drawer-panel glass" style={{ borderLeft: '1px solid var(--line)', width: '500px', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem', fontWeight: 900 }}>
                                {archiveTarget} Lead Archive
                            </h2>
                            <button onClick={() => setArchiveTarget(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Close</button>
                        </div>

                        <input
                            type="text"
                            placeholder="Search archived names..."
                            value={archiveSearch}
                            onChange={(e) => setArchiveSearch(e.target.value)}
                            style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activeArchiveLeads.length === 0 ? (
                                <div className="muted" style={{ textAlign: 'center', padding: '40px' }}>No records found.</div>
                            ) : (
                                activeArchiveLeads.map(lead => (
                                    <div key={lead.id} className="card glass" style={{ margin: 0, padding: '16px', background: 'rgba(255,255,255,0.02) !important' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 900, color: '#fff' }}>{lead.name}</div>
                                                <div className="muted" style={{ fontSize: '11px' }}>{lead.project_type} · {new Date(lead.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div style={{ fontWeight: 900, color: archiveTarget === 'Paid' ? '#4ade80' : '#ff4d4d' }}>{formatMoney(lead.quoted_value_cents)}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button
                                                onClick={() => { setArchiveTarget(null); openEditor(lead); }}
                                                style={{ flex: 1, background: 'rgba(56, 189, 248, 0.1)', border: 'none', color: '#38bdf8', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                Edit Card
                                            </button>
                                            <select
                                                value={lead.status}
                                                onChange={(e) => handleMove(lead, e.target.value)}
                                                style={{ flex: 1, fontSize: '11px', padding: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                            >
                                                {[...ACTIVE_COLUMNS, { id: 'Paid', label: 'Paid' }, { id: 'Lost', label: 'Lost' }].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {(isDrawerOpen || archiveTarget) && <div onClick={() => { closeEditor(); setArchiveTarget(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />}
        </>
    );
}

export default function CRM() {
    return (
        <section className="dashboard">
            <div style={{ display: 'flex', gap: '0', marginBottom: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <NavLink to="/crm" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center', borderRadius: '16px', padding: '16px', fontSize: '15px', border: 'none' }} end>
                    Lead Pipeline
                </NavLink>
                <NavLink to="/crm/financials" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center', borderRadius: '16px', padding: '16px', fontSize: '15px', border: 'none' }}>
                    Financial Ledger
                </NavLink>
            </div>

            <Routes>
                <Route index element={<PipelineView />} />
                <Route path="financials" element={<Invoice />} />
            </Routes>
        </section>
    );
}

