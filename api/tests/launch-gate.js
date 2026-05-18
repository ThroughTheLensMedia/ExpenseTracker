/**
 * Lumière Ledger — Launch Gate Validation
 * Tests 3–6 from the security audit checklist.
 *
 * Usage:
 *   node api/tests/launch-gate.js
 *   node api/tests/launch-gate.js --local   (targets http://localhost:3000)
 *
 * Requires in env (loaded from .env automatically):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (needed for Test 6 cross-user isolation check)
 *
 * What it does:
 *   - Creates a temporary test user via Supabase admin API (email pre-confirmed, no inbox needed)
 *   - Runs tests 3–6 against the target URL
 *   - Deletes the test user on completion
 *   - Exits with code 1 if any test fails
 */

try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');

const isLocal   = process.argv.includes('--local');
const BASE_URL  = isLocal ? 'http://localhost:3000' : 'https://www.lumiereledger.com';
const SB_URL    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_ANON   = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SB_SVC    = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Admin user ID — used to find a target expense for cross-user test
const ADMIN_ID  = '49e7efcb-6434-4f0c-9563-3151a6d50df9';

const results = [];
let testToken  = null;
let testUserId = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function pass(name) {
    results.push({ ok: true, name });
    console.log(`  ✅  ${name}`);
}

function fail(name, detail) {
    results.push({ ok: false, name, detail });
    console.log(`  ❌  ${name}`);
    console.log(`       → ${detail}`);
}

function skip(name, reason) {
    results.push({ ok: null, name, reason });
    console.log(`  ⏭   ${name} — SKIPPED (${reason})`);
}

async function api(path, opts = {}) {
    const res = await fetch(`${BASE_URL}/api${path}`, opts);
    let body = {};
    try { body = await res.json(); } catch (_) {}
    return { status: res.status, body };
}

// ── Setup ──────────────────────────────────────────────────────────────────

async function createTestUser() {
    if (!SB_SVC) throw new Error('SUPABASE_SERVICE_ROLE_KEY required to create test user');
    const adminClient = createClient(SB_URL, SB_SVC);

    // Create user with email pre-confirmed — no inbox needed
    const email    = `lltest_${Date.now()}@testmail.internal`;
    const password = `LaunchGate!${Date.now()}`;

    const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });
    if (error) throw new Error(`Create user failed: ${error.message}`);

    // Sign in as that user to get a JWT
    const anonClient = createClient(SB_URL, SB_ANON);
    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInErr || !session.session) throw new Error(`Sign-in failed: ${signInErr?.message}`);

    testToken  = session.session.access_token;
    testUserId = data.user.id;
    console.log(`  Created test account: ${email} (${testUserId})\n`);
}

async function deleteTestUser() {
    if (!testUserId || !SB_SVC) return;
    const adminClient = createClient(SB_URL, SB_SVC);
    const { error } = await adminClient.auth.admin.deleteUser(testUserId);
    if (error) console.warn(`  ⚠️  Could not delete test user ${testUserId}: ${error.message}`);
    else console.log(`  Test account deleted.`);
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function test3_adminBetaCodesPost() {
    const { status } = await api('/admin/beta-codes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: 'free_beta', expires_days: 30, count: 1 }),
    });
    if (status === 403) pass('Test 3 — POST /admin/beta-codes as non-admin → 403');
    else fail('Test 3 — POST /admin/beta-codes as non-admin', `Expected 403, got ${status}`);
}

async function test4_adminBetaCodesDelete() {
    const { status } = await api('/admin/beta-codes/FAKECODE_DO_NOT_EXIST', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${testToken}` },
    });
    if (status === 403) pass('Test 4 — DELETE /admin/beta-codes as non-admin → 403');
    else fail('Test 4 — DELETE /admin/beta-codes as non-admin', `Expected 403, got ${status}`);
}

async function test5_mockSessionBlocked() {
    if (isLocal) {
        skip('Test 5 — mock-session bypass', 'Local mode — bypass is expected to work locally');
        return;
    }
    const { status } = await api('/expenses', {
        headers: { Authorization: 'Bearer mock-session' },
    });
    if (status === 401) pass('Test 5 — mock-session on production → 401');
    else fail('Test 5 — mock-session bypass', `Expected 401, got ${status} — dev bypass may be ACTIVE on Vercel`);
}

async function test6_crossUserIsolation() {
    if (!SB_SVC) {
        skip('Test 6 — cross-user expense isolation', 'SUPABASE_SERVICE_ROLE_KEY not available');
        return;
    }

    const adminClient = createClient(SB_URL, SB_SVC);

    // Fetch a real expense owned by the admin user
    const { data: expenses, error } = await adminClient
        .from('expenses')
        .select('id')
        .eq('user_id', ADMIN_ID)
        .limit(1);

    if (error || !expenses || expenses.length === 0) {
        skip('Test 6 — cross-user expense isolation', 'No admin expenses found to test against');
        return;
    }

    const targetId = expenses[0].id;

    // Attempt to delete admin's expense as the test (non-admin) user
    // DELETE endpoint returns 204 regardless of whether a row was matched,
    // so we verify isolation by confirming the expense still exists afterwards.
    await api(`/expenses/${targetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${testToken}` },
    });

    // Verify expense still exists via service role
    const { data: check } = await adminClient
        .from('expenses')
        .select('id')
        .eq('id', targetId)
        .eq('user_id', ADMIN_ID)
        .single();

    if (check && check.id === targetId) {
        pass('Test 6 — cross-user DELETE → expense still exists (isolation confirmed)');
    } else {
        fail('Test 6 — cross-user expense isolation', 'Expense was deleted by a different user — RLS or user_id filter may be broken');
    }
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function run() {
    console.log(`\n🔐 Lumière Ledger — Launch Gate Validation`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`  Target:  ${BASE_URL}`);
    console.log(`  Mode:    ${isLocal ? 'local' : 'production'}\n`);

    if (!SB_URL || !SB_ANON) {
        console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY are required. Check your .env file.');
        process.exit(1);
    }

    try {
        await createTestUser();
    } catch (err) {
        console.error(`❌ Setup failed: ${err.message}`);
        process.exit(1);
    }

    try {
        await test3_adminBetaCodesPost();
        await test4_adminBetaCodesDelete();
        await test5_mockSessionBlocked();
        await test6_crossUserIsolation();
    } finally {
        console.log('\nCleaning up...');
        await deleteTestUser();
    }

    // Summary
    const passed  = results.filter(r => r.ok === true).length;
    const failed  = results.filter(r => r.ok === false);
    const skipped = results.filter(r => r.ok === null).length;

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`RESULTS: ${passed} passed, ${failed.length} failed, ${skipped} skipped\n`);

    if (failed.length > 0) {
        console.log('FAILURES:');
        failed.forEach(r => console.log(`  ❌ ${r.name}\n     → ${r.detail}`));
        console.log('');
        process.exit(1);
    } else {
        console.log('All tests passed. ✅\n');
    }
}

run().catch(err => {
    console.error('\nTest runner crashed:', err.message);
    process.exit(1);
});
