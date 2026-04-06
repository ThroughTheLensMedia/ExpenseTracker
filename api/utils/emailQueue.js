/**
 * Email Queue (Bull)
 * Async job processor for all transactional emails.
 * Prevents email sending from blocking request handlers.
 */

const Queue = require('bull');
const {
    sendInvoiceEmail: _sendInvoiceEmail,
    sendInviteEmail: _sendInviteEmail,
    sendDailyReportEmail: _sendDailyReportEmail,
    sendPromoEmail: _sendPromoEmail,
    sendContactRelayEmail: _sendContactRelayEmail,
    sendInvoiceApprovalEmail: _sendInvoiceApprovalEmail
} = require('./mailer');

// Initialize Bull queue ONLY if Redis config is present
const useQueue = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
let emailQueue = null;

if (useQueue) {
    console.log("[EMAIL QUEUE] Redis detected. Initializing Bull Queue...");
    const redisConfig = process.env.REDIS_URL || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
    };

    emailQueue = new Queue('studio-emails', { redis: redisConfig });
    
    // Safety error listener
    emailQueue.on('error', (err) => {
        console.error(`[EMAIL QUEUE] Connection Error: ${err.message}`);
    });

    emailQueue.on('completed', (job) => {
        console.log(`[EMAIL QUEUE] Job ${job.id} completed successfully`);
    });

    emailQueue.on('failed', (job, err) => {
        console.error(`[EMAIL QUEUE] Job ${job.id} failed: ${err.message}`);
    });

    // Queue worker: processes email jobs
    emailQueue.process(async (job) => {
        const { type, payload } = job.data;
        try {
            const result = await processEmail(type, payload);
            if (!result.success) throw new Error(result.error || 'Email send failed');
            return result;
        } catch (err) {
            console.error(`[EMAIL QUEUE] Processing error for type ${type}:`, err);
            throw err;
        }
    });
} else {
    console.warn("[EMAIL QUEUE] No Redis found. Falling back to direct email dispatch.");
}

async function processEmail(type, payload) {
    switch (type) {
        case 'invoice':      return await _sendInvoiceEmail(payload);
        case 'invite':       return await _sendInviteEmail(payload);
        case 'daily-report': return await _sendDailyReportEmail(payload);
        case 'promo':        return await _sendPromoEmail(payload);
        case 'contact-relay': return await _sendContactRelayEmail(payload);
        case 'approval':     return await _sendInvoiceApprovalEmail(payload);
        default:             throw new Error(`Unknown email type: ${type}`);
    }
}

// Enqueue functions (Redirect to direct dispatch if Queue is disabled)
async function queueInvoiceEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'invoice', payload }, { attempts: 3, backoff: 2000, removeOnComplete: true });
    return await _sendInvoiceEmail(payload);
}

async function queueInviteEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'invite', payload }, { attempts: 3, backoff: 2000, removeOnComplete: true });
    return await _sendInviteEmail(payload);
}

async function queueDailyReportEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'daily-report', payload }, { attempts: 2, backoff: 2000, removeOnComplete: true });
    return await _sendDailyReportEmail(payload);
}

async function queuePromoEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'promo', payload }, { attempts: 2, backoff: 2000, removeOnComplete: true });
    return await _sendPromoEmail(payload);
}

async function queueContactRelayEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'contact-relay', payload }, { attempts: 3, backoff: 2000, removeOnComplete: true });
    return await _sendContactRelayEmail(payload);
}

async function queueInvoiceApprovalEmail(payload) {
    if (useQueue) return emailQueue.add({ type: 'approval', payload }, { attempts: 3, backoff: 2000, removeOnComplete: true });
    return await _sendInvoiceApprovalEmail(payload);
}

module.exports = {
    emailQueue,
    queueInvoiceEmail,
    queueInviteEmail,
    queueDailyReportEmail,
    queuePromoEmail,
    queueContactRelayEmail,
    queueInvoiceApprovalEmail
};
