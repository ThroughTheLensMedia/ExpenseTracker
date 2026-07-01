// api/routes/accounts.js
// GET /api/accounts/summary  — grouped by account type, Plaid + CSV + manual
// PUT /api/accounts/alias    — upsert { source_key, display_name?, visible? }
'use strict';

const express = require('express');
const router  = express.Router();

// Credit source detection — used to assign account_type
const CREDIT_SOURCES = new Set([
    'applecard','capitalone','amex','delta_amex','amex_gold','amex_platinum','amex_blue',
    'chase','bankofamerica','wellsfargo',
]);
const CREDIT_KEYWORDS  = ['card','amex','credit','visa','mastercard','discover','venture','sapphire','freedom','platinum','gold','blue','delta','skymiles','southwest','united','ink'];
const SAVINGS_KEYWORDS = ['savings','saving','photography','money_market','mmkt','hsa','ira','invest','hysa','high_yield'];

function detectAccountType(source) {
    const key = (source || '').toLowerCase();
    if (key === 'manual') return 'manual';
    if (CREDIT_SOURCES.has(key)) return 'credit';
    if (CREDIT_KEYWORDS.some(k => key.includes(k))) return 'credit';
    if (SAVINGS_KEYWORDS.some(k => key.includes(k))) return 'savings';
    return 'checking'; // default: checking/bank
}

