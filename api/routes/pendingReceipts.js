const express = require('express');
const log = require('../utils/logger');
const { supabase: adminClient } = require('../db');

const router = express.Router();

/**
 * GET /api/receipts/pending
 * Returns all pending receipts for the authenticated user, newest first.
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from('pending_receipts')
            .select('id, vendor, receipt_date, amount_cents, file_path, raw_subject, raw_sender, needs_review, created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            log.error('pending-receipts', 'GET failed', { error: error.message }, req.user.id);
            return res.status(500).json({ error: 'Failed to load pending receipts' });
        }

        res.json({ pending: data || [] });
    } catch (err) {
        log.error('pending-receipts', 'Unhandled GET error', { error: err.message }, req.user.id);
        res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * POST /api/receipts/pending/:id/link
 * Manually links a pending receipt to a specific transaction.
 * Body: { expense_id }
 * - Updates expenses.receipt_link with the pending receipt's file_path
 * - Deletes the pending_receipts row
 */
router.post('/:id/link', async (req, res) => {
    const { id } = req.params;
    const { expense_id } = req.body;

    if (!expense_id) {
        return res.status(400).json({ error: 'expense_id is required' });
    }

    try {
        // 1. Fetch the pending receipt — confirm it belongs to this user
        const { data: pending, error: fetchErr } = await req.sb
            .from('pending_receipts')
            .select('id, vendor, amount_cents, file_path, receipt_date')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (fetchErr || !pending) {
            return res.status(404).json({ error: 'Pending receipt not found' });
        }

        // 2. Attach receipt_link to the target expense (must belong to same user)
        const { error: updateErr } = await req.sb
            .from('expenses')
            .update({ receipt_link: pending.file_path, updated_at: new Date().toISOString() })
            .eq('id', expense_id)
            .eq('user_id', req.user.id);

        if (updateErr) {
            log.error('pending-receipts', 'Expense update failed', { error: updateErr.message, expenseId: expense_id }, req.user.id);
            return res.status(500).json({ error: 'Failed to attach receipt to transaction' });
        }

        // 3. Delete the pending row
        const { error: deleteErr } = await req.sb
            .from('pending_receipts')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (deleteErr) {
            // Non-fatal — receipt is attached, pending row just stale
            log.warn('pending-receipts', 'Pending row delete failed (receipt was attached)', { error: deleteErr.message, pendingId: id }, req.user.id);
        }

        log.info('pending-receipts', 'Receipt manually linked', {
            pendingId: id, expenseId: expense_id, vendor: pending.vendor, amountCents: pending.amount_cents,
        }, req.user.id);

        res.json({ success: true });
    } catch (err) {
        log.error('pending-receipts', 'Unhandled link error', { error: err.message }, req.user.id);
        res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * DELETE /api/receipts/pending/:id
 * Dismisses a pending receipt — deletes the DB row and optionally the Storage file.
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch first to get file_path for Storage cleanup
        const { data: pending, error: fetchErr } = await req.sb
            .from('pending_receipts')
            .select('id, file_path')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (fetchErr || !pending) {
            return res.status(404).json({ error: 'Pending receipt not found' });
        }

        // Delete DB row
        const { error: deleteErr } = await req.sb
            .from('pending_receipts')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (deleteErr) {
            log.error('pending-receipts', 'Delete failed', { error: deleteErr.message, pendingId: id }, req.user.id);
            return res.status(500).json({ error: 'Failed to dismiss receipt' });
        }

        // Best-effort: remove Storage file (receipts bucket is public — use adminClient)
        if (pending.file_path) {
            adminClient.storage.from('receipts').remove([pending.file_path])
                .catch(e => log.warn('pending-receipts', 'Storage file removal failed', { error: e.message, path: pending.file_path }, req.user.id));
        }

        log.info('pending-receipts', 'Pending receipt dismissed', { pendingId: id }, req.user.id);
        res.json({ success: true });
    } catch (err) {
        log.error('pending-receipts', 'Unhandled delete error', { error: err.message }, req.user.id);
        res.status(500).json({ error: 'Internal error' });
    }
});

module.exports = router;
