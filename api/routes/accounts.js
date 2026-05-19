// api/routes/accounts.js — Lumière Ledger Accounts summary + aliases
// GET /api/accounts/summary  — per-source spend aggregates, merged with aliases
// PUT /api/accounts/alias    — upsert { source_key, display_name?, visible? }
'use strict';

const express = require('express');
const router  = express.Router();

// ─── GET /api/accounts/summary ────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
    try {
        const now      = new Date();
        const thisYear = now.getFullYear();
        const thisMo   = now.getMonth() + 1;
        const lastMo   = thisMo === 1 ? 12 : thisMo - 1;
        const lastMoYr = thisMo === 1 ? thisYear - 1 : thisYear;
        const ytdStart = `${thisYear}-01-01`;

        // Fetch transactions + aliases in parallel
        const [txRes, aliasRes] = await Promise.all([
            req.sb
                .from('expenses')
                .select('source, amount_cents, expense_date')
                .eq('user_id', req.user.id)
                .gte('expense_date', `${lastMoYr}-01-01`)
                .order('expense_date', { ascending: false }),
            req.sb
                .from('account_aliases')
                .select('source_key, display_name, visible')
                .eq('user_id', req.user.id),
        ]);

        if (txRes.error)    throw txRes.error;
        if (aliasRes.error) throw aliasRes.error;

        // Build alias lookup: source_key → { display_name, visible }
        const aliasMap = {};
        for (const a of aliasRes.data || []) {
            aliasMap[a.source_key] = { display_name: a.display_name, visible: a.visible };
        }

        const accounts = {};

        for (const tx of txRes.data || []) {
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

        // Merge aliases into each account row
        const rows = Object.values(accounts).map(acct => {
            const alias = aliasMap[acct.source] || {};
            return {
                ...acct,
                display_name: alias.display_name || null,   // null = use auto-label in frontend
                visible:      alias.visible !== false,       // default true if no alias row
            };
        });

        // Page-level totals — visible accounts only
        const visibleRows = rows.filter(a => a.visible);
        const totalMonthCents = visibleRows.reduce((s, a) => s + a.this_month_cents, 0);

        const CREDIT_KEYS = ['applecard','capitalone','amex','delta_amex','amex_gold','amex_platinum','amex_blue','chase','bankofamerica','wellsfargo','usbank','navyfcu'];
        let checkingCents = 0;
        let creditCents   = 0;
        for (const a of visibleRows) {
            const key = a.source.toLowerCase();
            if (CREDIT_KEYS.some(k => key.includes(k))) creditCents   += a.this_month_cents;
            else                                          checkingCents += a.this_month_cents;
        }

        res.json({
            accounts:          rows,          // ALL rows (visible + hidden) — frontend filters
            total_month_cents: totalMonthCents,
            checking_cents:    checkingCents,
            credit_cents:      creditCents,
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

// ─── PUT /api/accounts/alias ──────────────────────────────────────────────────
// Body: { source_key: string, display_name?: string|null, visible?: boolean }
// Upserts a single alias row — partial update supported (omit fields to leave unchanged)
router.put('/alias', async (req, res) => {
    try {
        const { source_key, display_name, visible } = req.body || {};

        if (!source_key || typeof source_key !== 'string') {
            return res.status(400).json({ error: 'source_key is required' });
        }

        // Fetch existing row first so we can merge (partial update)
        const { data: existing } = await req.sb
            .from('account_aliases')
            .select('display_name, visible')
            .eq('user_id', req.user.id)
            .eq('source_key', source_key)
            .maybeSingle();

        const payload = {
            user_id:      req.user.id,
            source_key,
            display_name: display_name !== undefined ? (display_name || null) : (existing?.display_name ?? null),
            visible:      visible      !== undefined ? visible                : (existing?.visible      ?? true),
            updated_at:   new Date().toISOString(),
        };

        const { error } = await req.sb
            .from('account_aliases')
            .upsert(payload, { onConflict: 'user_id,source_key' });

        if (error) throw error;

        res.json({ ok: true, alias: payload });
    } catch (err) {
        console.error('[accounts] alias upsert error:', err.message);
        res.status(500).json({ error: 'Failed to save alias' });
    }
});

module.exports = router;
