import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Terms() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', color: 'white', lineHeight: '1.6' }}>
      <NavLink to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 800, fontSize: '14px' }}>← BACK TO STUDIO LOGIN</NavLink>
      
      <div style={{ marginTop: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '10px' }}>Terms of Service</h1>
        <p className="muted" style={{ fontWeight: 600 }}>Last Updated: March 16, 2026</p>
      </div>

      <section style={{ marginTop: '40px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Acceptance of Terms</h2>
        <p>By accessing or using Studio Tracker, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Subscription and Access</h2>
        <p>Studio Tracker is a professional SaaS tool. Access is granted via invitation codes or paid subscriptions. You are responsible for maintaining the confidentiality of your account credentials.</p>
        <ul>
          <li><strong>Beta Testing:</strong> Beta users are granted temporary access and are encouraged to provide feedback.</li>
          <li><strong>License Lifecycle:</strong> Licenses (Annual, Pro, Monthly) are subject to expiration based on the assigned plan type.</li>
        </ul>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. User Data & Ownership</h2>
        <p>You retain full ownership of all financial data, leads, and assets entered into Studio Tracker. We provide the platform to process and visualize this data, but we do not claim ownership of it.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Prohibited Use</h2>
        <p>You agree not to use Studio Tracker for any illegal activities, including financial fraud. Any misuse of the platform may result in immediate suspension or revocation of your access.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Limitation of Liability</h2>
        <p>Studio Tracker is a tool for financial organization. While we strive for 100% accuracy, we are not responsible for tax filing errors, missing data, or financial decisions made based on the app's output. Consult with a qualified tax professional for official filings.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. Significant changes will be announced via the "System Intelligence Update Log" within the app.</p>
      </section>

      <div className="muted" style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', textAlign: 'center' }}>
        STUDIO TRACKER © 2026 • ELITE FINANCIAL INTELLIGENCE
      </div>
    </div>
  );
}
