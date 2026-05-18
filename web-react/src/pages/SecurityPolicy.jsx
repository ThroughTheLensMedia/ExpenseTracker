import React from 'react';
import { NavLink } from 'react-router-dom';

const S = ({ num, title }) => (
    <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
        {num}. {title}
    </h2>
);

const Row = ({ label, value }) => (
    <div style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ minWidth: '180px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{label}</span>
        <span style={{ fontSize: '14px' }}>{value}</span>
    </div>
);

export default function SecurityPolicy() {
    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', color: 'white', lineHeight: '1.7' }}>
            <NavLink to="/StudioControlCenter?tab=help" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 800, fontSize: '14px' }}>
                ← BACK TO DOCUMENTATION
            </NavLink>

            <div style={{ marginTop: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '6px' }}>Information Security Policy</h1>
                <p className="muted" style={{ fontWeight: 600 }}>Through The Lens Media — Lumière Ledger Platform</p>
            </div>

            {/* Meta */}
            <div style={{ marginTop: '32px', padding: '20px 24px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: '10px' }}>
                <Row label="Version" value="2.0" />
                <Row label="Effective Date" value="May 18, 2026" />
                <Row label="Classification" value="Confidential — Compliance Use" />
                <Row label="Owner" value="Joshua Deuermeyer, Owner & Developer" />
                <Row label="Contact" value="joshua.deuermeyer@gmail.com" />
                <Row label="Platform" value="www.lumiereledger.com" />
            </div>

            {/* 1 */}
            <section style={{ marginTop: '40px' }}>
                <S num="1" title="Purpose and Scope" />
                <p>This Information Security Policy (ISP) establishes the security framework, controls, and responsibilities for Through The Lens Media (TTLM) and its Lumière Ledger financial management platform. It governs the confidentiality, integrity, and availability of all data processed, stored, or transmitted by TTLM systems.</p>
                <p style={{ marginTop: '12px' }}>Lumière Ledger is a SaaS-based financial management application for freelance photographers and creative professionals. The platform processes financial transaction data and, via Plaid, facilitates secure bank account connectivity using OAuth-based token exchange. At no point does the platform store end-user banking credentials.</p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                        'The Lumière Ledger web application hosted on Vercel (www.lumiereledger.com)',
                        'The Express.js REST API backend',
                        'The Supabase PostgreSQL database and file storage',
                        'All Plaid API integrations and financial data handling',
                        'Cloud service providers and third-party vendors',
                        'All development, staging, and production environments',
                    ].map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </section>

            {/* 2 */}
            <section style={{ marginTop: '40px' }}>
                <S num="2" title="Organizational Security — Governance" />
                <p>Through The Lens Media is a sole-proprietor business. All information security responsibilities are owned and executed by Joshua Deuermeyer, who serves as de facto Chief Security Officer, Data Protection Officer, and Incident Response Lead.</p>
                <p style={{ marginTop: '12px' }}>Security policies are operationalized through automated controls embedded in the application architecture: Supabase Row-Level Security (RLS) policies, JWT-based API authentication, HTTPS-only transport, and Vercel's managed infrastructure security. Manual controls include regular dependency audits, access reviews, and periodic policy review.</p>
            </section>

            {/* 3 */}
            <section style={{ marginTop: '40px' }}>
                <S num="3" title="Access Control and Identity Management" />
                <p>All user authentication is managed by Supabase Auth, implementing email/password authentication and Google OAuth 2.0. Passwords are never stored in plaintext — Supabase uses bcrypt hashing. Session tokens are JWT-based with automatic refresh.</p>
                <p style={{ marginTop: '12px' }}><strong>Every API endpoint requires a valid JWT</strong> validated via JWKS on every request. Role-based access control (RBAC) is enforced via a <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '13px' }}>user_roles</code> table.</p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>Row-Level Security (RLS) enforced on all tables — every row filtered by <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '13px' }}>user_id = auth.uid()</code></li>
                    <li>The Supabase service role key is stored exclusively as a server-side environment variable — never exposed to clients</li>
                    <li>All destructive operations include a secondary <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '13px' }}>.eq('user_id', req.user.id)</code> filter beyond RLS</li>
                    <li>Production environment variables stored in Vercel's encrypted secret store</li>
                    <li>Supabase and Vercel dashboard access protected by MFA-enabled Google account</li>
                </ul>
            </section>

            {/* 4 */}
            <section style={{ marginTop: '40px' }}>
                <S num="4" title="Data Classification and Handling" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    {[
                        { tier: 'Restricted', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', examples: 'Plaid access tokens, encryption keys, API secrets', controls: 'Encrypted at rest (libsodium), server-side only, never logged' },
                        { tier: 'Confidential', color: '#f97316', bg: 'rgba(249,115,22,0.08)', examples: 'Financial transactions, receipts, user PII, bank account metadata', controls: 'RLS-enforced DB access, signed URLs for files, HTTPS only' },
                        { tier: 'Internal', color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', examples: 'Application logs, error messages', controls: 'Access-controlled, no PII in logs, 90-day retention' },
                        { tier: 'Public', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', examples: 'Marketing content, product documentation', controls: 'No special controls required' },
                    ].map(({ tier, color, bg, examples, controls }) => (
                        <div key={tier} style={{ padding: '14px 18px', background: bg, border: `1px solid ${color}40`, borderRadius: '8px' }}>
                            <div style={{ fontWeight: 800, color, fontSize: '13px', marginBottom: '4px' }}>{tier.toUpperCase()}</div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Examples:</strong> {examples}</div>
                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}><strong>Controls:</strong> {controls}</div>
                        </div>
                    ))}
                </div>
                <p style={{ marginTop: '16px' }}><strong>Plaid data handling:</strong> Bank credentials are never seen, stored, or transmitted by TTLM — Plaid handles credential collection via their hosted Link UI. Plaid access tokens are stored encrypted using libsodium (XSalsa20-Poly1305). Only minimum required Plaid product scopes are requested.</p>
            </section>

            {/* 5 */}
            <section style={{ marginTop: '40px' }}>
                <S num="5" title="Encryption" />
                <p><strong>In transit:</strong> All communication is enforced over TLS 1.2+ (HTTPS). HTTP requests are automatically redirected to HTTPS by Vercel. Certificates managed via Let's Encrypt with automatic renewal.</p>
                <p style={{ marginTop: '10px' }}><strong>At rest:</strong> Supabase (PostgreSQL) encrypts all data at rest using AES-256 at the storage layer. Plaid access tokens are additionally encrypted at the application layer using libsodium before database storage. Environment variables are encrypted at rest in Vercel's secret store.</p>
                <p style={{ marginTop: '10px' }}><strong>Key management:</strong> Encryption keys are stored as environment variables in Vercel's encrypted secret store. Keys are never committed to source code, logged, or included in error messages. Rotation policy: immediate upon suspected compromise; annual scheduled rotation.</p>
            </section>

            {/* 6 */}
            <section style={{ marginTop: '40px' }}>
                <S num="6" title="Network and Application Security" />
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>Hosted on Vercel (SOC 2 Type II). Database on Supabase (SOC 2 Type II). No self-managed servers</li>
                    <li>Input validation enforced on all API endpoints using Zod schema validation</li>
                    <li>SQL injection prevented by Supabase's parameterized query interface</li>
                    <li>CORS policy restricts API access to authorized origins only</li>
                    <li>npm audit runs on every deployment — critical vulnerabilities remediated within 7 days</li>
                    <li>GitHub secrets scanning enabled to prevent accidental credential commits</li>
                </ul>
            </section>

            {/* 7 */}
            <section style={{ marginTop: '40px' }}>
                <S num="7" title="Third-Party and Vendor Risk Management" />
                <p>All third-party vendors are evaluated for SOC 2 or equivalent compliance certifications prior to integration. Data sharing is limited to the minimum necessary for service delivery.</p>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                        ['Vercel', 'Application hosting', 'SOC 2 Type II'],
                        ['Supabase', 'Database, Auth, Storage', 'SOC 2 Type II'],
                        ['Plaid', 'Bank account connectivity', 'SOC 2 Type II, PCI DSS'],
                        ['Resend', 'Transactional email', 'SOC 2 Type II'],
                        ['Google Cloud', 'OAuth, Maps API', 'ISO 27001, SOC 2'],
                        ['GitHub', 'Source code', 'SOC 2 Type II'],
                    ].map(([vendor, purpose, certs]) => (
                        <div key={vendor} style={{ display: 'flex', gap: '12px', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', fontSize: '14px' }}>
                            <span style={{ minWidth: '90px', fontWeight: 700 }}>{vendor}</span>
                            <span style={{ minWidth: '200px', color: 'rgba(255,255,255,0.6)' }}>{purpose}</span>
                            <span style={{ color: '#4ade80', fontSize: '13px' }}>{certs}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* 8 */}
            <section style={{ marginTop: '40px' }}>
                <S num="8" title="Incident Response" />
                <p>Incidents are classified by severity with defined response times:</p>
                <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li><strong>Critical</strong> (data breach, unauthorized access, Plaid token exposure) — response within 1 hour</li>
                    <li><strong>High</strong> (service outage, auth failure, injection attempt) — within 4 hours</li>
                    <li><strong>Medium</strong> (elevated error rates, suspicious patterns) — within 24 hours</li>
                    <li><strong>Low</strong> (policy violations, non-critical vulnerabilities) — within 7 days</li>
                </ul>
                <p style={{ marginTop: '12px' }}>Affected users are notified within 72 hours of a confirmed breach. Plaid is notified per integration agreement. All incidents are documented with a post-incident report covering timeline, impact, root cause, and corrective actions.</p>
            </section>

            {/* 9 */}
            <section style={{ marginTop: '40px' }}>
                <S num="9" title="Business Continuity and Availability" />
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>External health monitoring via UptimeRobot — pings <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '13px' }}>/api/health</code> every 5 minutes</li>
                    <li>Application deployed across Vercel's global edge network — no single point of failure</li>
                    <li>Supabase point-in-time recovery (PITR) — database RTO &lt; 1 hour, RPO &lt; 24 hours</li>
                    <li>Complete environment can be rebuilt from source code within 2 hours</li>
                </ul>
            </section>

            {/* 10 */}
            <section style={{ marginTop: '40px' }}>
                <S num="10" title="Physical and Environmental Security" />
                <p>Through The Lens Media operates as a fully remote, cloud-native business. No on-premises servers or network infrastructure are maintained. All computing infrastructure is hosted by SOC 2-certified cloud providers. Development is performed on a macOS workstation protected by FileVault full-disk encryption with automatic screen lock. No production data is stored locally.</p>
            </section>

            {/* 11 */}
            <section style={{ marginTop: '40px' }}>
                <S num="11" title="Policy Review" />
                <p>This policy is reviewed annually or upon any of the following: a security incident, a material change in architecture, a new regulatory requirement, or activation of a new third-party integration. All reviews are performed by Joshua Deuermeyer.</p>
            </section>

            {/* Footer */}
            <div style={{ marginTop: '60px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <span className="muted" style={{ fontSize: '13px' }}>Through The Lens Media · Information Security Policy v2.0 · Effective May 18, 2026</span>
                <a href="/docs/Information_Security_Policy_TTLM.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Download PDF ↗</a>
            </div>

            <div style={{ height: '60px' }} />
        </div>
    );
}
