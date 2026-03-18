import React, { useState, useRef, useEffect } from 'react';
import { apiPost } from '../api';
import { useAuth } from './AuthContext';

export default function AssistantSidebar() {
    const { settings } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', text: "Hello! I'm Your Assistant. How can I help you optimize your studio's finances today?" }
    ]);
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
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
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', text: "I'm having trouble connecting to my brain right now. Please ensure your Gemini API key is set in the Control Center." }]);
        } finally {
            setLoading(false);
        }
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
                {isOpen ? '✕' : '🧠'}
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
                        <div className="muted extra-small" style={{ letterSpacing: '0.05em', fontWeight: 800 }}>POWERED BY GEMINI 1.5 FLASH</div>
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
                            {m.text}
                        </div>
                    ))}
                    {loading && <div className="muted small" style={{ fontStyle: 'italic', paddingLeft: '10px' }}>Thinking...</div>}
                    <div ref={endRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ position: 'relative' }}>
                        <input 
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Ask for advice or status..."
                            style={{
                                width: '100%',
                                padding: '16px 50px 16px 20px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                fontSize: '14px'
                            }}
                        />
                        <button type="submit" disabled={loading} style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            translate: '0 -50%',
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            opacity: query.trim() ? 1 : 0.3
                        }}>🚀</button>
                    </div>
                </form>
            </div>
        </>
    );
}
