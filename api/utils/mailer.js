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
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendInvoiceEmail({ to, subject, body, attachmentUrl }) {
    console.log(`[MAILER] Preparing email to ${to}...`);
    console.log(`[MAILER] Subject: ${subject}`);

    if (!process.env.RESEND_API_KEY) {
        console.warn("[MAILER] No API key found. Email was NOT sent, only logged to system terminal.");
        return { success: false, error: "Mailer service not configured" };
    }

    try {
        const fromEmail = process.env.RESEND_FROM || 'Through The Lens Media <billing@throughthelens.media>';
        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: subject,
            html: body,
        });
        console.log("[MAILER] Email dispatched successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("[MAILER] Dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendInvoiceEmail };
