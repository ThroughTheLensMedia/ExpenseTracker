/**
 * Email Queue — Serverless-safe inline retry wrapper
 *
 * Bull + ioredis require a persistent worker process and are incompatible
 * with Vercel serverless functions. This module replaces Bull with a simple
 * retry loop: up to 3 attempts with linear backoff on Resend failures.
 *
 * Exported interface is identical to the old Bull-based module — all callers
 * (cron.js, invoices.js, admin.js) work without any changes.
 */

const {
    sendInvoiceEmail,
    sendInviteEmail,
    sendDailyReportEmail,
    sendMonthlyReportEmail,
    sendPromoEmail,
    sendContactRelayEmail,
    sendInvoiceApprovalEmail,
    sendHealthAlertEmail,
    sendWeeklyDigestEmail,
    sendReEngagementEmail
} = require('./mailer');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * withRetry(fn, attempts, backoffMs)
 * Calls fn() up to `attempts` times. Returns on first success.
 * Waits backoffMs * (attempt + 1) between retries (linear backoff).
 * fn() must return { success: boolean, error?: string }.
 */
async function withRetry(fn, attempts = 3, backoffMs = 1000) {
    let lastResult;
    for (let i = 0; i < attempts; i++) {
        lastResult = await fn();
        if (lastResult.success) return lastResult;
        if (i < attempts - 1) {
            console.warn(`[EMAIL QUEUE] Attempt ${i + 1} failed — retrying in ${backoffMs * (i + 1)}ms`);
            await sleep(backoffMs * (i + 1));
        }
    }
    console.error(`[EMAIL QUEUE] All ${attempts} attempts exhausted. Last error: ${lastResult?.error}`);
    return { success: false, error: lastResult?.error || 'All retry attempts exhausted' };
}

async function queueInvoiceEmail(payload) {
    return withRetry(() => sendInvoiceEmail(payload), 3);
}

async function queueInviteEmail(payload) {
    return withRetry(() => sendInviteEmail(payload), 3);
}

async function queueDailyReportEmail(payload) {
    return withRetry(() => sendDailyReportEmail(payload), 2);
}

async function queueMonthlyReportEmail(payload) {
    return withRetry(() => sendMonthlyReportEmail(payload), 2);
}

async function queuePromoEmail(payload) {
    return withRetry(() => sendPromoEmail(payload), 2);
}

async function queueContactRelayEmail(payload) {
    return withRetry(() => sendContactRelayEmail(payload), 3);
}

async function queueInvoiceApprovalEmail(payload) {
    return withRetry(() => sendInvoiceApprovalEmail(payload), 3);
}

async function queueHealthAlertEmail(payload) {
    return withRetry(() => sendHealthAlertEmail(payload), 3);
}

async function queueWeeklyDigestEmail(payload) {
    return withRetry(() => sendWeeklyDigestEmail(payload), 2);
}

async function queueReEngagementEmail(payload) {
    return withRetry(() => sendReEngagementEmail(payload), 2);
}

module.exports = {
    queueInvoiceEmail,
    queueInviteEmail,
    queueDailyReportEmail,
    queueMonthlyReportEmail,
    queuePromoEmail,
    queueContactRelayEmail,
    queueInvoiceApprovalEmail,
    queueHealthAlertEmail,
    queueWeeklyDigestEmail,
    queueReEngagementEmail
};
