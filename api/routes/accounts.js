// api/routes/accounts.js — Lumière Ledger Accounts summary
// GET /api/accounts/summary — per-source spend aggregates for Accounts page
'use strict';

const express = require('express');
const router  = express.Router();

// ─── GET /api/accounts/summary ────────────────────────────────────────────────
// Returns per-source: this_month_cents, last_month_cents, ytd_cents,
//                     total_count, last_date
// Also returns page-level: total_month_cents, checking_cents, credit_cents
router.get('/summary', async (req, res) => {
    try {
        const now       = new Date();
        const thisYear  = now.getFullYear();
        const thisMo    = now.getMonth() + 1; // 1-based
        const lastMo    = thisMo === 1 ? 12 : thisMo - 1;
        const lastMoYr  = thisMo === 1 ? thisYear - 1 : thisYear;
        const ytdStart  = `${thisYear}-01-01`;

        // Single query — all expenses from start of last year to today
        // (captures YTD + last month in one round-trip)
        const { data, error } = await req.sb
            .from('expenses')
            .select('source, amount_cents, expense_date')
            .eq('user_id', req.user.id)
            .gte('expense_date', `${lastMoYr}-01-01`)
            .order('expense_date', { ascending: false });

        if (error) throw error;

        const accounts = {};

        for (const tx of data || []) {
            const s  = tx.source || 'manual';
            const d  = tx.expense_date || '';
            const [yr, mo] = d.split('-').map(Number);
            const cents = tx.amount_cents || 0;

            if (!accounts[s]) {
                accounts[s] = {
                    source:           s,
                    this_month_cents: 0,
                    last_month_cents: 0,
                    ytd_cents:        0,
                    total_count:      0,
                    last_date:        null,
                };
            }

            const a = accounts[s];
            a.total_count++;
            if (!a.last_date || d > a.last_date) a.last_date = d;
            if (yr === thisYear && mo === thisMo)  a.this_month_cents += cents;
            if (yr === lastMoYr && mo === lastMo)  a.last_month_cents += cents;
            if (yr === thisYear)                   a.ytd_cents        += cents;
        }

        const rows = Object.values(accounts);

        // Page-level totals (this month only)
        const totalMonthCents = rows.reduce((s, a) => s + a.this_month_cents, 0);

        // Credit sources (best-effort): card keywords
        const CREDIT_KEYS = ['applecard','capitalone','amex','delta_amex','amex_gold','amex_platinum','amex_blue','chase','bankofamerica','wellsfargo','usbank','navyfcu'];
        let checkingCents = 0;
        let creditCents   = 0;
        for (const a of rows) {
            const key = a.source.toLowerCase();
            const isCredit = CREDIT_KEYS.some(k => key.includes(k));
            if (isCredit) creditCents   += a.this_month_cents;
            else          checkingCents += a.this_month_cents;
        }

        res.json({
            accounts:           rows,
            total_month_cents:  totalMonthCents,
            checking_cents:     checkingCents,
            credit_cents:       creditCents,
            period: {
                this_month: `${thisYear}-${String(thisMo).padStart(2,'0')}`,
                last_month: `${lastMoYr}-${String(lastMo).padStart(2,'0')}`,
                ytd_start:  ytdStart,
            },
        });
    } catch (err) {
        console.error('[accounts] summary error:', err.message);
        res.status(500).json({ error: 'Failed to fetch account summary' });
    }
});

module.exports = router;
