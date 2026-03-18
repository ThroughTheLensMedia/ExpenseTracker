import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Privacy() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', color: 'white', lineHeight: '1.6' }}>
      <NavLink to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 800, fontSize: '14px' }}>← BACK TO STUDIO LOGIN</NavLink>
      
      <div style={{ marginTop: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '10px' }}>Privacy Policy</h1>
        <p className="muted" style={{ fontWeight: 600 }}>Last Updated: March 16, 2026</p>
      </div>

      <section style={{ marginTop: '40px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Introduction</h2>
        <p>Welcome to Studio Tracker. We are committed to protecting your privacy and providing a secure environment for photographers and creative professionals to manage their studio's financial health.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Information We Collect</h2>
        <p>To provide our services, we collect limited information including:</p>
        <ul>
          <li><strong>Identity Data:</strong> Name and email address when you sign up or use Google Sign-In.</li>
          <li><strong>Financial Data:</strong> Transactions, expenses, and income data that you manually enter or import via CSV/Bank Link.</li>
          <li><strong>Usage Data:</strong> Telemetry data (Activity Pulse) to track engagement and improve platform performance.</li>
        </ul>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. How We Use Google Data</h2>
        <p>If you choose to use <strong>Google Sign-In</strong>, we request access to your basic profile information (email and name). We use this data strictly to:</p>
        <ul>
          <li>Create and authenticate your Studio Tracker account.</li>
          <li>Synchronize your display name across the studio dashboard.</li>
          <li>Communicate essential system updates or license expiration alerts.</li>
        </ul>
        <p>We do not access your Google Drive, Contacts, or any other sensitive Google services.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Data Security</h2>
        <p>Your data is stored securely using industry-standard encryption provided by Supabase. We implement strict Row Level Security (RLS) to ensure that your financial data is accessible only to you.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Third-Party Sharing</h2>
        <p>Studio Tracker does not sell, rent, or trade your personal or financial data with third parties for marketing purposes. Data is only shared with essential service providers (like Supabase for database hosting and Vercel for application hosting) as necessary to operate the service.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Contact Us</h2>
        <p>If you have any questions regarding this privacy policy, please contact us at <strong>joshua.deuermeyer@gmail.com</strong>.</p>
      </section>

      <div className="muted" style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', textAlign: 'center' }}>
        STUDIO TRACKER © 2026 • ELITE FINANCIAL INTELLIGENCE
      </div>
    </div>
  );
}
