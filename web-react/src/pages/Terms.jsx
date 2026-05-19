import React from 'react';
import { NavLink } from 'react-router-dom';

const S = {
  page:    { maxWidth: '860px', margin: '40px auto', padding: '0 24px 80px', color: 'white', lineHeight: 1.7 },
  back:    { color: 'var(--accent)', textDecoration: 'none', fontWeight: 800, fontSize: '14px' },
  h1:      { fontSize: '2.4rem', fontWeight: 950, marginBottom: '8px', marginTop: '40px' },
  sub:     { color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: '14px', marginBottom: '40px' },
  h2:      { color: 'var(--accent)', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase',
             letterSpacing: '0.06em', marginTop: '40px', marginBottom: '10px' },
  p:       { marginBottom: '14px', color: 'rgba(255,255,255,0.82)', fontSize: '15px' },
  ul:      { paddingLeft: '20px', marginBottom: '14px', color: 'rgba(255,255,255,0.82)', fontSize: '15px' },
  li:      { marginBottom: '6px' },
  divider: { borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '50px', paddingTop: '20px',
             color: 'rgba(255,255,255,0.28)', fontSize: '12px', textAlign: 'center' },
  box:     { background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
             borderRadius: '10px', padding: '16px 20px', marginBottom: '20px',
             color: 'rgba(255,255,255,0.82)', fontSize: '14px', lineHeight: 1.65 },
};

