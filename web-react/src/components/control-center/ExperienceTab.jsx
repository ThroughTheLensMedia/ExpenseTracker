import React, { useState } from 'react';
import { apiPost } from '../../api';
import { useAuth } from '../AuthContext';
import { EXPERIENCE_MODES, getExperienceMode } from '../../constants/experienceModes';

const OPTIONS = [
    { id: EXPERIENCE_MODES.PERSONAL, title: 'Personal', text: 'A focused view for everyday income, spending, accounts, imports, documents, and financial questions.' },
    { id: EXPERIENCE_MODES.BUSINESS, title: 'Business', text: 'The complete workspace with Schedule C, mileage, equipment, CRM, invoicing, clients, and business analytics.' },
];

export default function ExperienceTab({ settings, setSettings }) {
    const { refreshAccountData } = useAuth();
    const [selected, setSelected] = useState(getExperienceMode(settings));
    const [status, setStatus] = useState('');

    async function save() {
        setStatus('Saving…');
        try {
            await apiPost('/settings', { experience_mode: selected });
            setSettings(current => ({ ...current, experience_mode: selected }));
            await refreshAccountData();
            setStatus('Saved. Your navigation and dashboard have been updated.');
        } catch (error) {
            setStatus(error.message || 'Could not save the experience.');
        }
    }

    return <div className="card glass" style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Choose Your Experience</h2>
        <p className="muted">This changes what Lumière shows—not your data. You can switch back at any time.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, margin: '22px 0' }}>
            {OPTIONS.map(option => <button key={option.id} onClick={() => setSelected(option.id)} style={{ textAlign: 'left', padding: 20, borderRadius: 16, cursor: 'pointer', color: 'white', background: selected === option.id ? 'rgba(76,125,255,.18)' : 'rgba(255,255,255,.03)', border: `1px solid ${selected === option.id ? 'var(--accent)' : 'rgba(255,255,255,.1)'}` }}>
                <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>{option.title}</div>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{option.text}</div>
            </button>)}
        </div>
        <button className="btn primary" onClick={save}>Save Experience</button>
        {status && <p className="muted" style={{ marginBottom: 0 }}>{status}</p>}
    </div>;
}
