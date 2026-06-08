/**
 * rotate-plaid-tokens.js
 * Re-encrypts all Plaid access tokens with a new ENCRYPTION_KEY.
 *
 * Usage (run locally — never run on Vercel):
 *   OLD_ENCRYPTION_KEY=<current_key> ENCRYPTION_KEY=<new_key> node api/scripts/rotate-plaid-tokens.js
 *   OLD_ENCRYPTION_KEY=<current_key> ENCRYPTION_KEY=<new_key> node api/scripts/rotate-plaid-tokens.js --dry-run
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env (load from .env or set inline)
 *
 * The script will:
 *   1. Load all rows from plaid_items
 *   2. Decrypt each encrypted_access_token with OLD_ENCRYPTION_KEY
 *   3. Re-encrypt with new ENCRYPTION_KEY
 *   4. Update the row in DB (skipped in --dry-run mode)
 *   5. Print a summary
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const _sodium = require('libsodium-wrappers');

const DRY_RUN = process.argv.includes('--dry-run');

function getKey(hexEnvVar) {
    const hex = process.env[hexEnvVar];
    if (!hex) throw new Error(`${hexEnvVar} is not set`);
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) throw new Error(`${hexEnvVar} must be a 64-char hex string (32 bytes)`);
    return buf;
}

async function decryptWith(encrypted, key, sodium) {
    const parts = String(encrypted).split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted format');
    const nonce = Buffer.from(parts[0], 'base64');
    const cipher = Buffer.from(parts[1], 'base64');
    const msg = sodium.crypto_secretbox_open_easy(cipher, nonce, key);
    if (!msg) throw new Error('Decryption failed — wrong key or corrupted data');
    return sodium.to_string(msg);
}

async function encryptWith(plaintext, key, sodium) {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const msg = sodium.from_string(String(plaintext));
    const cipher = sodium.crypto_secretbox_easy(msg, nonce, key);
    return Buffer.from(nonce).toString('base64') + ':' + Buffer.from(cipher).toString('base64');
}

async function main() {
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be written\n' : '🔐 LIVE RUN — tokens will be re-encrypted\n');

    await _sodium.ready;
    const sodium = _sodium;

    const oldKey = getKey('OLD_ENCRYPTION_KEY');
    const newKey = getKey('ENCRYPTION_KEY');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: rows, error } = await supabase
        .from('plaid_items')
        .select('id, user_id, encrypted_access_token');

    if (error) throw new Error(`Failed to fetch plaid_items: ${error.message}`);
    if (!rows?.length) { console.log('No rows found in plaid_items. Nothing to rotate.'); return; }

    console.log(`Found ${rows.length} row(s) to rotate.\n`);

    let rotated = 0, failed = 0;

    for (const row of rows) {
        try {
            const plaintext = await decryptWith(row.encrypted_access_token, oldKey, sodium);
            const reEncrypted = await encryptWith(plaintext, newKey, sodium);

            if (DRY_RUN) {
                console.log(`  ✓ [DRY] Row ${row.id} (user ${row.user_id}) — would rotate`);
            } else {
                const { error: updateErr } = await supabase
                    .from('plaid_items')
                    .update({ encrypted_access_token: reEncrypted })
                    .eq('id', row.id);
                if (updateErr) throw new Error(updateErr.message);
                console.log(`  ✓ Row ${row.id} (user ${row.user_id}) — rotated`);
            }
            rotated++;
        } catch (err) {
            console.error(`  ✗ Row ${row.id} (user ${row.user_id}) — FAILED: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN' : 'COMPLETE'}: ${rotated} rotated, ${failed} failed`);
    if (failed > 0) {
        console.error('\n⚠️  Some rows failed. Do NOT update ENCRYPTION_KEY in Vercel until all rows succeed.');
        process.exit(1);
    }
    if (!DRY_RUN) {
        console.log('\nNext steps:');
        console.log('  1. Update ENCRYPTION_KEY in Vercel env panel to the new value');
        console.log('  2. git push origin main  (triggers redeploy)');
        console.log('  3. Verify Plaid sync still works for one account');
        console.log('  4. Delete OLD_ENCRYPTION_KEY from your local environment');
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
