/**
 * logger.js — Persistent structured logging to system_logs (Supabase)
 * 7-day retention: stale rows pruned automatically on each write batch.
 * All writes are fire-and-forget (non-blocking). Never throws.
 *
 * Usage:
 *   const log = require('./logger');
 *   log.info('email-inbound', 'Receipt matched', { expenseId: 123, amountCents: 290 });
 *   log.warn('plaid', 'Sync skipped', { reason: 'rate limit' });
 *   log.error('auth', 'JWT validation failed', { error: err.message, userId });
 */

const { supabase: adminClient } = require('../db');

const RETENTION_DAYS = 7;

/**
 * Core write function. Non-blocking — errors are swallowed after logging to console.
 */
async function write(level, source, message, metadata = null, userId = null) {
    // Always mirror to console so Vercel runtime logs still capture it
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${source.toUpperCase()}] [${level.toUpperCase()}] ${message}`, metadata ? JSON.stringify(metadata) : '');

    try {
        // Insert the log row
        const { error: insertErr } = await adminClient
            .from('system_logs')
            .insert({ level, source, message, metadata, user_id: userId });

        if (insertErr) {
            console.error('[LOGGER] Insert failed:', insertErr.message);
            return;
        }

        // Prune rows older than 7 days (~1% of writes to avoid constant overhead)
        if (Math.random() < 0.01) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
            await adminClient
                .from('system_logs')
                .delete()
                .lt('created_at', cutoff.toISOString());
        }
    } catch (err) {
        console.error('[LOGGER] Unexpected error:', err.message);
    }
}

const log = {
    info:  (source, message, metadata, userId) => write('info',  source, message, metadata, userId),
    warn:  (source, message, metadata, userId) => write('warn',  source, message, metadata, userId),
    error: (source, message, metadata, userId) => write('error', source, message, metadata, userId),
};

module.exports = log;
