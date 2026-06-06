import React from 'react';
import * as Sentry from '@sentry/react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        Sentry.captureException(error, {
            contexts: { react: { componentStack: info.componentStack } },
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: '100vh',
                    background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif',
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px', padding: '48px', textAlign: 'center', maxWidth: '480px',
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⚠️</div>
                        <h2 style={{ margin: '0 0 12px', fontWeight: 900 }}>Something went wrong</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 24px', fontSize: '14px' }}>
                            An unexpected error occurred. The team has been notified.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: '#f59e0b', color: '#0f172a', border: 'none',
                                borderRadius: '8px', padding: '12px 28px', fontWeight: 900,
                                fontSize: '14px', cursor: 'pointer',
                            }}
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
