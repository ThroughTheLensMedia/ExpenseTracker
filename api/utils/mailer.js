/**
 * Elite Mailer Bridge
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

async function sendInvoiceEmail({ to, subject, body, attachments }) {
    console.log(`[MAILER] Preparing email to ${to}...`);
    console.log(`[MAILER] Subject: ${subject}`);

    const resend = getResend();
    if (!resend) {
        console.warn("[MAILER] Resend client not initialized. Email was NOT sent.");
        return { success: false, error: "Mailer service not configured" };
    }

    try {
        const fromEmail = process.env.RESEND_FROM || 'Studio Tracker <billing@throughthelens.media>';
        
        const payload = {
            from: fromEmail,
            to: [to],
            subject: subject,
            html: body
        };

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
        const fromEmail = process.env.RESEND_FROM || 'Studio <billing@throughthelens.media>';
        const signupUrl = `${process.env.APP_URL || 'https://app.throughthelens.media'}/login?code=${code}&email=${encodeURIComponent(to)}`;

        const html = `
            <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Inter', sans-serif; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin: 0;">STUDIO TRACKER</h1>
                    <div style="height: 2px; width: 40px; background: #f97316; margin: 10px auto;"></div>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">Hello ${name || 'Photographer'},</p>
                
                <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">
                    You've been invited to join the <strong>Elite Studio Tracker</strong>. 
                    Manage your transactions, track gear depreciation, and automate your tax workflow with ease.
                </p>

                <div style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
                    <div style="font-size: 12px; font-weight: 900; color: #f97316; margin-bottom: 10px; text-transform: uppercase;">Your Personal Invite Code</div>
                    <div style="font-size: 32px; font-weight: 950; letter-spacing: 0.2em; color: white;">${code}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${signupUrl}" style="background-color: #f97316; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 900; display: inline-block; font-size: 14px;">ENTER THE STUDIO</a>
                </div>

                <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 40px;">
                    This project is currently in private beta. If you have questions, please contact your studio administrator.
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: 'Invite: Welcome to the Elite Studio Tracker',
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
        const fromEmail = process.env.RESEND_FROM || 'Studio Stats <billing@throughthelens.media>';
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
                    This is an automated production report from the Elite Studio Tracker.
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

module.exports = { sendInvoiceEmail, sendInviteEmail, sendDailyReportEmail };
