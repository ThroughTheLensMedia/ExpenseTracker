/**
 * encrypt-existing-gemini-keys.js
 * One-time migration: encrypts any plaintext settings.gemini_api_key values
 * in place, using the CURRENT ENCRYPTION_KEY (same key already used for
 * Plaid tokens — no key rotation here, just plaintext -> encrypted).
 *
 * Usage (run locally — never run on Vercel):
 *   ENCRYPTION_KEY=<current_key> node api/scripts/encrypt-existing-gemini-keys.js --dry-run
 *   ENCRYPTION_KEY=<current_key> node api/scripts/encrypt-existing-gemini-keys.js
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY in env
 *
 * Idempotent — safe to re-run. Each row is decrypt-tested first; rows that
 * already decrypt successfully (already migrated) are skipped.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt } = require('../utils/cryptoUtil');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be written\n' : '🔐 LIVE RUN — plaintext keys will be encrypted\n');

    if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: rows, error } = await supabase
        .from('settings')
        .select('user_id, gemini_api_key')
        .not('gemini_api_key', 'is', null);

    if (error) throw new Error(`Failed to fetch settings: ${error.message}`);
    if (!rows?.length) { console.log('No rows with a gemini_api_key found. Nothing to migrate.'); return; }

    console.log(`Found ${rows.length} row(s) with a key set.\n`);

    let migrated = 0, alreadyDone = 0, failed = 0;

    for (const row of rows) {
        try {
            // If this already decrypts cleanly, it was migrated in a prior run.
            await decrypt(row.gemini_api_key);
            alreadyDone++;
            console.log(`  · User ${row.user_id} — already encrypted, skipped`);
        } catch {
            try {
                const encrypted = await encrypt(row.gemini_api_key);
                if (DRY_RUN) {
                    console.log(`  ✓ [DRY] User ${row.user_id} — would encrypt`);
                } else {
                    const { error: updateErr } = await supabase
                        .from('settings')
                        .update({ gemini_api_key: encrypted })
                        .eq('user_id', row.user_id);
                    if (updateErr) throw new Error(updateErr.message);
                    console.log(`  ✓ User ${row.user_id} — encrypted`);
                }
                migrated++;
            } catch (err) {
                console.error(`  ✗ User ${row.user_id} — FAILED: ${err.message}`);
                failed++;
            }
        }
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN' : 'COMPLETE'}: ${migrated} migrated, ${alreadyDone} already encrypted, ${failed} failed`);
    if (failed > 0) {
        console.error('\n⚠️  Some rows failed — investigate before considering the migration done.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