export default function Terms() {
  return (
    <div style={S.page}>
      <NavLink to="/login" style={S.back}>← BACK TO LOGIN</NavLink>

      <h1 style={S.h1}>Terms of Service</h1>
      <p style={S.sub}>Effective Date: May 19, 2026 &nbsp;·&nbsp; Through The Lens Media, Inc &nbsp;·&nbsp; Last Updated: May 19, 2026</p>

      <div style={S.box}>
        <strong>IMPORTANT — PLEASE READ CAREFULLY.</strong> These Terms of Service contain a binding arbitration clause and class action waiver (Section 19) that affect your legal rights. By using Lumière Ledger you agree to resolve disputes through individual arbitration rather than in court.
      </div>

      {/* 1 */}
      <h2 style={S.h2}>1. Acceptance of Terms</h2>
      <p style={S.p}>
        These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and Through The Lens Media, Inc, a Tennessee corporation ("Company," "we," "us," or "our"), governing your access to and use of Lumière Ledger, available at lumiereledger.com, including all associated software, features, APIs, and content (collectively, the "Service").
      </p>
      <p style={S.p}>
        By creating an account, clicking any "I Agree" or "Sign Up" button, or otherwise accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy, which is incorporated by reference. If you do not agree, you may not use the Service.
      </p>

      {/* 2 */}
      <h2 style={S.h2}>2. Eligibility</h2>
      <p style={S.p}>To use the Service, you must:</p>
      <ul style={S.ul}>
        <li style={S.li}>Be at least 18 years of age;</li>
        <li style={S.li}>Be a legal resident or entity organized and operating in the United States;</li>
        <li style={S.li}>Have the legal capacity to enter into a binding contract;</li>
        <li style={S.li}>Not be prohibited from using the Service under applicable U.S. law or regulation;</li>
        <li style={S.li}>Not have had a prior account terminated for violation of these Terms.</li>
      </ul>
      <p style={S.p}>
        The Service is intended for business and professional use only. By using Lumière Ledger, you represent that you are using it in connection with a legitimate business, freelance operation, or professional practice, and not solely for personal or consumer purposes.
      </p>

      {/* 3 */}
      <h2 style={S.h2}>3. Description of Service</h2>
      <p style={S.p}>
        Lumière Ledger is a cloud-based business financial management platform that provides expense tracking, transaction management, invoicing, CRM, mileage logging, asset depreciation tracking, AI-assisted financial analysis, and bank account connectivity. The Service is provided "as a platform" and does not constitute accounting, tax preparation, legal, or financial advisory services.
      </p>
      <p style={S.p}>
        Features vary by subscription plan and may change at any time. We reserve the right to add, modify, suspend, or discontinue any feature with or without notice.
      </p>

      {/* 4 */}
      <h2 style={S.h2}>4. Account Registration &amp; Security</h2>
      <p style={S.p}>
        You must register for an account to access the Service. You agree to provide accurate, current, and complete information and to keep your account information updated. You are solely responsible for maintaining the confidentiality of your password and for all activity that occurs under your account.
      </p>
      <p style={S.p}>
        You agree to notify us immediately at <a href="mailto:support@throughthelens.media" style={{ color: 'var(--accent)' }}>support@throughthelens.media</a> of any unauthorized access to your account. We are not liable for any loss or damage arising from your failure to protect your credentials.
      </p>
      <p style={S.p}>
        One account per individual or business entity. You may not share, sell, transfer, or sublicense your account access to any third party.
      </p>

      {/* 5 */}
      <h2 style={S.h2}>5. Subscription Plans &amp; Billing</h2>
      <p style={S.p}>
        Lumière Ledger offers the following subscription tiers:
      </p>
      <ul style={S.ul}>
        <li style={S.li}><strong>Core (Free):</strong> Limited feature access at no charge. No credit card required.</li>
        <li style={S.li}><strong>Pro ($19.00/month):</strong> Full platform access, advanced reporting, and priority features.</li>
        <li style={S.li}><strong>Studio ($49.00/month):</strong> All Pro features plus enterprise-level tools and integrations.</li>
      </ul>
      <p style={S.p}>
        Paid subscriptions are billed monthly in advance via Stripe. By providing a payment method, you authorize us to charge you on a recurring basis on your billing cycle date. All prices are in U.S. dollars. Applicable taxes may be added.
      </p>
      <p style={S.p}>
        <strong>Auto-Renewal:</strong> Subscriptions automatically renew at the end of each billing period. You must cancel prior to your renewal date to avoid being charged for the next period.
      </p>
      <p style={S.p}>
        <strong>Price Changes:</strong> We reserve the right to change subscription pricing. We will provide at least 30 days' notice of any price increase via email or in-app notification. Continued use after the effective date of a price change constitutes your acceptance of the new price.
      </p>

      {/* 6 */}
      <h2 style={S.h2}>6. Refund Policy</h2>
      <p style={S.p}>
        <strong>Lumière Ledger Subscriptions:</strong> If you are not satisfied with your paid subscription, you may request a full refund within 30 days of your first payment for that subscription tier. Refund requests must be submitted to <a href="mailto:support@throughthelens.media" style={{ color: 'var(--accent)' }}>support@throughthelens.media</a>. After the 30-day window, all subscription fees are non-refundable.
      </p>
      <p style={S.p}>
        <strong>Plaid Live Bank Sync Fees — No Refunds:</strong> Fees associated with the Plaid Live Bank Sync feature ($0.50 per connected account per month) are strictly non-refundable once billed. These fees are passed through from our third-party banking data provider and cannot be reversed regardless of use, account disconnection, or cancellation timing.
      </p>
      <p style={S.p}>
        Refunds, if approved, are processed to the original payment method within 5–10 business days.
      </p>

      {/* 7 */}
      <h2 style={S.h2}>7. Cancellation</h2>
      <p style={S.p}>
        You may cancel your paid subscription at any time through the Ledger Control Center within the app, or by contacting <a href="mailto:support@throughthelens.media" style={{ color: 'var(--accent)' }}>support@throughthelens.media</a>. Cancellation takes effect at the end of your current billing period. You retain access to paid features through the end of the paid period. No partial refunds are issued for mid-cycle cancellations outside the 30-day guarantee window.
      </p>
      <p style={S.p}>
        Upon cancellation, your data is retained for 90 days, after which it may be permanently deleted. You are responsible for exporting any data you wish to retain before cancellation takes full effect.
      </p>

      {/* 8 */}
      <h2 style={S.h2}>8. Plaid Live Bank Sync</h2>
      <p style={S.p}>
        The Live Bank Sync feature is powered by Plaid Inc. ("Plaid"). By connecting a bank account, you authorize the Company and Plaid to access your financial institution account data in accordance with Plaid's End User Privacy Policy (available at <a href="https://plaid.com/legal" style={{ color: 'var(--accent)' }} target="_blank" rel="noreferrer">plaid.com/legal</a>).
      </p>
      <p style={S.p}>
        Each connected bank account incurs a fee of <strong>$0.50 per account per month</strong>, billed automatically alongside your subscription. By connecting an account, you expressly authorize this charge.
      </p>
      <p style={S.p}>
        You may disconnect a bank account at any time from the Accounts page. Disconnecting an account stops future Plaid sync fees but does not entitle you to a refund of fees already billed. Existing imported transactions remain in your ledger after disconnection.
      </p>
      <p style={S.p}>
        We are not responsible for inaccuracies, delays, or errors in data provided by Plaid or your financial institution. Bank connectivity is provided as a convenience feature and does not constitute a complete or authoritative record of your financial accounts.
      </p>

      {/* 9 */}
      <h2 style={S.h2}>9. AI Features &amp; Bring Your Own Key</h2>
      <p style={S.p}>
        Lumière Ledger offers AI-assisted financial analysis powered by Google Gemini ("AI Features"). These features operate on a Bring Your Own Key ("BYOB") model — you must provide your own Google Gemini API key to activate them. Your key is stored securely and used exclusively to process your own data. It is never shared with other users or used for Company purposes.
      </p>
      <p style={S.p}>
        <strong>AI Disclaimer:</strong> AI Features are provided for organizational and informational purposes only. Outputs generated by the AI — including categorizations, summaries, expense analysis, and financial projections — do not constitute tax advice, accounting advice, legal advice, or financial advice of any kind. You are solely responsible for verifying the accuracy of all AI-generated content before relying on it for any business, tax, or financial decision.
      </p>
      <p style={S.p}>
        AI model availability and behavior are subject to change by Google. We make no warranty regarding the accuracy, completeness, or reliability of AI-generated outputs.
      </p>

      {/* 10 */}
      <h2 style={S.h2}>10. Financial &amp; Tax Disclaimer</h2>
      <p style={S.p}>
        Lumière Ledger is a financial organization and record-keeping tool. We are not a registered investment advisor, broker-dealer, certified public accountant (CPA), tax preparer, or attorney. Nothing in the Service constitutes financial advice, tax advice, investment advice, or legal advice.
      </p>
      <p style={S.p}>
        You acknowledge that the Service is designed to assist with record-keeping and organization only. All financial data, categorizations, tax flags, expense reports, and projections generated by the Service should be independently reviewed by a qualified professional before use in any official tax filing, financial statement, or legal proceeding. We are not liable for any tax penalties, fines, audit findings, or financial losses arising from your reliance on the Service's output.
      </p>

      {/* 11 */}
      <h2 style={S.h2}>11. Third-Party Services</h2>
      <p style={S.p}>
        The Service integrates with or relies upon the following third-party providers, each governed by their own terms and privacy policies:
      </p>
      <ul style={S.ul}>
        <li style={S.li}><strong>Stripe, Inc.</strong> — Payment processing. By paying for the Service, you agree to Stripe's Terms of Service.</li>
        <li style={S.li}><strong>Plaid Inc.</strong> — Bank account connectivity. Subject to Plaid's End User Privacy Policy.</li>
        <li style={S.li}><strong>Google LLC (Gemini API)</strong> — AI features. Subject to Google's Terms of Service and API usage policies.</li>
        <li style={S.li}><strong>Google LLC (Maps API)</strong> — Mileage and location features. Subject to Google Maps Platform Terms of Service.</li>
        <li style={S.li}><strong>Supabase, Inc.</strong> — Database, authentication, and file storage. Subject to Supabase's Terms of Service.</li>
        <li style={S.li}><strong>Resend, Inc.</strong> — Transactional email delivery. Subject to Resend's Terms of Service.</li>
      </ul>
      <p style={S.p}>
        We are not responsible for the availability, accuracy, or conduct of any third-party service. Disruptions to third-party services may affect Service functionality and do not entitle you to a refund or credit.
      </p>

      {/* 12 */}
      <h2 style={S.h2}>12. User Data &amp; Data Ownership</h2>
      <p style={S.p}>
        You retain full ownership of all data you enter into the Service, including financial records, transaction data, client information, invoices, receipts, and business information ("User Data"). We do not claim any ownership rights over your User Data.
      </p>
      <p style={S.p}>
        You grant us a limited, non-exclusive, worldwide, royalty-free license to store, process, transmit, and display your User Data solely for the purpose of providing the Service to you. We do not sell, rent, or share your User Data with third parties for advertising or marketing purposes.
      </p>
      <p style={S.p}>
        You are responsible for ensuring that any data you upload or enter does not violate the rights of any third party, including copyright, privacy, or confidentiality rights.
      </p>

      {/* 13 */}
      <h2 style={S.h2}>13. Receipt &amp; File Storage</h2>
      <p style={S.p}>
        The Service allows you to upload receipt images and other files. Storage is subject to plan limits. We reserve the right to impose storage quotas and to delete files associated with inactive or cancelled accounts after the data retention period described in Section 7.
      </p>
      <p style={S.p}>
        You are solely responsible for maintaining your own backup copies of any files uploaded to the Service. We are not liable for loss of uploaded files due to technical failures, accidental deletion, or account termination.
      </p>

      {/* 14 */}
      <h2 style={S.h2}>14. Invoicing Features</h2>
      <p style={S.p}>
        The Service provides tools to create, send, and manage invoices ("Invoicing Features"). You are solely responsible for the accuracy, legality, and completeness of all invoices you create and send using the Service. We are not a party to any transaction between you and your clients. Any disputes arising from invoices sent via the Service are solely between you and your client.
      </p>
      <p style={S.p}>
        You agree not to use Invoicing Features to issue fraudulent, deceptive, or legally non-compliant invoices. Misuse of Invoicing Features may result in immediate account termination.
      </p>

      {/* 15 */}
      <h2 style={S.h2}>15. Acceptable Use</h2>
      <p style={S.p}>You agree not to use the Service to:</p>
      <ul style={S.ul}>
        <li style={S.li}>Engage in any unlawful activity, including financial fraud, money laundering, or tax evasion;</li>
        <li style={S.li}>Upload or transmit malicious code, viruses, or any software intended to harm the Service or other users;</li>
        <li style={S.li}>Attempt to gain unauthorized access to any part of the Service, servers, or databases;</li>
        <li style={S.li}>Reverse engineer, decompile, or disassemble any part of the Service;</li>
        <li style={S.li}>Resell, sublicense, or commercially exploit the Service without written authorization;</li>
        <li style={S.li}>Impersonate any person or entity or falsely represent your affiliation with any person or entity;</li>
        <li style={S.li}>Use automated bots, scrapers, or data mining tools against the Service;</li>
        <li style={S.li}>Interfere with or disrupt the integrity or performance of the Service.</li>
      </ul>
      <p style={S.p}>
        We reserve the right to investigate and take appropriate action against any violation of this section, including suspending or terminating your account and reporting conduct to law enforcement.
      </p>

      {/* 16 */}
      <h2 style={S.h2}>16. Intellectual Property</h2>
      <p style={S.p}>
        The Service and all of its components — including but not limited to software code, interface design, graphics, logos, trademarks, and written content — are the exclusive property of Through The Lens Media, Inc and are protected by U.S. copyright, trademark, and other applicable intellectual property laws. The "Lumière Ledger" name and logo are trademarks of Through The Lens Media, Inc.
      </p>
      <p style={S.p}>
        You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your own business purposes in accordance with these Terms. No rights are granted beyond what is expressly stated here.
      </p>

      {/* 17 */}
      <h2 style={S.h2}>17. Disclaimer of Warranties</h2>
      <p style={S.p}>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS, THAT DATA WILL BE ACCURATE OR COMPLETE, OR THAT ANY ERRORS WILL BE CORRECTED.
      </p>
      <p style={S.p}>
        YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK. Some jurisdictions do not allow the exclusion of certain warranties, so some of the above exclusions may not apply to you.
      </p>

      {/* 18 */}
      <h2 style={S.h2}>18. Limitation of Liability</h2>
      <p style={S.p}>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THROUGH THE LENS MEDIA, INC, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p style={S.p}>
        OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100.00).
      </p>
      <p style={S.p}>
        The limitations in this section apply whether the claimed liability is based on contract, tort, negligence, strict liability, or any other legal theory, and whether or not we have been advised of the possibility of such damage.
      </p>

      {/* 19 */}
      <h2 style={S.h2}>19. Indemnification</h2>
      <p style={S.p}>
        You agree to defend, indemnify, and hold harmless Through The Lens Media, Inc and its officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party right, including intellectual property, privacy, or contractual rights; or (d) any content or data you submit, upload, or transmit through the Service.
      </p>

      {/* 20 */}
      <h2 style={S.h2}>20. Dispute Resolution &amp; Binding Arbitration</h2>
      <p style={S.p}>
        <strong>PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.</strong>
      </p>
      <p style={S.p}>
        <strong>Informal Resolution:</strong> Before initiating arbitration, you agree to contact us at <a href="mailto:support@throughthelens.media" style={{ color: 'var(--accent)' }}>support@throughthelens.media</a> and attempt to resolve the dispute informally for at least 30 days.
      </p>
      <p style={S.p}>
        <strong>Binding Arbitration:</strong> If informal resolution fails, any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by final and binding arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules, except as modified herein. The arbitration shall be conducted in Nashville, Tennessee (or remotely if agreed), and shall be governed by the Federal Arbitration Act. Judgment on the award rendered may be entered in any court of competent jurisdiction.
      </p>
      <p style={S.p}>
        <strong>Class Action Waiver:</strong> YOU AND THROUGH THE LENS MEDIA, INC EACH AGREE THAT ANY PROCEEDING SHALL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT AS PART OF A CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE ACTION. If a court finds this waiver unenforceable, the arbitration clause shall be void in its entirety.
      </p>
      <p style={S.p}>
        <strong>Small Claims Carve-Out:</strong> Either party may bring an individual claim in small claims court in lieu of arbitration, provided the claim qualifies and remains in small claims court.
      </p>
      <p style={S.p}>
        <strong>Exceptions:</strong> Nothing in this section prevents either party from seeking emergency injunctive relief in a court of competent jurisdiction to prevent irreparable harm pending arbitration.
      </p>

      {/* 21 */}
      <h2 style={S.h2}>21. Governing Law &amp; Venue</h2>
      <p style={S.p}>
        These Terms and any dispute arising hereunder shall be governed by and construed in accordance with the laws of the State of Tennessee, without regard to its conflict of law provisions. For any matters not subject to arbitration, you consent to the exclusive jurisdiction of the state and federal courts located in Tennessee.
      </p>

      {/* 22 */}
      <h2 style={S.h2}>22. Termination</h2>
      <p style={S.p}>
        We may suspend or terminate your account and access to the Service at any time, with or without notice, for any reason, including but not limited to: violation of these Terms, fraudulent activity, non-payment, or conduct harmful to other users or the Company.
      </p>
      <p style={S.p}>
        You may terminate your account at any time by cancelling your subscription and contacting us to request account deletion. Upon termination, your right to access the Service ceases immediately.
      </p>
      <p style={S.p}>
        Sections 10 (Financial Disclaimer), 12 (Data Ownership), 17 (Disclaimer of Warranties), 18 (Limitation of Liability), 19 (Indemnification), 20 (Dispute Resolution), and 21 (Governing Law) survive termination of these Terms.
      </p>

      {/* 23 */}
      <h2 style={S.h2}>23. Modifications to These Terms</h2>
      <p style={S.p}>
        We reserve the right to update or modify these Terms at any time. When we make material changes, we will notify you via email or a prominent in-app notice at least 14 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms. If you do not agree to the revised Terms, you must stop using the Service before the effective date.
      </p>

      {/* 24 */}
      <h2 style={S.h2}>24. Severability &amp; Entire Agreement</h2>
      <p style={S.p}>
        If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severable and shall not affect the validity and enforceability of the remaining provisions. These Terms, together with our Privacy Policy, constitute the entire agreement between you and Through The Lens Media, Inc regarding the Service and supersede all prior agreements, representations, or understandings.
      </p>

      {/* 25 */}
      <h2 style={S.h2}>25. Contact</h2>
      <p style={S.p}>
        For questions about these Terms, billing, data requests, or account matters, contact us at:
      </p>
      <p style={S.p}>
        <strong>Through The Lens Media, Inc</strong><br />
        <a href="mailto:support@throughthelens.media" style={{ color: 'var(--accent)' }}>support@throughthelens.media</a>
      </p>

      <div style={S.divider}>
        LUMIÈRE LEDGER &nbsp;·&nbsp; THROUGH THE LENS MEDIA, INC &nbsp;·&nbsp; © 2026 &nbsp;·&nbsp; TENNESSEE, USA
      </div>
    </div>
  );
}
