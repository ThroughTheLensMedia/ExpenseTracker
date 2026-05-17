import React, { useState, useRef, useEffect } from 'react';
import { apiPost, apiPatch } from '../api';
import { useAuth } from './AuthContext';

// Lightweight markdown renderer — handles bullets, bold, italic, line breaks
function renderMarkdown(text) {
    if (!text) return { __html: '' };
    const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => escape(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:4px;font-size:12px;">$1</code>');

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
        const trimmed = line.trim();
        const isBullet = /^[\*\-•]\s/.test(trimmed);

        if (isBullet) {
            if (!inList) { html += '<ul style="margin:8px 0 8px 4px;padding-left:18px;list-style:disc;">'; inList = true; }
            html += `<li style="margin:3px 0;">${inline(trimmed.replace(/^[\*\-•]\s/, ''))}</li>`;
        } else {
            if (inList) { html += '</ul>'; inList = false; }
            if (trimmed === '') {
                html += '<div style="height:6px;"></div>';
            } else {
                html += `<div style="margin:2px 0;">${inline(trimmed)}</div>`;
            }
        }
    }
    if (inList) html += '</ul>';
    return { __html: html };
}

export default function AssistantSidebar() {
    const { settings, user } = useAuth();

    // Derive first name: contact_name → business_name → email prefix
    const rawName = settings?.contact_name || settings?.business_name || user?.email || '';
    const firstName = rawName.split(/[\s@.]/)[0];
    const greeting = firstName
        ? `Hello, ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}! I'm your assistant. How can I help you?`
        : "Hello! I'm your assistant. How can I help you?";

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', text: greeting }
    ]);
    const [loading, setLoading] = useState(false);
    const [pendingActions, setPendingActions] = useState([]);
    const endRef = useRef(null);

    useEffect(() => {
        if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Shift+Enter = newline; Enter alone = submit
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (query.trim() && !loading) handleSend();
        }
    };

    const handleSend = async () => {
        if (!query.trim() || loading) return;

        const userMsg = query.trim();
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        try {
            const res = await apiPost('/brain/ask', {
                prompt: userMsg,
                context: {
                    page: window.location.pathname,
                    business: settings?.business_name
                }
            });
            setMessages(prev => [...prev, { role: 'assistant', text: res.answer }]);
            if (res.pendingActions?.length) setPendingActions(prev => [...prev, ...res.pendingActions]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', text: `I'm having trouble: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    // Dispatch refresh event so the currently-visible page reloads its data
    const dispatchRefresh = (scope) => {
        window.dispatchEvent(new CustomEvent('ll:refresh', { detail: { scope } }));
    };

    const handleApprove = async (action) => {
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
        try {
            if (action.type === 'update_lead_status') {
                await apiPatch(`/leads/${action.payload.leadId}`, { status: action.payload.status });
                setMessages(prev => [...prev, { role: 'assistant', text: `Done — **${action.payload.leadName}** is now **${action.payload.status}**.` }]);
                dispatchRefresh('leads');
            } else if (action.type === 'create_transaction') {
                await apiPost('/expenses', action.payload);
                setMessages(prev => [...prev, { role: 'assistant', text: `Done — transaction added to your ledger.` }]);
                dispatchRefresh('transactions');
            } else if (action.type === 'link_transaction_to_lead') {
                await apiPatch(`/expenses/${action.payload.transactionId}`, { lead_id: action.payload.leadId });
                setMessages(prev => [...prev, { role: 'assistant', text: `Done — transaction linked to the lead.` }]);
                dispatchRefresh('transactions');
                dispatchRefresh('leads');
            } else if (action.type === 'update_invoice_status') {
                const patch = { status: action.payload.status };
                if (action.payload.amount_paid_cents !== undefined) patch.amount_paid_cents = action.payload.amount_paid_cents;
                await apiPatch(`/invoices/${action.payload.invoiceId}`, patch);
                const label = action.payload.status === 'paid'
                    ? `Invoice **#${action.payload.invoiceNumber}** marked **Paid**.`
                    : `Invoice **#${action.payload.invoiceNumber}** is now **${action.payload.status}**.`;
                setMessages(prev => [...prev, { role: 'assistant', text: `Done — ${label}` }]);
                dispatchRefresh('invoices');
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', text: `Action failed: ${err.message}` }]);
        }
    };

    const handleReject = (action) => {
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
        setMessages(prev => [...prev, { role: 'assistant', text: `Cancelled — no changes made.` }]);
    };

    if (!settings?.gemini_api_key) return null; // Only show if AI is configured

    return (
        <>
            {/* Floating Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '100px', // Above mobile nav
                    right: '30px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: 'none',
                    boxShadow: '0 8px 32px rgba(249, 115, 22, 0.4)',
                    cursor: 'pointer',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                {isOpen ? '✕' : '📸'}
            </button>

            {/* Sidebar Panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: isOpen ? 0 : '-450px',
                width: '100%',
                maxWidth: '400px',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                zIndex: 9998,
                transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-20px 0 50px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{ padding: '30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>Your Assistant</h3>
                        <div className="muted extra-small" style={{ letterSpacing: '0.05em', fontWeight: 800 }}>POWERED BY GEMINI 2.5 FLASH</div>
                    </div>
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer', fontSize: '20px' }}>✕</button>
                </div>

                {/* Chat Contents */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {messages.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '14px 18px',
                            background: m.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                            borderRadius: m.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            fontWeight: m.role === 'user' ? 700 : 500
                        }}>
                            {m.role === 'assistant'
                                ? <div dangerouslySetInnerHTML={renderMarkdown(m.text)} />
                                : m.text}
                        </div>
                    ))}
                    {/* Pending Action Confirmation Cards */}
                    {pendingActions.map(action => (
                        <div key={action.id} style={{
                            alignSelf: 'flex-start',
                            width: '100%',
                            padding: '16px 18px',
                            background: 'rgba(249,115,22,0.07)',
                            border: '1px solid rgba(249,115,22,0.35)',
                            borderRadius: '12px',
                            fontSize: '13px'
                        }}>
                            <div style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: '#f97316', marginBottom: '8px' }}>
                                PENDING ACTION — CONFIRM TO EXECUTE
                            </div>
                            <div style={{ marginBottom: '14px', lineHeight: 1.6 }}
                                dangerouslySetInnerHTML={renderMarkdown(action.description)} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => handleApprove(action)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 900, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}
                                >
                                    APPROVE
                                </button>
                                <button
                                    onClick={() => handleReject(action)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 900, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}
                                >
                                    REJECT
                                </button>
                            </div>
                        </div>
                    ))}

                    {loading && <div className="muted small" style={{ fontStyle: 'italic', paddingLeft: '10px' }}>Thinking...</div>}
                    <div ref={endRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ position: 'relative' }}>
                        <textarea
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask for advice or status... (Shift+Enter for new line)"
                            rows={1}
                            style={{
                                width: '100%',
                                padding: '14px 50px 14px 20px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                fontSize: '14px',
                                resize: 'none',
                                overflowY: 'auto',
                                maxHeight: '120px',
                                lineHeight: '1.5',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box'
                            }}
                            onInput={e => {
                                // Auto-grow up to maxHeight
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                bottom: '10px',
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                opacity: query.trim() ? 1 : 0.3,
                                lineHeight: 1
                            }}
                        >🚀</button>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '6px', textAlign: 'right' }}>
                        Enter to send · Shift+Enter for new line
                    </div>
                </div>
            </div>
        </>
    );
}