// ─── GET /api/accounts/summary ────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
    try {
        const now      = new Date();
        const thisYear = now.getFullYear();
        const thisMo   = now.getMonth() + 1;
        const lastMo   = thisMo === 1 ? 12 : thisMo - 1;
        const lastMoYr = thisMo === 1 ? thisYear - 1 : thisYear;

        const [txRes, aliasRes, plaidRes, linkRes] = await Promise.all([
            req.sb
                .from('expenses')
                .select('source, amount_cents, expense_date, plaid_transaction_id')
                .eq('user_id', req.user.id)
                .gte('expense_date', `${lastMoYr}-01-01`)
                .order('expense_date', { ascending: false }),
            req.sb
                .from('account_aliases')
                .select('source_key, display_name, visible, linked_source')
                .eq('user_id', req.user.id)
                .then(r => r).catch(() => ({ data: [] })),
            req.sb
                .from('plaid_connections')
                .select('id, institution_name, last_synced_at, status, needs_reauth, last_item_error')
                .eq('user_id', req.user.id)
                .eq('status', 'active')
                .then(r => r).catch(() => ({ data: [] })),
            // For each CSV source with Plaid cross-matches, find which plaid_account_id it links to
            req.sb
                .from('expenses')
                .select('source, plaid_account_id')
                .eq('user_id', req.user.id)
                .not('plaid_transaction_id', 'is', null)
                .not('plaid_account_id', 'is', null)
                .then(r => r).catch(() => ({ data: [] })),
        ]);

        if (txRes.error) throw txRes.error;

        // Build source → plaid_account_id map (most frequent plaid_account_id wins)
        const plaidLinkMap = {}; // source → { account_id: count }
        for (const row of (linkRes.data || [])) {
            if (!row.source || !row.plaid_account_id) continue;
            if (!plaidLinkMap[row.source]) plaidLinkMap[row.source] = {};
            plaidLinkMap[row.source][row.plaid_account_id] = (plaidLinkMap[row.source][row.plaid_account_id] || 0) + 1;
        }
        // Reduce to single best plaid_account_id per source
        const sourcePlaidAccount = {};
        for (const [source, counts] of Object.entries(plaidLinkMap)) {
            sourcePlaidAccount[source] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        }

        // Alias lookup
        const aliasMap = {};
        for (const a of (aliasRes.data || [])) {
            aliasMap[a.source_key] = { display_name: a.display_name, visible: a.visible, linked_source: a.linked_source || null };
        }

        // Build per-source aggregates
        const accounts = {};

        for (const tx of (txRes.data || [])) {
            const s    = tx.source || 'manual';
            const d    = tx.expense_date || '';
            const [yr, mo] = d.split('-').map(Number);
            const cents = tx.amount_cents || 0;

            if (!accounts[s]) {
                accounts[s] = {
                    source:           s,
                    account_type:     detectAccountType(s),
                    this_month_cents: 0,
                    last_month_cents: 0,
                    ytd_cents:        0,
                    total_count:      0,
                    last_date:        null,
                    has_plaid_link:   false,
                };
            }

            const a = accounts[s];
            a.total_count++;
            if (!a.last_date || d > a.last_date) a.last_date = d;
            if (yr === thisYear && mo === thisMo)  a.this_month_cents += cents;
            if (yr === lastMoYr && mo === lastMo)  a.last_month_cents += cents;
            if (yr === thisYear)                   a.ytd_cents        += cents;
            if (tx.plaid_transaction_id)           a.has_plaid_link   = true;
        }

        // Ensure a 'plaid' entry exists for every active Plaid connection,
        // even if all transactions were linked to CSV rows (no source='plaid' expenses).
        const plaidConns = plaidRes.data || [];
        if (plaidConns.length > 0 && !accounts['plaid']) {
            accounts['plaid'] = {
                source:           'plaid',
                account_type:     'checking',
                this_month_cents: 0,
                last_month_cents: 0,
                ytd_cents:        0,
                total_count:      0,
                last_date:        plaidConns[0].last_synced_at?.split('T')[0] || null,
                has_plaid_link:   false,
            };
        }

        // Merge aliases + visible flag into rows
        const rows = Object.values(accounts).map(acct => {
            const alias = aliasMap[acct.source] || {};
            return {
                ...acct,
                display_name:          alias.display_name          || null,
                visible:               alias.visible !== false,
                linked_source:         alias.linked_source          || null,
                linked_plaid_account_id: sourcePlaidAccount[acct.source] || null,
            };
        });

        // Page-level totals — visible accounts, no double-counting:
        // skip 'plaid' source rows (linked CSV rows already count)
        // skip merged accounts (linked_source set = absorbed into another card)
        const visibleForTotals = rows.filter(a => a.visible && a.source !== 'plaid' && !a.linked_source);
        const totalMonthCents  = visibleForTotals.reduce((s, a) => s + a.this_month_cents, 0);
        let checkingCents = 0, creditCents = 0;
        for (const a of visibleForTotals) {
            if (a.account_type === 'credit') creditCents   += a.this_month_cents;
            else                              checkingCents += a.this_month_cents;
        }

        res.json({
            accounts:          rows,
            plaid_connections: plaidConns,
            total_month_cents: totalMonthCents,
            checking_cents:    checkingCents,
            credit_cents:      creditCents,
            period: {
                this_month: `${thisYear}-${String(thisMo).padStart(2,'0')}`,
                last_month: `${lastMoYr}-${String(lastMo).padStart(2,'0')}`,
                ytd_start:  `${thisYear}-01-01`,
            },
        });
    } catch (err) {
        console.error('[accounts] summary error:', err.message);
        res.status(500).json({ error: 'Failed to fetch account summary' });
    }
});

// ─── PUT /api/accounts/alias ──────────────────────────────────────────────────
router.put('/alias', async (req, res) => {
    try {
        const { source_key, display_name, visible, linked_source } = req.body || {};
        if (!source_key || typeof source_key !== 'string') {
            return res.status(400).json({ error: 'source_key is required' });
        }

        const { data: existing } = await req.sb
            .from('account_aliases')
            .select('display_name, visible, linked_source')
            .eq('user_id', req.user.id)
            .eq('source_key', source_key)
            .maybeSingle();

        const payload = {
            user_id:       req.user.id,
            source_key,
            display_name:  display_name  !== undefined ? (display_name  || null) : (existing?.display_name  ?? null),
            visible:       visible        !== undefined ? visible                 : (existing?.visible        ?? true),
            linked_source: linked_source  !== undefined ? (linked_source || null) : (existing?.linked_source  ?? null),
            updated_at:    new Date().toISOString(),
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
