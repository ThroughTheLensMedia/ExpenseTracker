import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, formatMoney } from '../api';

const ACTIVE_COLUMNS = [
    { id: 'New Lead', label: 'New Lead', color: '#a8b6dd', glow: 'rgba(168, 182, 221, 0.2)' },
    { id: 'Quoted', label: 'Quoted', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.2)' },
    { id: 'Booked', label: 'Booked', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.2)' }
];

export default function CRM() {
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
            `"${l.name}"`,
            `"${l.email}"`,
            `"${l.phone}"`,
            `"${l.status}"`,
            `"${l.project_type}"`,
            (l.quoted_value_cents / 100).toFixed(2),
            l.created_at
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
        <section className="dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>CRM Console</h1>
                    <div className="muted" style={{ fontWeight: 600 }}>Through The Lens · Studio Pipeline</div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Rolled up Archive Stats */}
                    <div className="glass" style={{ padding: '8px 16px', borderRadius: '12px', display: 'flex', gap: '20px', fontSize: '12px' }}>
                        <div
                            onClick={() => setArchiveTarget('Paid')}
                            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            <span className="muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success (Paid) 👁️</span>
                            <span style={{ color: '#4ade80', fontWeight: 900 }}>{archiveStats.Paid.length} Clients ({formatMoney(archiveStats.Paid.reduce((s, l) => s + l.quoted_value_cents, 0))})</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <div
                            onClick={() => setArchiveTarget('Lost')}
                            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            <span className="muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lost Archive 👁️</span>
                            <span style={{ color: '#ff4d4d', fontWeight: 900 }}>{archiveStats.Lost.length} Rows</span>
                        </div>
                    </div>

                    <button className="btn" onClick={exportToCSV} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '12px', background: 'rgba(168, 182, 221, 0.1)', color: '#fff', border: '1px solid rgba(168, 182, 221, 0.3)' }}>
                        📤 Export Newsletter
                    </button>

                    <button className="btn glow-blue" onClick={() => openEditor()} style={{ padding: '10px 20px', fontWeight: 900 }}>
                        + New Lead
                    </button>
                </div>
            </div>

            {/* Kanban Board - Active Stages Only */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                minHeight: '65vh',
                width: '100%'
            }}>
                {ACTIVE_COLUMNS.map(col => {
                    const columnLeads = leads.filter(l => (l.status || 'New Lead') === col.id);
                    const totalValue = columnLeads.reduce((s, l) => s + (l.quoted_value_cents || 0), 0);

                    return (
                        <div key={col.id} style={{
                            background: 'rgba(15, 26, 51, 0.4)',
                            borderTop: `4px solid ${col.color}`,
                            borderRadius: '24px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxShadow: `0 15px 35px rgba(0,0,0,0.2), 0 0 20px ${col.glow}`,
                            border: '1px solid rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontWeight: 900, color: col.color, textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.1em' }}>
                                    {col.label} <span style={{ opacity: 0.5 }}>{columnLeads.length}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#fff', fontWeight: 900, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                    {formatMoney(totalValue)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {columnLeads.length === 0 ? (
                                    <div className="muted" style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '11px' }}>
                                        No active {col.label.toLowerCase()}s
                                    </div>
                                ) : (
                                    columnLeads.map(lead => (
                                        <div key={lead.id} className="card glass" style={{ margin: 0, padding: '16px', borderRadius: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div style={{ fontWeight: 900, fontSize: '15px', color: '#fff' }}>{lead.name}</div>
                                                <div style={{ fontWeight: 900, fontFamily: 'var(--mono)', fontSize: '14px', color: col.color }}>{formatMoney(lead.quoted_value_cents)}</div>
                                            </div>

                                            <div style={{ marginBottom: '12px' }}>
                                                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px' }}>{lead.project_type}</span>
                                            </div>

                                            {(lead.email || lead.phone) && (
                                                <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', marginBottom: '12px' }}>
                                                    {lead.email && <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>✉️ {lead.email}</div>}
                                                    {lead.phone && <div>📞 {lead.phone}</div>}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                <select
                                                    value={lead.status}
                                                    onChange={(e) => handleMove(lead, e.target.value)}
                                                    style={{ width: 'auto', fontSize: '11px', fontWeight: 800, padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                                                >
                                                    {[...ACTIVE_COLUMNS, { id: 'Paid', label: 'Mark as Paid' }, { id: 'Lost', label: 'Archived / Lost' }].map(c => (
                                                        <option key={c.id} value={c.id}>{c.label}</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => openEditor(lead)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>Edit</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Editor Drawer */}
            {isDrawerOpen && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
                    background: 'rgba(15, 26, 51, 0.98)', borderLeft: '1px solid var(--line)',
                    padding: '32px', zIndex: 11000, boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                    overflowY: 'auto', backdropFilter: 'blur(20px)'
                }}>
                    <h2 style={{ marginTop: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 900 }}>{editingLead ? 'Edit Project' : 'New Project'}</h2>
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
            )}

            {/* Archive Viewer Drawer */}
            {archiveTarget && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px',
                    background: 'rgba(10, 15, 28, 0.98)', borderLeft: '1px solid var(--line)',
                    padding: '32px', zIndex: 10500, boxShadow: '-15px 0 50px rgba(0,0,0,0.6)',
                    overflowY: 'auto', backdropFilter: 'blur(30px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem', fontWeight: 900 }}>
                            {archiveTarget} Lead Archive
                        </h2>
                        <button onClick={() => setArchiveTarget(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Close</button>
                    </div>

                    <input
                        type="text"
                        placeholder="Search archived names or emails..."
                        value={archiveSearch}
                        onChange={(e) => setArchiveSearch(e.target.value)}
                        style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {activeArchiveLeads.length === 0 ? (
                            <div className="muted" style={{ textAlign: 'center', padding: '40px' }}>No records found in this section.</div>
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
                                            View/Edit Card
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
            )}

            {/* Backdrop for Editor and Archive */}
            {(isDrawerOpen || archiveTarget) && (
                <div onClick={() => { closeEditor(); setArchiveTarget(null); }} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)', zIndex: 9999, backdropFilter: 'blur(5px)'
                }} />
            )}
        </section>
    );
}

