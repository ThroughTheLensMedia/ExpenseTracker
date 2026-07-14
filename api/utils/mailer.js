/**
 * Lumière Ledger Mailer Bridge
 * Connects the Expense Tracker to external transactional email services.
 * 
 * RECOMMENDED: Use Resend (resend.com) for high-delivery studio emails.
 * To enable: 
 * 1. npm install resend
 * 2. Add RESEND_API_KEY to your .env
 */

const { Resend } = require('resend');

let resendClient = null;
function getResend() {
    if (!resendClient && process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return resendClient;
}

async function sendInvoiceEmail({ to, subject, body, attachments, fromName, replyTo }) {
    console.log(`[MAILER] Preparing email to ${to}...`);
    console.log(`[MAILER] Subject: ${subject}`);

    const resend = getResend();
    if (!resend) {
        console.warn("[MAILER] Resend client not initialized. Email was NOT sent.");
        return { success: false, error: "Mailer service not configured" };
    }

    try {
        const baseDomainEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const matches = baseDomainEmail.match(/<([^>]+)>/);
        const emailOnly = matches ? matches[1] : baseDomainEmail;
        const fromEmail = fromName ? `${fromName} <${emailOnly}>` : baseDomainEmail;
        
        const payload = {
            from: fromEmail,
            to: [to],
            subject: subject,
            html: body
        };
        
        if (replyTo) {
            payload.reply_to = replyTo;
        }

        if (attachments && Array.isArray(attachments)) {
            payload.attachments = attachments.map(a => ({
                filename: a.filename || 'attachment.pdf',
                content: Buffer.from(a.content, 'base64')
            }));
        }

        const data = await resend.emails.send(payload);
        console.log("[MAILER] Email dispatched successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

const PLAN_LABELS = {
    lifetime:      'Lifetime Free Access',
    beta_tester:   '90-Day Beta Access',
    free_beta:     'Free Beta Access',
    free:          'Free Plan',
    sync_monthly:  'Sync Plan ($4.99/mo)',
    sync_annual:   'Sync Plan (Annual)',
    core_monthly:  'Core Plan ($9/mo)',
    core_annual:   'Core Plan (Annual)',
    studio_monthly:'Studio Plan ($19/mo)',
    studio_annual: 'Studio Plan (Annual)',
};

async function sendInviteEmail({ to, name, code, plan_type }) {
    console.log(`[MAILER] Sending Invite to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const signupUrl = `${process.env.APP_URL || 'https://www.lumiereledger.com'}/login?code=${code}&email=${encodeURIComponent(to)}`;
        const planLabel = PLAN_LABELS[plan_type] || '90-Day Beta Access';

        const html = `
            <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Inter', sans-serif; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin: 0;">LUMIÈRE LEDGER</h1>
                    <div style="height: 2px; width: 40px; background: #f97316; margin: 10px auto;"></div>
                </div>

                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">Hello ${name || 'there'},</p>

                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">
                    You've been personally invited to <strong>Lumière Ledger</strong> — the financial command center for freelancers and creative professionals.
                    Track expenses, manage invoices, automate taxes, and run your entire business from one place.
                </p>

                <div style="background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.3); padding: 16px 20px; border-radius: 10px; margin: 20px 0;">
                    <div style="font-size: 11px; font-weight: 900; color: #f97316; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Your Access Level</div>
                    <div style="font-size: 15px; font-weight: 800; color: white;">${planLabel}</div>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
                    <div style="font-size: 12px; font-weight: 900; color: #f97316; margin-bottom: 10px; text-transform: uppercase;">Your Personal Invite Code</div>
                    <div style="font-size: 32px; font-weight: 950; letter-spacing: 0.2em; color: white;">${code}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${signupUrl}" style="background-color: #f97316; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 900; display: inline-block; font-size: 14px;">ACTIVATE & CREATE ACCOUNT</a>
                </div>

                <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 40px;">
                    Questions? Reach us at <a href="mailto:support@throughthelens.media" style="color: #f97316;">support@throughthelens.media</a>
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: 'You\'re invited to Lumière Ledger',
            html: html
        });

        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Invite Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

async function sendDailyReportEmail({ to, activityRows }) {
    console.log(`[MAILER] Sending Daily Activity Report to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const rowsHtml = activityRows.map(r => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: white; font-weight: 600;">${r.email}</td>
                <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #4ade80; font-weight: 900; text-align: right;">${r.minutes_today} min</td>
                <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; font-size: 11px; text-align: right;">${new Date(r.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
        `).join('') || `<tr><td colspan="3" style="padding: 24px; text-align: center; color: #475569;">No activity recorded today.</td></tr>`;

        const html = `
            <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Inter', sans-serif; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 20px; font-weight: 900; letter-spacing: -0.02em; margin: 0;">STUDIO ACTIVITY REPORT</h1>
                    <div style="font-size: 12px; color: #f97316; font-weight: 800; margin-top: 5px; text-transform: uppercase;">${dateStr}</div>
                </div>

                <div style="background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.05);">
                                <th style="text-align: left; padding: 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">User</th>
                                <th style="text-align: right; padding: 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Engagement</th>
                                <th style="text-align: right; padding: 12px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Last Pulse</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>

                <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 30px;">
                    This is an automated production report from Lumière Ledger.
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: `📊 Studio Report: ${dateStr}`,
            html: html
        });

        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Report Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

async function sendPromoEmail({ to, subject }) {
    console.log(`[MAILER] Sending Promo Email to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const subjectLine = subject || '📸 Level Up Your Photography Business with Lumière Ledger';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0b1220; color: #e9eefc; }
                    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .logo { font-size: 28px; font-weight: 950; letter-spacing: -0.04em; color: #fff; text-transform: uppercase; }
                    .hero { background: linear-gradient(135deg, #1f4fd6 0%, #2f6bff 100%); border-radius: 24px; padding: 40px; text-align: center; margin-bottom: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
                    .hero h1 { font-size: 32px; font-weight: 900; margin: 0 0 16px 0; color: #fff; line-height: 1.1; }
                    .hero p { font-size: 18px; opacity: 0.9; margin: 0 0 24px 0; line-height: 1.5; }
                    .btn { display: inline-block; background: #fff; color: #1f4fd6; padding: 16px 32px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 16px; transition: transform 0.2s; }
                    .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                    .feature-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 18px; padding: 24px; }
                    .feature-card h3 { font-size: 16px; font-weight: 800; margin: 0 0 8px 0; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; }
                    .feature-card p { font-size: 14px; opacity: 0.7; margin: 0; line-height: 1.5; }
                    .testimonial { border-left: 4px solid #f7b955; padding-left: 20px; margin: 40px 0; font-style: italic; opacity: 0.8; }
                    .footer { text-align: center; font-size: 12px; opacity: 0.4; margin-top: 60px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">Through The Lens <span style="color: #2f6bff;">Media</span></div>
                    </div>
                    
                    <div class="hero">
                        <h1>Stop Tracking.<br/>Start Operating.</h1>
                        <p>The elite financial command center designed exclusively for photography studios.</p>
                        <a href="https://lumiereledger.com" class="btn">Experience Lumière Ledger</a>
                    </div>
                    
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h2 style="font-size: 24px; font-weight: 800;">Built for the High-End Pro</h2>
                        <p style="opacity: 0.6;">One dashboard to manage your entire business lifecycle.</p>
                    </div>

                    <div class="feature-grid">
                        <div class="feature-card">
                            <h3>Lead Pipeline</h3>
                            <p>Track leads from inquiry to booking with our visual CRM console.</p>
                        </div>
                        <div class="feature-card">
                            <h3>Gear Portfolio</h3>
                            <p>Automated depreciation tracking for your entire photography kit.</p>
                        </div>
                        <div class="feature-card">
                            <h3>Cash Flow</h3>
                            <p>Real-time revenue and expense analytics with PWA mobile snap.</p>
                        </div>
                        <div class="feature-card">
                            <h3>Smart Tax</h3>
                            <p>Automated classification rules that save you hours every month.</p>
                        </div>
                    </div>

                    <div class="testimonial">
                        "Lumière Ledger transformed how I view my business profitability. It's not just an expense tracker; it's a growth engine."
                    </div>
                    
                    <div style="background: rgba(47, 107, 255, 0.1); border-radius: 18px; padding: 30px; text-align: center;">
                        <h3 style="margin-top: 0;">Special Beta Access</h3>
                        <p style="font-size: 14px; opacity: 0.8;">Join the inner circle of photographers streamlining their operations.</p>
                        <a href="https://throughthelens.media/signup" style="color: #38bdf8; font-weight: 800; text-decoration: none;">Request Invitation &rarr;</a>
                    </div>

                    <div class="footer">
                        &copy; 2026 Through The Lens Media. All rights reserved.<br/>
                        Designed for elite photographers.
                    </div>
                </div>
            </body>
            </html>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: subjectLine,
            html: html
        });

        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Promo Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

async function sendContactRelayEmail({ senderName, senderEmail, messageContent }) {
    console.log(`[MAILER] Relaying inquiry from ${senderEmail} to Admin...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const adminEmail = 'joshua.deuermeyer@gmail.com';

        const escapeHtml = (unsafe) => {
            return (unsafe || '')
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeName = escapeHtml(senderName);
        const safeEmail = escapeHtml(senderEmail);
        const safeMessage = escapeHtml(messageContent);

        const html = `
            <div style="background-color: #0f172a; color: white; padding: 30px; font-family: sans-serif; border-radius: 12px; max-width: 600px;">
                <h2 style="color: #2f6bff; margin-top: 0;">New Inquiry from Facebook / Lumière Ledger</h2>
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>From:</strong> ${safeName || 'Anonymous'} (${safeEmail})</p>
                    <p style="white-space: pre-wrap; line-height: 1.6; color: #e9eefc;">${safeMessage}</p>
                </div>
                <div style="font-size: 12px; color: #64748b;">
                    This inquiry was relayed via Resend from support@throughthelens.media
                </div>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
            reply_to: senderEmail,
            subject: `📬 New Customer Inquiry: ${senderName || 'Inquiry'}`,
            html: html
        });

        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Relay Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * sendInvoiceApprovalEmail
 * Sent to the PHOTOGRAPHER when a client e-signs on the /pay/:token page.
 */
async function sendInvoiceApprovalEmail({
    to, studioName, clientName, clientEmail,
    invoiceNumber, eventName, totalCents, signedAt, customerSignature,
    paymentHandles, invoiceId
}) {
    console.log(`[MAILER] Sending approval notification for Invoice #${invoiceNumber} to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: 'Mailer service not configured' };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
        const appUrl = process.env.APP_URL || 'https://app.throughthelens.media';
        const totalDollars = (totalCents / 100).toFixed(2);
        const signedDate = new Date(signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const signedTime = new Date(signedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Build payment handles list
        const handles = [];
        if (paymentHandles?.venmo)   handles.push(`<strong>Venmo:</strong> ${paymentHandles.venmo}`);
        if (paymentHandles?.zelle)   handles.push(`<strong>Zelle:</strong> ${paymentHandles.zelle}`);
        if (paymentHandles?.cashapp) handles.push(`<strong>CashApp:</strong> ${paymentHandles.cashapp}`);
        const handlesHtml = handles.length > 0
            ? `<p style="margin:0 0 6px 0; font-size:13px; color:#64748b;">The client was shown these payment options:</p>
               <ul style="margin:0; padding-left:18px; font-size:13px; color:#334155; line-height:1.9;">${handles.map(h => `<li>${h}</li>`).join('')}</ul>`
            : `<p style="font-size:13px; color:#94a3b8; font-style:italic;">No payment handles configured — add them in Business Profile.</p>`;

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="font-size:22px; font-weight:900; letter-spacing:-0.02em; color:#fff;">LUMIÈRE LEDGER</div>
      <div style="height:2px; width:40px; background:#f97316; margin:10px auto 0;"></div>
    </div>

    <!-- Hero card -->
    <div style="background:linear-gradient(135deg,#1e293b,#0f172a); border:1px solid rgba(74,222,128,0.3); border-radius:16px; padding:32px; margin-bottom:24px; text-align:center;">
      <div style="font-size:40px; margin-bottom:12px;">🎉</div>
      <h1 style="margin:0 0 8px; font-size:22px; font-weight:900; color:#4ade80;">Payment Approval Received</h1>
      <p style="margin:0; font-size:15px; color:#94a3b8;"><strong style="color:#fff;">${clientName}</strong> has reviewed and e-signed Invoice #${invoiceNumber}.</p>
    </div>

    <!-- Invoice details -->
    <div style="background:#1e293b; border-radius:12px; padding:24px; margin-bottom:24px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:8px 0; color:#94a3b8; font-weight:600;">Invoice</td><td style="text-align:right; color:#fff; font-weight:800;">#${invoiceNumber}</td></tr>
        <tr><td style="padding:8px 0; border-top:1px solid rgba(255,255,255,0.06); color:#94a3b8; font-weight:600;">Client</td><td style="text-align:right; border-top:1px solid rgba(255,255,255,0.06); color:#fff;">${clientName}${clientEmail ? ` &lt;${clientEmail}&gt;` : ''}</td></tr>
        <tr><td style="padding:8px 0; border-top:1px solid rgba(255,255,255,0.06); color:#94a3b8; font-weight:600;">Amount</td><td style="text-align:right; border-top:1px solid rgba(255,255,255,0.06); color:#4ade80; font-weight:900; font-size:18px;">$${totalDollars}</td></tr>
        <tr><td style="padding:8px 0; border-top:1px solid rgba(255,255,255,0.06); color:#94a3b8; font-weight:600;">Approved</td><td style="text-align:right; border-top:1px solid rgba(255,255,255,0.06); color:#fff;">${signedDate} at ${signedTime}</td></tr>
        <tr><td style="padding:8px 0; border-top:1px solid rgba(255,255,255,0.06); color:#94a3b8; font-weight:600;">E-Signature</td><td style="text-align:right; border-top:1px solid rgba(255,255,255,0.06); color:#fff; font-style:italic;">&ldquo;${customerSignature}&rdquo;</td></tr>
      </table>
    </div>

    <!-- Payment handles -->
    <div style="background:#1e293b; border-radius:12px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; font-weight:900; color:#f97316; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Payment Options Shown to Client</div>
      ${handlesHtml}
    </div>

    <!-- What to do next -->
    <div style="background:rgba(56,189,248,0.05); border:1px solid rgba(56,189,248,0.15); border-radius:12px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; font-weight:900; color:#38bdf8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:16px;">What to Do Next</div>
      <ol style="margin:0; padding-left:20px; font-size:14px; color:#cbd5e1; line-height:2;">
        <li>Verify payment has arrived in your bank or payment app</li>
        <li>Log into Lumière Ledger and mark the invoice as <strong style="color:#4ade80;">PAID</strong></li>
        <li>Update the client status in your CRM pipeline as needed</li>
      </ol>
    </div>

    <!-- Deep-link CTA -->
    <div style="text-align:center; margin-bottom:32px;">
      <a href="${appUrl}/crm/financials" style="display:inline-block; background:#f97316; color:#fff; padding:14px 28px; border-radius:10px; font-weight:900; font-size:14px; text-decoration:none;">View in Lumière Ledger &rarr;</a>
    </div>

    <!-- Footer -->
    <p style="text-align:center; font-size:12px; color:#334155; margin:0;">
      This is an automated notification from Lumière Ledger &mdash; sent because a client approved an invoice for ${studioName}.
    </p>
  </div>
</body>
</html>`;

        const displaySubject = eventName 
            ? `✅ ${clientName} approved Invoice #${invoiceNumber} for ${eventName} — $${totalDollars}`
            : `✅ ${clientName} approved Invoice #${invoiceNumber} — $${totalDollars}`;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: displaySubject,
            html,
        });

        console.log('[MAILER] Approval notification dispatched:', data);
        return { success: true, data };
    } catch (error) {
        console.error('[MAILER] Approval notification failed:', error);
        return { success: false, error: error.message };
    }
}

async function sendMonthlyReportEmail({
    to, name, monthName, isPreview,
    startStr, endStr,
    totalSpendCents, totalIncomeCents, netCents, avgTotalSpendCents,
    topCategories, biggestChanges,
    subscriptionsList, subsCents,
    largestTransactions,
    uncategorizedCount, uncategorizedCents,
    taxDeductibleCents,
    topVendors,
    newVendors
}) {
    console.log(`[MAILER] Sending Monthly Report to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    const fmt = (cents) => {
        const dollars = Math.abs(cents / 100);
        return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };
    const fmtDate = (d) => {
        if (!d) return '';
        const [y, m, day] = d.split('-');
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const divider = `<tr><td colspan="2" style="padding:0;"><div style="height:1px;background:rgba(255,255,255,0.06);margin:0;"></div></td></tr>`;
    const sectionLabel = (text) => `<div style="font-size:11px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">${text}</div>`;

    // KPI computations
    const spendChangePct = avgTotalSpendCents > 0
        ? Math.round(((totalSpendCents - avgTotalSpendCents) / avgTotalSpendCents) * 100)
        : null;
    const spendChangeText = spendChangePct !== null
        ? (spendChangePct >= 0
            ? `▲ ${spendChangePct}% vs your 3-month average`
            : `▼ ${Math.abs(spendChangePct)}% vs your 3-month average`)
        : 'No prior data to compare';
    const spendChangeColor = spendChangePct !== null && spendChangePct > 0 ? '#f97316' : '#4ade80';

    const incomeSpentPct = totalIncomeCents > 0 ? Math.round((totalSpendCents / totalIncomeCents) * 100) : null;
    const incomeText = incomeSpentPct !== null
        ? (netCents >= 0
            ? `You spent ${fmt(netCents)} less than your income`
            : `You spent ${fmt(Math.abs(netCents))} more than your income`)
        : '';
    const incomeColor = netCents >= 0 ? '#4ade80' : '#f97316';

    // Row builders
    const topCatRows = topCategories.map((c, i) => `
      <tr>
        <td style="padding:11px 0;${i < topCategories.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">
          <div style="font-size:14px;font-weight:700;color:#fff;">${c.cat}</div>
          <div style="font-size:12px;color:#64748b;">${c.pct}% of spend</div>
        </td>
        <td style="text-align:right;padding:11px 0;font-size:17px;font-weight:900;color:#f97316;${i < topCategories.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${fmt(c.cents)}</td>
      </tr>`).join('');

    const changeRows = biggestChanges.map((c, i) => `
      <tr>
        <td colspan="2" style="padding:${i > 0 ? '14px' : '10px'} 0 12px;${i > 0 ? 'border-top:1px solid rgba(255,255,255,0.06);' : ''}">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-size:14px;font-weight:700;color:#fff;">${c.cat}</td>
              <td style="text-align:right;font-size:13px;font-weight:800;color:${c.delta > 0 ? '#f97316' : '#4ade80'};">
                ${c.delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(c.delta))} ${c.delta > 0 ? 'more' : 'less'}
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding-top:3px;">Last month &nbsp;<span style="color:#94a3b8;font-weight:600;">${fmt(c.current)}</span></td>
              <td style="text-align:right;font-size:12px;color:#64748b;padding-top:3px;">3-mo avg &nbsp;<span style="color:#94a3b8;font-weight:600;">${fmt(c.avg)}</span></td>
            </tr>
          </table>
        </td>
      </tr>`).join('');

    const subsRows = subscriptionsList.map((s, i) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#fff;${i < subscriptionsList.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${s.vendor}</td>
        <td style="text-align:right;padding:10px 0;font-size:14px;font-weight:700;color:#94a3b8;${i < subscriptionsList.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${fmt(s.cents)}</td>
      </tr>`).join('');

    const vendorRows = topVendors.map((v, i) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#fff;${i < topVendors.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${v.vendor}</td>
        <td style="text-align:right;padding:10px 0;font-size:14px;font-weight:700;color:#f97316;${i < topVendors.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${fmt(v.cents)}</td>
      </tr>`).join('');

    const largeRows = largestTransactions.map((t, i) => `
      <tr>
        <td style="padding:10px 0;${i < largestTransactions.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">
          <div style="font-size:14px;color:#fff;font-weight:600;">${t.vendor}</div>
          <div style="font-size:12px;color:#64748b;">${t.category} &nbsp;·&nbsp; ${fmtDate(t.date)}</div>
        </td>
        <td style="text-align:right;padding:10px 0;font-size:16px;font-weight:900;color:#fff;${i < largestTransactions.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${fmt(t.cents)}</td>
      </tr>`).join('');

    const newVendorRows = newVendors.map((v, i) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#fff;${i < newVendors.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${v.vendor}</td>
        <td style="text-align:right;padding:10px 0;font-size:14px;font-weight:700;color:#94a3b8;${i < newVendors.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${fmt(v.cents)}</td>
      </tr>`).join('');

    const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
    const appUrl = 'https://www.lumiereledger.com';
    const uncatUrl = `${appUrl}/Transactions?filter=uncategorized${startStr ? `&start=${startStr}` : ''}${endStr ? `&end=${endStr}` : ''}`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${isPreview ? `<div style="background:#f59e0b;color:#000;padding:10px;text-align:center;font-size:13px;font-weight:700;">🧪 PREVIEW — Test send only. Real data, not delivered to all users.</div>` : ''}
<div style="max-width:600px;margin:0 auto;padding:36px 20px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:-0.02em;color:#fff;">LUMIÈRE LEDGER</div>
    <div style="height:2px;width:40px;background:#f97316;margin:8px auto 0;"></div>
  </div>

  <h1 style="color:#fff;font-size:25px;font-weight:900;margin:0 0 8px;">Your ${monthName} financial report</h1>
  <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">Hi ${name}, here's a summary of your financial activity last month.</p>

  <!-- ── KPI Stats ── -->
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:3px;">Total Spend</div>
          <div style="font-size:28px;font-weight:900;color:#fff;line-height:1.1;">${fmt(totalSpendCents)}</div>
          <div style="font-size:12px;color:${spendChangeColor};margin-top:4px;">${spendChangeText}</div>
        </td>
      </tr>
      ${incomeSpentPct !== null ? `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:3px;">% of Income Spent</div>
          <div style="font-size:28px;font-weight:900;color:#fff;line-height:1.1;">${incomeSpentPct}%</div>
          <div style="font-size:12px;color:${incomeColor};margin-top:4px;">${incomeText}</div>
        </td>
      </tr>` : ''}
      ${totalIncomeCents > 0 ? `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:3px;">Net (Income − Spend)</div>
          <div style="font-size:28px;font-weight:900;color:${netCents >= 0 ? '#4ade80' : '#f97316'};line-height:1.1;">${netCents >= 0 ? '+' : '-'}${fmt(Math.abs(netCents))}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">${netCents >= 0 ? 'You came out ahead last month' : 'You spent more than you earned'}</div>
        </td>
      </tr>` : ''}
      ${taxDeductibleCents > 0 ? `
      <tr>
        <td style="padding:12px 0;">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:3px;">Tax-Deductible Spend</div>
          <div style="font-size:28px;font-weight:900;color:#38bdf8;line-height:1.1;">${fmt(taxDeductibleCents)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Marked deductible in your ledger last month</div>
        </td>
      </tr>` : ''}
    </table>
  </div>

  <!-- ── Uncategorized CTA (shown early so users don't miss it) ── -->
  ${uncategorizedCount > 0 ? `
  <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:16px;padding:18px 24px;margin-bottom:16px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td>
          <div style="font-size:14px;font-weight:700;color:#f97316;margin-bottom:4px;">⚠️ ${uncategorizedCount} transaction${uncategorizedCount > 1 ? 's' : ''} need${uncategorizedCount === 1 ? 's' : ''} a category</div>
          <div style="font-size:13px;color:#94a3b8;">${fmt(uncategorizedCents)} in spending isn't categorized yet — affects your reports and tax deductions.</div>
        </td>
        <td style="text-align:right;white-space:nowrap;padding-left:16px;">
          <a href="${uncatUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:9px 16px;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;">Fix now →</a>
        </td>
      </tr>
    </table>
  </div>` : ''}

  <!-- ── Top 5 Categories ── -->
  ${topCategories.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('Top spending by category')}
    <table style="width:100%;border-collapse:collapse;">
      ${topCatRows}
      ${uncategorizedCount > 0 ? `
      <tr>
        <td style="padding:11px 0 0;border-top:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:14px;font-weight:700;color:#f97316;">Uncategorized</div>
          <div style="font-size:12px;color:#64748b;">${uncategorizedCount} transaction${uncategorizedCount > 1 ? 's' : ''} &nbsp;·&nbsp; <a href="${uncatUrl}" style="color:#f97316;text-decoration:none;font-weight:700;">categorize →</a></div>
        </td>
        <td style="text-align:right;padding:11px 0 0;border-top:1px solid rgba(255,255,255,0.06);font-size:17px;font-weight:900;color:#f97316;">${fmt(uncategorizedCents)}</td>
      </tr>` : ''}
    </table>
  </div>` : ''}

  <!-- ── Biggest Changes ── -->
  ${biggestChanges.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('Biggest changes in spending')}
    <p style="color:#64748b;font-size:12px;margin:0 0 14px;">Compared to your 3-month average.</p>
    <table style="width:100%;border-collapse:collapse;">${changeRows}</table>
  </div>` : ''}

  <!-- ── Top Vendors ── -->
  ${topVendors.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('Top vendors by spend')}
    <table style="width:100%;border-collapse:collapse;">${vendorRows}</table>
  </div>` : ''}

  <!-- ── Largest Transactions ── -->
  ${largestTransactions.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('Largest single transactions')}
    <table style="width:100%;border-collapse:collapse;">${largeRows}</table>
  </div>` : ''}

  <!-- ── New Vendors ── -->
  ${newVendors.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('New vendors this month')}
    <p style="color:#64748b;font-size:12px;margin:0 0 14px;">Merchants that didn't appear in the prior 3 months — worth a look.</p>
    <table style="width:100%;border-collapse:collapse;">${newVendorRows}</table>
  </div>` : ''}

  <!-- ── Subscriptions ── -->
  ${subscriptionsList.length > 0 ? `
  <div style="background:#1e293b;border-radius:16px;padding:22px 24px;margin-bottom:16px;">
    ${sectionLabel('Subscriptions')}
    <table style="width:100%;border-collapse:collapse;">
      ${subsRows}
      <tr>
        <td style="padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.06);font-size:13px;font-weight:700;color:#94a3b8;">Total</td>
        <td style="text-align:right;padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.06);font-size:15px;font-weight:900;color:#fff;">${fmt(subsCents)}</td>
      </tr>
    </table>
  </div>` : ''}


  <!-- ── CTA ── -->
  <div style="text-align:center;margin:24px 0 28px;">
    <a href="${appUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 28px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none;">View Your Full Ledger →</a>
  </div>

  <p style="text-align:center;font-size:12px;color:#334155;margin:0;line-height:1.8;">
    You're receiving this because you have a Lumière Ledger account.<br>
    <a href="${appUrl}" style="color:#475569;">lumiereledger.com</a>
  </p>
</div>
</body>
</html>`;

    try {
        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: `Your ${monthName} financial report`,
            html
        });
        console.log(`[MAILER] Monthly report dispatched to ${to}:`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[MAILER] Monthly report failed for ${to}:`, error);
        return { success: false, error: error.message };
    }
}

async function sendWeeklyDigestEmail({ to, name, weekLabel, incomeCents, spendCents, netCents, missingReceiptCount, mileageReviewCount, taxSetAsideCents, quarterLabel }) {
    console.log(`[MAILER] Sending Weekly Digest to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    const fmt = (cents) => '$' + Math.abs((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
    const appUrl = 'https://www.lumiereledger.com';
    const netColor = netCents >= 0 ? '#4ade80' : '#f97316';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:36px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:-0.02em;color:#fff;">LUMIÈRE LEDGER</div>
    <div style="height:2px;width:40px;background:#4c7dff;margin:8px auto 0;"></div>
    <div style="font-size:13px;color:#cbd5e1;margin-top:10px;">Your Week — ${weekLabel}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;background:#111827;border-radius:16px;padding:24px;margin-bottom:16px;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px;">
      <div style="font-size:11px;font-weight:900;color:#4c7dff;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Money In / Out</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:13px;color:#cbd5e1;padding:6px 0;">Income</td>
          <td style="text-align:right;font-size:17px;font-weight:900;color:#4ade80;padding:6px 0;">${fmt(incomeCents)}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#cbd5e1;padding:6px 0;">Expenses</td>
          <td style="text-align:right;font-size:17px;font-weight:900;color:#fff;padding:6px 0;">${fmt(spendCents)}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#cbd5e1;padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);">Net</td>
          <td style="text-align:right;font-size:17px;font-weight:900;color:${netColor};padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);">${fmt(netCents)}</td>
        </tr>
      </table>
    </td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#111827;border-radius:16px;margin-bottom:16px;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px;">
      <div style="font-size:11px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Missing Receipts</div>
      <div style="font-size:24px;font-weight:900;color:#fff;">${missingReceiptCount}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">deductible transaction${missingReceiptCount === 1 ? '' : 's'} over $75 with no receipt attached</div>
    </td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#111827;border-radius:16px;margin-bottom:16px;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px;">
      <div style="font-size:11px;font-weight:900;color:#fcd34d;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Set Aside for ${quarterLabel}</div>
      <div style="font-size:24px;font-weight:900;color:#fcd34d;">${fmt(taxSetAsideCents)}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">estimated, based on your set-aside rate in Profile settings</div>
    </td></tr>
  </table>

  ${mileageReviewCount > 0 ? `
  <table style="width:100%;border-collapse:collapse;background:#111827;border-radius:16px;margin-bottom:28px;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px;">
      <div style="font-size:11px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Mileage Needs Review</div>
      <div style="font-size:24px;font-weight:900;color:#fff;">${mileageReviewCount}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">AI-logged trip${mileageReviewCount === 1 ? '' : 's'} this week ${mileageReviewCount === 1 ? "is" : "are"} missing a business purpose note or an exact mile count — update on the Mileage page for accurate tax records</div>
    </td></tr>
  </table>` : ''}

  <div style="text-align:center;margin-bottom:28px;">
    <a href="${appUrl}" style="display:inline-block;background:#4c7dff;color:#fff;padding:14px 28px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none;">Open Your Ledger →</a>
  </div>

  <p style="text-align:center;font-size:12px;color:#94a3b8;margin:0;line-height:1.8;">
    You're receiving this because you have a Lumière Ledger account. Turn this off anytime in Profile settings.<br>
    <a href="${appUrl}" style="color:#cbd5e1;">lumiereledger.com</a>
  </p>
</div>
</body>
</html>`;

    try {
        const data = await resend.emails.send({ from: fromEmail, to: [to], subject: `Your week at a glance — ${weekLabel}`, html });
        console.log(`[MAILER] Weekly digest dispatched to ${to}:`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[MAILER] Weekly digest failed for ${to}:`, error);
        return { success: false, error: error.message };
    }
}

async function sendReEngagementEmail({ to, name }) {
    console.log(`[MAILER] Sending Re-engagement email to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
    const appUrl = 'https://www.lumiereledger.com';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:44px 20px;text-align:center;">
  <div style="font-size:20px;font-weight:900;letter-spacing:-0.02em;color:#fff;">LUMIÈRE LEDGER</div>
  <div style="height:2px;width:40px;background:#4c7dff;margin:8px auto 24px;"></div>

  <p style="font-size:16px;color:#e2e8f0;line-height:1.7;margin:0 0 24px;">
    Hey${name ? ` ${name}` : ''} — it's been a little while since you've checked in on your ledger.
    Your receipts, deductions, and tax set-aside are still adding up in the background — worth a quick look.
  </p>

  <a href="${appUrl}" style="display:inline-block;background:#4c7dff;color:#fff;padding:14px 30px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none;margin-bottom:24px;">Open Lumière Ledger →</a>

  <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.8;">
    You're receiving this because you have a Lumière Ledger account. Turn this off anytime in Profile settings.<br>
    <a href="${appUrl}" style="color:#cbd5e1;">lumiereledger.com</a>
  </p>
</div>
</body>
</html>`;

    try {
        const data = await resend.emails.send({ from: fromEmail, to: [to], subject: `Your ledger's still here — quick check-in?`, html });
        console.log(`[MAILER] Re-engagement email dispatched to ${to}:`, data);
        return { success: true, data };
    } catch (error) {
        console.error(`[MAILER] Re-engagement email failed for ${to}:`, error);
        return { success: false, error: error.message };
    }
}

async function sendHealthAlertEmail({ to, issues }) {
    console.log(`[MAILER] Sending Health Alert to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Studio Alerts <support@throughthelens.media>';
        const html = `
            <div style="background-color: #0f172a; color: white; padding: 40px; font-family: sans-serif; border-radius: 12px; max-width: 600px;">
                <h2 style="color: #ef4444; margin-top: 0;">🚨 LUMIÈRE LEDGER ALERT: SYSTEM DEGRADED</h2>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin-top: 0; font-weight: bold; color: #fca5a5;">The internal watchdog detected the following critical issues:</p>
                    <ul style="color: #f8fafc; line-height: 1.6;">
                        ${issues.map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">This is an automated production alert from the Vercel Cron Watchdog.</p>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: `🚨 URGENT: Lumière Ledger Alert`,
            html: html
        });

        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Alert Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * sendReceiptConfirmationEmail
 * Sent back to the forwarder after email receipt ingestion.
 * outcome: 'received' | 'matched' | 'pending' | 'failed' | 'already_linked' | 'ai_unavailable'
 */
async function sendReceiptConfirmationEmail({ to, outcome, vendor, amountCents, expenseDate, expenseId, subject }) {
    console.log(`[MAILER] Sending receipt confirmation (${outcome}) to ${to}`);
    const resend = getResend();
    if (!resend) return { success: false, error: 'Mailer service not configured' };

    const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@throughthelens.media>';
    const appUrl = process.env.APP_URL || 'https://www.lumiereledger.com';
    const txUrl = expenseId ? `${appUrl}/Transactions?expense=${expenseId}` : appUrl;
    const amount = amountCents != null ? `$${(amountCents / 100).toFixed(2)}` : '';

    let emailSubject, bodyHtml;

    if (outcome === 'received') {
        emailSubject = `Receipt received — processing now`;
        const subjectLabel = subject ? ` for <strong>${subject}</strong>` : '';
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#f59e0b;margin-top:0;">Receipt Received</h2>
                <p>Lumière Ledger received your forwarded email${subjectLabel} and is processing it now.</p>
                <p style="color:#94a3b8;">Once processed, you'll get a follow-up email confirming whether the receipt was matched to a transaction or saved for when your account syncs.</p>
                <a href="${appUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Lumière Ledger</a>
            </div>`;
    } else if (outcome === 'matched') {
        emailSubject = `Receipt attached — ${vendor} ${amount}`;
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#f59e0b;margin-top:0;">Receipt Attached</h2>
                <p>Your forwarded receipt was matched and attached to your transaction:</p>
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:16px;border-radius:8px;margin:16px 0;">
                    <strong>${vendor}</strong> &nbsp;·&nbsp; ${amount} &nbsp;·&nbsp; ${expenseDate || ''}
                </div>
                <a href="${txUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Transaction</a>
            </div>`;
    } else if (outcome === 'pending') {
        emailSubject = `Receipt saved — waiting for bank transaction`;
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#f59e0b;margin-top:0;">Receipt Saved</h2>
                <p>Your receipt for <strong>${vendor || 'unknown vendor'} ${amount}</strong> has been saved.</p>
                <p style="color:#94a3b8;">The bank transaction hasn't posted yet. It will be automatically attached once your bank syncs (usually 1–3 business days).</p>
                <a href="${appUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Lumière Ledger</a>
            </div>`;
    } else if (outcome === 'already_linked') {
        emailSubject = `Receipt already on file — ${vendor} ${amount}`;
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#38bdf8;margin-top:0;">Receipt Already Saved</h2>
                <p>Your transaction for <strong>${vendor || 'unknown vendor'} ${amount}</strong> already has a receipt attached.</p>
                <p style="color:#94a3b8;">No changes were made. If you meant to replace the existing receipt, open the transaction and upload manually.</p>
                <a href="${txUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Transaction</a>
            </div>`;
    } else if (outcome === 'ai_unavailable') {
        emailSubject = `Receipt not processed — AI temporarily unavailable`;
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#f97316;margin-top:0;">AI Service Temporarily Unavailable</h2>
                <p>We received your forwarded email but the AI model is currently experiencing high demand and couldn't process it.</p>
                <p style="color:#94a3b8;">Original subject: <em>${subject || '(none)'}</em></p>
                <p>Please forward the email again later. This is a temporary issue — your receipt data is intact and will process normally once demand drops.</p>
                <a href="${appUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Upload Manually Instead</a>
            </div>`;
    } else {
        emailSubject = `Receipt not processed`;
        bodyHtml = `
            <div style="background:#0f172a;color:#f8fafc;padding:40px;font-family:sans-serif;border-radius:12px;max-width:600px;">
                <h2 style="color:#ef4444;margin-top:0;">Receipt Not Processed</h2>
                <p>We received your forwarded email but couldn't find a transaction amount.</p>
                <p style="color:#94a3b8;">Original subject: <em>${subject || '(none)'}</em></p>
                <p>If this was a receipt, try forwarding the attachment directly or uploading it manually.</p>
                <a href="${appUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Upload Manually</a>
            </div>`;
    }

    try {
        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: emailSubject,
            html: bodyHtml,
        });
        return { success: true, data };
    } catch (error) {
        console.error('[MAILER] Receipt confirmation send failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendInvoiceEmail,
    sendInviteEmail,
    sendDailyReportEmail,
    sendMonthlyReportEmail,
    sendPromoEmail,
    sendContactRelayEmail,
    sendInvoiceApprovalEmail,
    sendHealthAlertEmail,
    sendReceiptConfirmationEmail,
    sendWeeklyDigestEmail,
    sendReEngagementEmail,
};
