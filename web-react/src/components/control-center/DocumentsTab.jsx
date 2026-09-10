import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../AuthContext';
import { useModal } from '../ModalContext.jsx';

const DOC_TYPES = [
    { value: 'general',   label: 'General' },
    { value: 'warranty',  label: 'Warranty' },
    { value: 'contract',  label: 'Contract' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'loan',      label: 'Loan / Financing' },
    { value: 'equipment', label: 'Equipment / Camera Gear' },
    { value: 'purchase',  label: 'Purchase / Receipt' },
];

const TYPE_COLORS = {
    warranty:  '#4ade80',
    contract:  '#818cf8',
    insurance: '#f97316',
    loan:      '#fbbf24',
    equipment: '#38bdf8',
    purchase:  '#f472b6',
    general:   'rgba(255,255,255,0.4)',
};

async function getFreshHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
}

export default function DocumentsTab({ settings }) {
    const modal = useModal();
    const [docs, setDocs]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [loadError, setLoadError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState('');
    const [docType, setDocType]     = useState('general');
    const [searchText, setSearchText] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [msg, setMsg]             = useState(null); // { text, ok } | null
    const [deleting, setDeleting]   = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editFilename, setEditFilename] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving]       = useState(false);
    const fileRef = useRef(null);

    const hasKey = !!settings?.gemini_api_key;

    const loadDocs = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const headers = await getFreshHeader();
            const res = await fetch('/api/documents', { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load documents');
            setDocs(Array.isArray(data) ? data : []);
        } catch (err) {
            setLoadError(err.message || 'Could not load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDocs(); }, []);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setUploading(true);
        setUploadingFile(file.name);
        setMsg(null);

        try {
            const headers = await getFreshHeader();
            const fd = new FormData();
            fd.append('file', file);
            fd.append('doc_type', docType);

            const res = await fetch('/api/documents/upload', {
                method:  'POST',
                headers,
                body:    fd,
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'no_key') {
                    setMsg({ text: '⚠️ Set your Gemini API key in AI Intelligence first.', ok: false });
                } else {
                    setMsg({ text: data.error || 'Upload failed', ok: false });
                }
                return;
            }

            setMsg({ text: `"${data.filename}" saved — ${data.chunk_count} sections ready for Brain.`, ok: true });
            await loadDocs();
        } catch (err) {
            setMsg({ text: `Upload failed: ${err.message}`, ok: false });
        } finally {
            setUploading(false);
            setUploadingFile('');
        }
    };

    const handleDownload = async (id) => {
        setDownloading(id);
        try {
            const headers = await getFreshHeader();
            const res = await fetch(`/api/documents/${id}/download`, { headers });
            const data = await res.json();
            if (!res.ok) {
                setMsg({ text: data.error || 'Could not retrieve file', ok: false });
                return;
            }
            window.open(data.url, '_blank', 'noopener');
        } catch (err) {
            setMsg({ text: `Download failed: ${err.message}`, ok: false });
        } finally {
            setDownloading(null);
        }
    };

    const handleDelete = async (id, filename) => {
        const ok = await modal.confirm(`Remove "${filename}" from Brain's knowledge? This cannot be undone.`);
        if (!ok) return;
        setDeleting(id);
        try {
            const headers = await getFreshHeader();
            const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Delete failed');
            }
            setDocs(prev => prev.filter(d => d.id !== id));
            setMsg({ text: `"${filename}" removed.`, ok: true });
        } catch (err) {
            setMsg({ text: `${err.message || 'Delete failed'} — try again.`, ok: false });
        } finally {
            setDeleting(null);
        }
    };

    const startEdit = (doc) => {
        setEditingId(doc.id);
        setEditFilename(doc.filename);
        setEditNotes(doc.notes || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditFilename('');
        setEditNotes('');
    };

    const saveEdit = async (id) => {
        const trimmed = editFilename.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const headers = await getFreshHeader();
            const res = await fetch(`/api/documents/${id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: trimmed, notes: editNotes.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMsg({ text: data.error || 'Update failed', ok: false });
                return;
            }
            setDocs(prev => prev.map(d => d.id === id ? data : d));
            setMsg({ text: `"${data.filename || trimmed}" updated.`, ok: true });
            cancelEdit();
        } catch (err) {
            setMsg({ text: `Update failed: ${err.message}`, ok: false });
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const visibleDocs = useMemo(() => {
        const term = searchText.trim().toLowerCase();
        return docs.filter(doc => {
            if (typeFilter !== 'all' && doc.doc_type !== typeFilter) return false;
            if (!term) return true;
            return [doc.filename, doc.notes, DOC_TYPES.find(type => type.value === doc.doc_type)?.label]
                .some(value => value?.toLowerCase().includes(term));
        });
    }, [docs, searchText, typeFilter]);

    const clearFilters = () => {
        setSearchText('');
        setTypeFilter('all');
    };

    return (
        <div style={{ display: 'grid', gap: 16 }}>

            {/* Upload card */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="document-upload-heading">
                <h2 id="document-upload-heading" style={{ margin: 0, fontSize: 20 }}>Add a document</h2>
                <p className="muted" style={{ maxWidth: 760, margin: '8px 0 18px', fontSize: 14, lineHeight: 1.55 }}>
                    Choose a document type, then upload a PDF or image. Lumière indexes its text so the Assistant can answer questions about dates, coverage, financing, equipment, and purchase details. The original file remains available here.
                </p>

                {!hasKey && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(247,185,85,.08)', border: '1px solid rgba(247,185,85,.3)', fontSize: 13, color: 'var(--warn)', marginBottom: 16, lineHeight: 1.5 }}>
                        Set your Gemini API key in the <strong>AI Intelligence</strong> tab before uploading an image. PDFs with selectable text can still be indexed without it.
                    </div>
                )}

                <div className="controls" style={{ alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flex: '1 1 220px', flexDirection: 'column', gap: 8 }}>
                        <span className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em' }}>DOCUMENT TYPE</span>
                        <select
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            style={{ minHeight: 48, fontSize: 14 }}
                            disabled={uploading}
                        >
                            {DOC_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </label>

                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        minHeight: 48, padding: '10px 18px', borderRadius: 12, cursor: uploading ? 'not-allowed' : 'pointer',
                        background: uploading ? 'rgba(255,255,255,0.04)' : 'rgba(129,140,248,0.12)',
                        border: `1px solid ${uploading ? 'rgba(255,255,255,0.1)' : 'rgba(129,140,248,0.4)'}`,
                        color: uploading ? 'rgba(255,255,255,0.3)' : '#818cf8',
                        fontWeight: 700, fontSize: 14, userSelect: 'none',
                        opacity: uploading ? 0.6 : 1,
                    }}>
                        {uploading ? `Processing ${uploadingFile}…` : 'Choose PDF or Image'}
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,image/*"
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>

                {msg && (
                    <div role="status" style={{
                        marginTop: '14px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px',
                        background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                        border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.25)'}`,
                        color: msg.ok ? '#4ade80' : '#f87171',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span>{msg.text}</span>
                    </div>
                )}
            </section>

            {/* Indexed documents list */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="document-list-heading">
                <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 18 }}>
                    <div>
                        <h2 id="document-list-heading" style={{ margin: 0, fontSize: 20 }}>Your documents</h2>
                        <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>{docs.length} document{docs.length === 1 ? '' : 's'} available</div>
                    </div>
                    {!!docs.length && (
                        <div className="controls" style={{ alignItems: 'center' }}>
                            <input
                                type="search"
                                value={searchText}
                                onChange={event => setSearchText(event.target.value)}
                                placeholder="Search name or notes"
                                aria-label="Search documents"
                                style={{ width: 'min(260px, 100%)', minHeight: 44, fontSize: 13 }}
                            />
                            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} aria-label="Filter documents by type" style={{ minHeight: 44, width: 'auto', fontSize: 13 }}>
                                <option value="all">All types</option>
                                {DOC_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="empty-state">Loading your documents…</div>
                ) : loadError ? (
                    <div className="empty-state">
                        <strong style={{ color: 'var(--bad)' }}>Documents could not be loaded</strong>
                        <span className="muted">{loadError}</span>
                        <button type="button" className="btn secondary" onClick={loadDocs}>Retry</button>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="empty-state">
                        <strong>No documents yet</strong>
                        <span className="muted">Choose a type above and upload your first PDF or image.</span>
                    </div>
                ) : visibleDocs.length === 0 ? (
                    <div className="empty-state">
                        <strong>No documents match these filters</strong>
                        <button type="button" className="btn secondary" onClick={clearFilters}>Clear filters</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {visibleDocs.map(doc => (
                            <div key={doc.id} className="mobile-break" style={{
                                display: 'flex', alignItems: editingId === doc.id ? 'flex-start' : 'center', gap: 14,
                                padding: '14px 16px', borderRadius: 12,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: editingId === doc.id ? '8px' : 0,
                                    background: TYPE_COLORS[doc.doc_type] || TYPE_COLORS.general,
                                }} />
                                {editingId === doc.id ? (
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input
                                            autoFocus
                                            aria-label="Document name"
                                            value={editFilename}
                                            onChange={e => setEditFilename(e.target.value)}
                                            placeholder="Filename"
                                            style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 700 }}
                                        />
                                        <textarea
                                            aria-label="Document notes"
                                            value={editNotes}
                                            onChange={e => setEditNotes(e.target.value)}
                                            placeholder="Add a note — e.g. which lens/camera this receipt covers, warranty end date…"
                                            rows={2}
                                            style={{ padding: '6px 10px', fontSize: '12px', resize: 'vertical', fontFamily: 'inherit' }}
                                        />
                                        <div className="controls" style={{ alignItems: 'center' }}>
                                            <button type="button" className="btn sm" style={{ fontSize: 12 }} disabled={saving} onClick={() => saveEdit(doc.id)}>
                                                {saving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button type="button" className="btn sm secondary" style={{ fontSize: 12 }} disabled={saving} onClick={cancelEdit}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>
                                            {doc.filename}
                                        </div>
                                        <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                            {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || 'General'}
                                            {' · '}{doc.chunk_count} section{doc.chunk_count !== 1 ? 's' : ''}
                                            {' · '}{formatDate(doc.created_at)}
                                        </div>
                                        {doc.notes && (
                                            <div style={{ fontSize: '12px', marginTop: '6px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                                                {doc.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {editingId !== doc.id && (
                                    <div className="controls" style={{ alignItems: 'center', flexShrink: 0 }}>
                                        {doc.file_path && (
                                            <button
                                                type="button"
                                                className="btn secondary"
                                                style={{ fontSize: 12, color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }}
                                                disabled={downloading === doc.id}
                                                onClick={() => handleDownload(doc.id)}
                                            >
                                                {downloading === doc.id ? 'Opening…' : 'View original'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn secondary"
                                            style={{ fontSize: 12 }}
                                            onClick={() => startEdit(doc)}
                                        >
                                            Edit details
                                        </button>
                                        <button
                                            type="button"
                                            className="btn secondary"
                                            style={{ fontSize: 12, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                                            disabled={deleting === doc.id}
                                            onClick={() => handleDelete(doc.id, doc.filename)}
                                        >
                                            {deleting === doc.id ? '…' : 'Remove'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
}
