import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../AuthContext';
import { useModal } from '../ModalContext.jsx';

const DOC_TYPES = [
    { value: 'general',   label: 'General' },
    { value: 'warranty',  label: 'Warranty' },
    { value: 'contract',  label: 'Contract' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'loan',      label: 'Loan / Financing' },
];

const TYPE_COLORS = {
    warranty:  '#4ade80',
    contract:  '#818cf8',
    insurance: '#f97316',
    loan:      '#fbbf24',
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
    const [uploading, setUploading] = useState(false);
    const [docType, setDocType]     = useState('general');
    const [msg, setMsg]             = useState(null); // { text, ok } | null
    const [deleting, setDeleting]   = useState(null);
    const [downloading, setDownloading] = useState(null);
    const fileRef = useRef(null);

    const hasKey = !!settings?.gemini_api_key;

    const loadDocs = async () => {
        try {
            const headers = await getFreshHeader();
            const res = await fetch('/api/documents', { headers });
            const data = await res.json();
            setDocs(Array.isArray(data) ? data : []);
        } catch (_) {
            setDocs([]);
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
        }
    };

    const handleDownload = async (id, filename) => {
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
            await fetch(`/api/documents/${id}`, { method: 'DELETE', headers });
            setDocs(prev => prev.filter(d => d.id !== id));
            setMsg({ text: `"${filename}" removed.`, ok: false });
        } catch (_) {
            setMsg({ text: 'Delete failed — try again.', ok: false });
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Upload card */}
            <div className="card glass" style={{ padding: '24px 28px' }}>
                <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '6px' }}>📄 Add a Document</div>
                <div className="muted" style={{ fontSize: '13px', marginBottom: '18px', lineHeight: 1.6 }}>
                    Upload a contract, warranty, insurance policy, or loan document. Brain will read it and answer questions about it — expiration dates, coverage limits, interest rates, serial numbers, anything in the text. You can also view the original file anytime.
                </div>

                {!hasKey && (
                    <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', fontSize: '13px', color: '#f97316', marginBottom: '16px' }}>
                        ⚠️ Set your Gemini API key in the <strong>AI Intelligence</strong> tab first — image documents require it for text extraction.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={docType}
                        onChange={e => setDocType(e.target.value)}
                        style={{ padding: '10px 12px', fontSize: '13px', minWidth: '160px' }}
                        disabled={uploading}
                    >
                        {DOC_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>

                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer',
                        background: uploading ? 'rgba(255,255,255,0.04)' : 'rgba(129,140,248,0.12)',
                        border: `1px solid ${uploading ? 'rgba(255,255,255,0.1)' : 'rgba(129,140,248,0.4)'}`,
                        color: uploading ? 'rgba(255,255,255,0.3)' : '#818cf8',
                        fontWeight: 700, fontSize: '13px', userSelect: 'none',
                        opacity: uploading ? 0.6 : 1,
                    }}>
                        {uploading ? '⏳ Processing…' : '⬆ Upload PDF or Image'}
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
                    <div style={{
                        marginTop: '14px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px',
                        background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                        border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.25)'}`,
                        color: msg.ok ? '#4ade80' : '#f87171',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span>{msg.ok ? '✅' : '⚠️'}</span>
                        <span>{msg.text}</span>
                    </div>
                )}
            </div>

            {/* Indexed documents list */}
            <div className="card glass" style={{ padding: '24px 28px' }}>
                <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '16px' }}>My Documents</div>

                {loading ? (
                    <div className="muted" style={{ fontSize: '13px' }}>Loading…</div>
                ) : docs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📂</div>
                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>No documents indexed yet</div>
                        <div className="muted" style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
                            Upload a contract or warranty above and Brain will be able to answer questions about it instantly.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {docs.map(doc => (
                            <div key={doc.id} style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '14px 16px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                    background: TYPE_COLORS[doc.doc_type] || TYPE_COLORS.general,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {doc.filename}
                                    </div>
                                    <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                        {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || 'General'}
                                        {' · '}{doc.chunk_count} section{doc.chunk_count !== 1 ? 's' : ''}
                                        {' · '}{formatDate(doc.created_at)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    {doc.file_path && (
                                        <button
                                            className="btn secondary"
                                            style={{ fontSize: '11px', padding: '4px 10px', color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }}
                                            disabled={downloading === doc.id}
                                            onClick={() => handleDownload(doc.id, doc.filename)}
                                        >
                                            {downloading === doc.id ? '…' : '📄 View'}
                                        </button>
                                    )}
                                    <button
                                        className="btn secondary"
                                        style={{ fontSize: '11px', padding: '4px 10px', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                                        disabled={deleting === doc.id}
                                        onClick={() => handleDelete(doc.id, doc.filename)}
                                    >
                                        {deleting === doc.id ? '…' : 'Remove'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
