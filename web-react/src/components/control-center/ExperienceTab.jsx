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

    return (
        <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="experience-heading">
            <div style={{ maxWidth: 720 }}>
                <h2 id="experience-heading" style={{ margin: 0, fontSize: 20 }}>Choose your experience</h2>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                    Choose the workspace that fits how you use Lumière. Your records stay intact, and you can switch back at any time.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14, margin: '22px 0' }}>
                {OPTIONS.map(option => {
                    const isSelected = selected === option.id;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelected(option.id)}
                            style={{
                                minHeight: 150,
                                padding: 'clamp(16px, 3vw, 20px)',
                                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                                borderRadius: 16,
                                background: isSelected ? 'rgba(76,125,255,.18)' : 'rgba(255,255,255,.03)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background-color .18s ease, border-color .18s ease',
                            }}
                        >
                            <span style={{ display: 'block', marginBottom: 8, fontSize: 17, fontWeight: 900 }}>{option.title}</span>
                            <span className="muted" style={{ display: 'block', fontSize: 14, lineHeight: 1.55 }}>{option.text}</span>
                        </button>
                    );
                })}
            </div>

            <div className="controls" style={{ alignItems: 'center' }}>
                <button type="button" className="btn primary" onClick={save}>Save experience</button>
                {status && <span className="muted" role="status" aria-live="polite" style={{ fontSize: 13 }}>{status}</span>}
            </div>
        </section>
    );
}
