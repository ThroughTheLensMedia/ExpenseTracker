/**
 * backfill-plaid-webhooks.js
 * Registers the Plaid webhook URL on every existing active connection.
 *
 * New connections get the webhook automatically (added to linkTokenCreate in
 * plaid.js, v7.10.16). Existing connections predate that change and need this
 * one-time backfill via Plaid's itemWebhookUpdate API.
 *
 * NOTE: the actual v7.10.16 backfill was NOT run via this script — Vercel's
 * ENCRYPTION_KEY is marked Sensitive (write-only, can't be copied out of the
 * dashboard once set that way), so it couldn't be added to a local .env. It
 * was run instead via a temporary admin API route (api/routes/admin.js,
 * removed in v7.10.18 after confirming) that decrypted tokens server-side in
 * production, where Vercel injects the real value at runtime. This script is
 * kept for reference / in case ENCRYPTION_KEY is ever available locally
 * (e.g. during an ENCRYPTION_KEY rotation, per the runbook in CLAUDE.md).
 *
 * Usage (run locally):
 *   node api/scripts/backfill-plaid-webhooks.js
 *   node api/scripts/backfill-plaid-webhooks.js --dry-run
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLAID_CLIENT_ID,
 * PLAID_SECRET, PLAID_ENV, ENCRYPTION_KEY in env (loads from .env if present)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { decrypt } = require('../utils/cryptoUtil');

const DRY_RUN = process.argv.includes('--dry-run');
const WEBHOOK_URL = `${process.env.APP_URL || 'https://www.lumiereledger.com'}/api/plaid/webhook`;

async function main() {
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be sent to Plaid\n' : '🔗 LIVE RUN — registering webhook on all active connections\n');
    console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
        throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const plaidClient = new PlaidApi(new Configuration({
        basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
                'PLAID-SECRET': process.env.PLAID_SECRET,
            },
        },
    }));

    const { data: rows, error } = await supabase
        .from('plaid_connections')
        .select('id, item_id, institution_name, access_token')
        .eq('status', 'active');

    if (error) throw new Error(`Failed to fetch plaid_connections: ${error.message}`);
    if (!rows?.length) { console.log('No active connections found. Nothing to backfill.'); return; }

    console.log(`Found ${rows.length} active connection(s).\n`);

    let updated = 0, failed = 0;

    for (const row of rows) {
        try {
            const access_token = await decrypt(row.access_token);
            if (DRY_RUN) {
                console.log(`  ✓ [DRY] ${row.institution_name} (${row.item_id}) — would register webhook`);
            } else {
                await plaidClient.itemWebhookUpdate({ access_token, webhook: WEBHOOK_URL });
                console.log(`  ✓ ${row.institution_name} (${row.item_id}) — webhook registered`);
            }
            updated++;
        } catch (err) {
            console.error(`  ✗ ${row.institution_name} (${row.item_id}) — FAILED: ${err.response?.data?.error_message || err.message}`);
            failed++;
        }
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN' : 'COMPLETE'}: ${updated} registered, ${failed} failed`);
    if (failed > 0) {
        console.error('\n⚠️  Some connections failed — likely a dead/removed item on Plaid\'s side. Safe to ignore for items already flagged needs_reauth.');
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
