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
        const baseDomainEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@lumiereledger.com>';
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

async function sendInviteEmail({ to, name, code }) {
    console.log(`[MAILER] Sending Invite to ${to}...`);
    const resend = getResend();
    if (!resend) return { success: false, error: "Mailer service not configured" };

    try {
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@lumiereledger.com>';
        const signupUrl = `${process.env.APP_URL || 'https://lumiereledger.com'}/login?code=${code}&email=${encodeURIComponent(to)}`;

        const html = `
            <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Inter', sans-serif; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin: 0;">LUMIÈRE LEDGER</h1>
                    <div style="height: 2px; width: 40px; background: #f97316; margin: 10px auto;"></div>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">Hello ${name || 'Photographer'},</p>
                
                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">
                    You've been invited to join the <strong>Lumière Ledger</strong>. 
                    Manage your transactions, track gear depreciation, and automate your tax workflow with ease.
                </p>

                <div style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
                    <div style="font-size: 12px; font-weight: 900; color: #f97316; margin-bottom: 10px; text-transform: uppercase;">Your Personal Invite Code</div>
                    <div style="font-size: 32px; font-weight: 950; letter-spacing: 0.2em; color: white;">${code}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${signupUrl}" style="background-color: #f97316; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 900; display: inline-block; font-size: 14px;">ENTER LUMIÈRE LEDGER</a>
                </div>

                <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 40px;">
                    This project is currently in private beta. If you have questions, please contact your administrator.
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: 'Invite: Welcome to the Lumière Ledger',
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
        const fromEmail = process.env.RESEND_FROM || 'Lumière Stats <support@lumiereledger.com>';
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
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@lumiereledger.com>';
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
        const fromEmail = 'Lumière Ledger Inbound <support@lumiereledger.com>';
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
        const fromEmail = process.env.RESEND_FROM || 'Lumière Ledger <support@lumiereledger.com>';
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

module.exports = { 
    sendInvoiceEmail, 
    sendInviteEmail, 
    sendDailyReportEmail, 
    sendPromoEmail,
    sendContactRelayEmail,
    sendInvoiceApprovalEmail,
    sendHealthAlertEmail,
};
