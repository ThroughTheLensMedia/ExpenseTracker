const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { encrypt, decrypt } = require("../utils/cryptoUtil");
const { loadVendorRules, normalizeVendor } = require("../utils/vendorRules");
const { supabase: adminClient } = require("../db");
const { scanForDuplicates } = require("./expenses");

// Plaid item error codes that mean the connection needs the user to re-authenticate
// via Plaid Link update mode — not a transient API hiccup.
const REAUTH_ERROR_CODES = new Set([
    'ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND',
    'INVALID_CREDENTIALS', 'INVALID_UPDATED_USERNAME', 'PENDING_EXPIRATION',
]);

/**
 * Plaid Integration Routes
 *
 * Flow:
 * 1. POST /plaid/create-link-token  → Generate a Plaid Link token for the frontend
 * 2. POST /plaid/exchange-token     → Exchange public_token for access_token, store it
 * 3. POST /plaid/sync               → Pull new transactions via Plaid Sync API
 * 4. GET  /plaid/accounts           → List connected bank accounts
 * 5. DELETE /plaid/accounts/:id     → Disconnect an account
 *
 * Requires: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV in .env
 * npm install plaid
 */

// Lazy-load Plaid client (only initialized when routes are actually called)
let _plaidClient = null;
function getPlaidClient() {
    if (_plaidClient) return _plaidClient;

    const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

    const plaidEnv = process.env.PLAID_ENV || "sandbox";
    const config = new Configuration({
        basePath: PlaidEnvironments[plaidEnv],
        baseOptions: {
            headers: {
                "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
                "PLAID-SECRET": process.env.PLAID_SECRET,
            },
        },
    });
    _plaidClient = new PlaidApi(config);
    return _plaidClient;
}

// Middleware: check Plaid is configured
function requirePlaidConfig(req, res, next) {
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
        return res.status(503).json({
            error: "Plaid is not configured.",
            detail: "Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV in your environment."
        });
    }
    next();
}

router.use(requirePlaidConfig);

// Users exempt from Plaid billing — Joshua pays Plaid directly; Michelle is comped.
const PLAID_BILLING_EXEMPT = new Set([
    '49e7efcb-6434-4f0c-9563-3151a6d50df9', // Joshua Deuermeyer (admin)
    'fcb92809-70f1-4ae0-b39c-e317378a01a7', // Michelle Gornichec (gornichecme@gmail.com)
]);

// ─── 1. Create Link Token ───
// Pass { connection_id } to open Plaid Link in UPDATE MODE for an existing item
// that needs reconnecting (e.g. needs_reauth = true) instead of creating a new item.
// Update mode skips the billing/account-limit gates — it's not a new connection.
router.post("/create-link-token", async (req, res) => {
    try {
        const { connection_id } = req.body || {};

        if (connection_id) {
            const { data: conn, error: connErr } = await req.sb
                .from("plaid_connections")
                .select("id, access_token")
                .eq("id", connection_id)
                .eq("user_id", req.user.id)
                .single();
            if (connErr || !conn) return res.status(404).json({ error: "Connection not found." });

            const access_token = await decrypt(conn.access_token);
            const client = getPlaidClient();
            const response = await client.linkTokenCreate({
                user: { client_user_id: req.user.id },
                client_name: "Lumière Ledger",
                country_codes: ["US"],
                language: "en",
                access_token, // update mode — re-auth this exact item, no new item created
            });
            return res.json({ link_token: response.data.link_token });
        }

        // Billing gate: all users must have a Stripe customer record before connecting.
        // Exempt list (PLAID_BILLING_EXEMPT) covers Joshua and Michelle only — no plan-type exceptions.
        if (!PLAID_BILLING_EXEMPT.has(req.user.id)) {
            const { data: sub } = await req.sb
                .from('user_subscriptions')
                .select('stripe_customer_id, plan_type')
                .eq('user_id', req.user.id)
                .maybeSingle();

            if (!sub?.stripe_customer_id) {
                return res.status(402).json({
                    error: 'plaid_payment_required',
                    message: 'A billing method is required to use Live Bank Sync. Please set up your subscription first.',
                });
            }

            // Sync plan: max 5 connected institutions
            const SYNC_PLANS = new Set(['sync_monthly', 'sync_annual']);
            if (SYNC_PLANS.has(sub?.plan_type)) {
                const { count } = await req.sb
                    .from('plaid_connections')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', req.user.id)
                    .eq('status', 'active');
                if ((count || 0) >= 5) {
                    return res.status(403).json({
                        error: 'plaid_account_limit',
                        message: 'Sync plan allows up to 5 connected accounts. Upgrade to Core or Studio for unlimited connections.',
                    });
                }
            }
        }

        const client = getPlaidClient();
        const response = await client.linkTokenCreate({
            user: { client_user_id: req.user.id },
            client_name: "Lumière Ledger",
            products: ["transactions"],
            country_codes: ["US"],
            language: "en",
        });
        res.json({ link_token: response.data.link_token });
    } catch (e) {
        if (e.status === 402) throw e; // re-throw billing gate errors
        console.error("[Plaid] Link token error:", e.response?.data || e.message);
        res.status(500).json({ error: "Failed to create Plaid link token." });
    }
});

// ─── 2. Exchange Public Token ───
const exchangeSchema = z.object({
    public_token: z.string().min(1),
    institution: z.object({
        institution_id: z.string(),
        name: z.string(),
    }).optional(),
});

router.post("/exchange-token", async (req, res) => {
    try {
        const { public_token, institution } = exchangeSchema.parse(req.body);
        const client = getPlaidClient();

        // Exchange for permanent access token
        const tokenResp = await client.itemPublicTokenExchange({ public_token });
        const { access_token, item_id } = tokenResp.data;

        // Encrypt access token before storage
        let encrypted_access_token;
        try {
            encrypted_access_token = await encrypt(access_token);
        } catch (err) {
            console.error("[Plaid] Encryption failed:", err.message);
            return res.status(500).json({ error: "Failed to secure access token." });
        }

        // Store in plaid_connections table (encrypted)
        const { data, error } = await req.sb
            .from("plaid_connections")
            .upsert({
                user_id: req.user.id,
                item_id,
                access_token: encrypted_access_token,
                institution_id: institution?.institution_id || null,
                institution_name: institution?.name || "Unknown Bank",
                status: "active",
                needs_reauth: false,
                last_item_error: null,
                cursor: null,
                last_synced_at: null,
            }, { onConflict: "item_id" })
            .select()
            .single();

        if (error) throw error;

        // Immediately trigger initial sync
        const syncResult = await syncTransactions(req.sb, client, data, req.user.id);

        res.json({
            ok: true,
            connection: { id: data.id, institution_name: data.institution_name },
            synced: syncResult.added,
        });
    } catch (e) {
        console.error("[Plaid] Exchange error:", e.response?.data || e.message);
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid request body." });
        res.status(500).json({ error: "Failed to connect bank account." });
    }
});

// ─── 3. Sync Transactions ───
router.post("/sync", async (req, res) => {
    try {
        const client = getPlaidClient();

        // Get all active connections for this user
        const { data: connections, error } = await req.sb
            .from("plaid_connections")
            .select("*")
            .eq("user_id", req.user.id)
            .eq("status", "active");

        if (error) throw error;
        if (!connections || connections.length === 0) {
            return res.json({ ok: true, message: "No connected accounts.", synced: 0 });
        }

        let totalAdded = 0;
        let totalModified = 0;
        let totalRemoved = 0;
        let totalLinked = 0;
        let totalFlagged = 0;

        for (const conn of connections) {
            const result = await syncTransactions(req.sb, client, conn, req.user.id);
            totalAdded    += result.added;
            totalModified += result.modified;
            totalRemoved  += result.removed;
            totalLinked   += result.linked;
            totalFlagged  += result.flagged || 0;
        }

        res.json({
            ok: true,
            accounts:  connections.length,
            added:     totalAdded,
            modified:  totalModified,
            removed:   totalRemoved,
            linked:    totalLinked,  // existing CSV rows matched and stamped with Plaid ID
            flagged:   totalFlagged, // possible-duplicate pairs auto-flagged for review this sync
        });
    } catch (e) {
        console.error("[Plaid] Sync error:", e.response?.data || e.message);
        res.status(500).json({ error: "Transaction sync failed." });
    }
});

// ─── 4. List Connected Accounts ───
router.get("/accounts", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("plaid_connections")
            .select("id, institution_name, institution_id, status, last_synced_at, created_at, needs_reauth, last_item_error")
            .eq("user_id", req.user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        res.json({ accounts: data || [] });
    } catch (e) {
        console.error("[Plaid] List accounts error:", e.message);
        res.status(500).json({ error: "Failed to fetch accounts." });
    }
});

// ─── 5. Live Balances ───
// Returns current + available balances for every sub-account across all active connections.
// Real-time Plaid API call — keep out of the main summary endpoint so page load stays fast.
router.get("/balances", async (req, res) => {
    const BALANCE_TTL_MS = 10 * 24 * 60 * 60 * 1000; // 10 days — each call costs money

    try {
        const client = getPlaidClient();

        const { data: connections, error } = await req.sb
            .from("plaid_connections")
            .select("id, institution_name, last_synced_at, access_token, last_balance_sync, cached_balances")
            .eq("user_id", req.user.id)
            .eq("status", "active");

        if (error) throw error;
        if (!connections?.length) return res.json({ institutions: [] });

        const institutions = [];

        for (const conn of connections) {
            // Serve from DB cache if within 10-day TTL — avoids paid Plaid API call
            const lastSync = conn.last_balance_sync ? new Date(conn.last_balance_sync).getTime() : 0;
            const isFresh = lastSync && (Date.now() - lastSync) < BALANCE_TTL_MS;

            if (isFresh && conn.cached_balances?.length) {
                institutions.push({
                    id:               conn.id,
                    institution_name: conn.institution_name,
                    last_synced_at:   conn.last_synced_at,
                    accounts:         conn.cached_balances,
                    balance_cached:   true,
                });
                continue;
            }

            try {
                const access_token = await decrypt(conn.access_token);
                const resp = await client.accountsBalanceGet({ access_token });

                const accounts = resp.data.accounts.map(a => ({
                    account_id:    a.account_id,
                    name:          a.name,
                    official_name: a.official_name || null,
                    type:          a.type,
                    subtype:       a.subtype,
                    mask:          a.mask || null,
                    current:       a.balances.current,
                    available:     a.balances.available,
                    currency:      a.balances.iso_currency_code || 'USD',
                }));

                // Persist to DB so all devices/sessions share the same 10-day cache
                await adminClient
                    .from("plaid_connections")
                    .update({ last_balance_sync: new Date().toISOString(), cached_balances: accounts })
                    .eq("id", conn.id);

                institutions.push({
                    id:               conn.id,
                    institution_name: conn.institution_name,
                    last_synced_at:   conn.last_synced_at,
                    accounts,
                });
            } catch (e) {
                const errCode = e.response?.data?.error_code || e.response?.data?.error_type || e.message || 'UNKNOWN';
                const needsReauth = ['ITEM_LOGIN_REQUIRED', 'INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND', 'INVALID_CREDENTIALS'].includes(errCode);
                console.error(`[Plaid] Balance fetch failed for ${conn.institution_name}: ${errCode}`);
                institutions.push({
                    id:               conn.id,
                    institution_name: conn.institution_name,
                    last_synced_at:   conn.last_synced_at,
                    accounts:         [],
                    balance_error:    true,
                    error_code:       errCode,
                    needs_reauth:     needsReauth,
                });
            }
        }

        res.json({ institutions });
    } catch (e) {
        console.error("[Plaid] Balances error:", e.message);
        res.status(500).json({ error: "Failed to fetch balances." });
    }
});

// ─── 6. Disconnect Account ───
router.delete("/accounts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const client = getPlaidClient();

        // Get connection to remove from Plaid
        const { data: conn, error: fetchErr } = await req.sb
            .from("plaid_connections")
            .select("*")
            .eq("id", id)
            .eq("user_id", req.user.id)
            .single();

        if (fetchErr || !conn) return res.status(404).json({ error: "Account not found." });

        // Remove from Plaid (decrypt token first)
        try {
            const access_token = await decrypt(conn.access_token);
            await client.itemRemove({ access_token });
        } catch (_) { /* Plaid may already have removed it, or decryption failed */ }

        // Soft-delete: mark as disconnected
        await req.sb
            .from("plaid_connections")
            .update({ status: "disconnected" })
            .eq("id", id);

        res.json({ ok: true, message: `${conn.institution_name} disconnected.` });
    } catch (e) {
        console.error("[Plaid] Disconnect error:", e.message);
        res.status(500).json({ error: "Failed to disconnect account." });
    }
});

// ─── DELETE /plaid/link/:source_key ──────────────────────────────────────────
// Break the Plaid cross-match on a specific CSV source.
// Clears plaid_transaction_id on all expenses for that source (user-scoped).
// Does NOT remove the Plaid bank connection — no billing impact.
router.delete('/link/:source_key', async (req, res) => {
    try {
        const { source_key } = req.params;
        if (!source_key) return res.status(400).json({ error: 'source_key required' });

        const { error } = await req.sb
            .from('expenses')
            .update({ plaid_transaction_id: null })
            .eq('user_id', req.user.id)
            .eq('source', source_key)
            .not('plaid_transaction_id', 'is', null);

        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        console.error('[plaid] unlink error:', err.message);
        res.status(500).json({ error: 'Failed to unlink account' });
    }
});

// ─── Cross-source dedup ───────────────────────────────────────────────────────
// Before inserting Plaid transactions, check whether CSV/manual versions already
// exist (plaid_transaction_id IS NULL, same amount_cents within ±2 days).
//
// Uses a ±2 day window (not exact date) to handle settlement date skew — e.g.
// a transaction entered manually on 2026-05-28 that Plaid reports as 2026-05-29
// due to bank clearing delay.
//
// When multiple candidates exist for the same amount/window, prefer the record
// with the most enrichment (receipt > notes > category > manual source).
//
// On link: also update vendor to the official Plaid merchant name if the existing
// vendor is a substring of it (e.g. "Crafted" → "Crafted Terminal").
//
// If matched: stamp plaid_transaction_id onto the existing row, preserving all
// user enrichment — and skip insertion.
// If no match: insert as a new Plaid transaction.
function addDaysToDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
    return Math.abs((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
}

function enrichmentScore(e) {
    // Higher = more enriched = preferred candidate to keep
    return (e.receipt_link ? 4 : 0) + (e.notes ? 2 : 0) + (e.category ? 1 : 0);
}

async function crossSourceDedup(sb, userId, rows) {
    if (!rows.length) return { toInsert: [], linked: 0 };

    // Expand date window by ±2 days to catch settlement date skew
    const dates = rows.map(r => r.expense_date);
    const minDate = addDaysToDate(dates.reduce((a, b) => (a < b ? a : b)), -2);
    const maxDate = addDaysToDate(dates.reduce((a, b) => (a > b ? a : b)),  2);

    const { data: existing } = await sb
        .from('expenses')
        .select('id, expense_date, amount_cents, vendor, receipt_link, notes, category, source')
        .eq('user_id', userId)
        .is('plaid_transaction_id', null)   // CSV / manual only — not already linked
        .gte('expense_date', minDate)
        .lte('expense_date', maxDate);

    if (!existing?.length) return { toInsert: rows, linked: 0 };

    // Build amount → candidates list (all rows with that amount in the window)
    const byAmount = new Map();
    for (const e of existing) {
        const k = String(e.amount_cents);
        if (!byAmount.has(k)) byAmount.set(k, []);
        byAmount.get(k).push(e);
    }

    const toInsert = [];
    const toLink   = []; // { existingId, plaid_transaction_id, plaid_account_id, plaidVendor }
    const claimed  = new Set();

    for (const row of rows) {
        const candidates = (byAmount.get(String(row.amount_cents)) || [])
            .filter(e => !claimed.has(e.id) && daysBetween(e.expense_date, row.expense_date) <= 2);

        if (!candidates.length) {
            toInsert.push(row);
            continue;
        }

        // Pick best candidate: highest enrichment score, then closest date
        candidates.sort((a, b) => {
            const scoreDiff = enrichmentScore(b) - enrichmentScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return daysBetween(a.expense_date, row.expense_date) - daysBetween(b.expense_date, row.expense_date);
        });

        const best = candidates[0];
        claimed.add(best.id);
        toLink.push({
            existingId:          best.id,
            existingVendor:      best.vendor,
            plaid_transaction_id: row.plaid_transaction_id,
            plaid_account_id:    row.plaid_account_id || null,
            plaidVendor:         row.vendor,
        });
    }

    // Stamp Plaid IDs onto existing rows; update vendor to official Plaid name
    // if the existing name is a substring (e.g. "Crafted" → "Crafted Terminal")
    for (const link of toLink) {
        const update = {
            plaid_transaction_id: link.plaid_transaction_id,
            plaid_account_id:     link.plaid_account_id,
        };
        const existingLower = (link.existingVendor || '').toLowerCase();
        const plaidLower    = (link.plaidVendor    || '').toLowerCase();
        if (plaidLower && existingLower && plaidLower !== existingLower &&
            plaidLower.includes(existingLower)) {
            update.vendor = link.plaidVendor; // upgrade to official name
        }
        await sb.from('expenses').update(update)
            .eq('id', link.existingId)
            .eq('user_id', userId);
    }

    return { toInsert, linked: toLink.length };
}

// ─── Sync Engine ───
// Build a readable source key from institution name + account subtype.
// Credit accounts append the last-4 mask to prevent collision when a user has
// multiple cards at the same institution (e.g. Amex Delta + Amex Gold would both
// map to "American Express Credit Card" without the mask suffix).
function makePlaidSourceKey(institutionName, account) {
    const sub = (account?.subtype || account?.type || '')
        .replace(/\b\w/g, c => c.toUpperCase()); // title-case
    const base = sub ? `${institutionName} ${sub}` : institutionName;
    // Append mask for credit accounts — avoids source key collision across multiple cards
    if (account?.type === 'credit' && account?.mask) {
        return `${base} ···${account.mask}`;
    }
    return base;
}

/**
 * matchPendingReceipts(sb, userId, newExpenses)
 * Pass 2 of email receipt matching. After Plaid inserts new transactions,
 * check pending_receipts for any that match on amount_cents + date ±3 days.
 * On match: attach file_path to expense receipt_link, delete pending record.
 */
async function matchPendingReceipts(sb, userId, newExpenses) {
    try {
        const { data: pending } = await sb
            .from('pending_receipts')
            .select('*')
            .eq('user_id', userId);

        if (!pending || pending.length === 0) return;

        for (const pr of pending) {
            if (!pr.amount_cents || !pr.receipt_date) continue;

            const base = new Date(pr.receipt_date + 'T12:00:00Z');
            const from = new Date(base); from.setDate(base.getDate() - 3);
            const to   = new Date(base); to.setDate(base.getDate() + 3);
            const fromStr = from.toISOString().slice(0, 10);
            const toStr   = to.toISOString().slice(0, 10);

            const match = newExpenses.find(e =>
                e.amount_cents === pr.amount_cents &&
                e.expense_date >= fromStr &&
                e.expense_date <= toStr
            );

            if (match) {
                await sb.from('expenses')
                    .update({ receipt_link: pr.file_path, updated_at: new Date().toISOString() })
                    .eq('id', match.id)
                    .eq('user_id', userId);

                await sb.from('pending_receipts').delete().eq('id', pr.id);

                console.log(`[Plaid] Pass-2 receipt match: pending ${pr.id} → expense ${match.id} ($${(pr.amount_cents / 100).toFixed(2)})`);
            }
        }
    } catch (err) {
        console.error('[Plaid] matchPendingReceipts error:', err.message);
    }
}

async function syncTransactions(sb, plaidClient, connection, userId) {
    let cursor = connection.cursor;
    let added = 0;
    let modified = 0;
    let removed = 0;
    let linked = 0;
    let hasMore = true;
    const accountSourceMap = {}; // plaid account_id → readable source key
    const touchedSources = new Set(); // source keys touched this sync — scoped input for the post-sync dup scan

    // Load user's vendor category rules once — applied to every new transaction
    const vendorRules = await loadVendorRules(sb, userId);

    // Item health check — Plaid's own item.error is the definitive signal for "this
    // connection is broken and needs the user to relink," as opposed to a transient
    // sync hiccup. A silently-degraded item (e.g. stuck in Plaid's internal "Retrying"
    // extraction state) previously gave no signal at all — sync calls kept succeeding
    // with zero new transactions and last_synced_at kept updating, so nothing ever told
    // the user to reconnect. This surfaces that state to the Accounts page.
    try {
        const healthAccess = await decrypt(connection.access_token);
        const itemResp = await plaidClient.itemGet({ access_token: healthAccess });
        const itemError = itemResp.data.item?.error || null;
        await sb
            .from('plaid_connections')
            .update({
                needs_reauth:     !!itemError && REAUTH_ERROR_CODES.has(itemError.error_code),
                last_item_error:  itemError ? `${itemError.error_code}: ${itemError.error_message}` : null,
            })
            .eq('id', connection.id);
    } catch (err) {
        console.warn('[Plaid] Item health check failed:', err.response?.data || err.message);
    }

    // Fetch account names upfront — accountsGet always returns accounts regardless of cursor state
    try {
        const acctAccess = await decrypt(connection.access_token);
        const acctResp = await plaidClient.accountsGet({ access_token: acctAccess });
        for (const acct of (acctResp.data.accounts || [])) {
            accountSourceMap[acct.account_id] = makePlaidSourceKey(connection.institution_name, acct);
        }
        console.log(`[Plaid] Account map for ${connection.institution_name}:`, accountSourceMap);
    } catch (err) {
        console.warn('[Plaid] Could not fetch account names — will fall back to institution name:', err.message);
    }

    while (hasMore) {
        // Decrypt access token for API call
        let access_token;
        try {
            access_token = await decrypt(connection.access_token);
        } catch (err) {
            console.error("[Plaid] Decryption failed:", err.message);
            throw new Error("Failed to decrypt access token");
        }

        const syncResp = await plaidClient.transactionsSync({
            access_token,
            cursor: cursor || undefined,
        });

        const { added: newTxns, modified: modTxns, removed: remTxns, next_cursor, has_more } = syncResp.data;

        // Process added transactions
        if (newTxns.length > 0) {
            // Pending→posted transitions: Plaid tells us directly via pending_transaction_id
            // which old row this new one replaces. Merge into that row in place instead of
            // inserting a fresh row and separately deciding delete-vs-unlink later — that old
            // two-step approach is what caused permanent duplicate rows (see PLAID dedup fix notes).
            // Any receipt/notes/category/tax data already on the row is preserved untouched.
            const pendingIds = newTxns.filter(t => t.pending_transaction_id).map(t => t.pending_transaction_id);
            const existingPendingMap = {};
            if (pendingIds.length > 0) {
                const { data: existingPending } = await sb
                    .from('expenses')
                    .select('id, plaid_transaction_id, vendor')
                    .eq('user_id', userId)
                    .in('plaid_transaction_id', pendingIds);
                for (const row of (existingPending || [])) {
                    existingPendingMap[row.plaid_transaction_id] = row;
                }
            }

            const freshTxns = [];
            for (const t of newTxns) {
                const oldRow = t.pending_transaction_id ? existingPendingMap[t.pending_transaction_id] : null;
                if (!oldRow) { freshTxns.push(t); continue; }

                const vendorName = t.merchant_name || t.name || "Unknown";
                const update = {
                    plaid_transaction_id: t.transaction_id,
                    plaid_account_id:    t.account_id || null,
                    expense_date:        t.date,
                    amount_cents:        Math.round((t.amount || 0) * 100),
                    source:              accountSourceMap[t.account_id] || connection.institution_name,
                };
                // Only refresh vendor if it still looks like the auto-Plaid name upgrading to a
                // fuller official name (e.g. "Crafted" → "Crafted Terminal") — never overwrite a
                // name the user manually retyped.
                const oldLower = (oldRow.vendor || '').toLowerCase();
                const newLower = vendorName.toLowerCase();
                if (newLower && oldLower && newLower !== oldLower && newLower.includes(oldLower)) {
                    update.vendor = vendorName;
                }

                await sb.from('expenses').update(update).eq('id', oldRow.id).eq('user_id', userId);
                touchedSources.add(update.source);
                modified++;
            }

            const rows = freshTxns.map(t => {
                const vendorName = t.merchant_name || t.name || "Unknown";
                // Check if user has a saved rule for this vendor
                const rule = vendorRules[normalizeVendor(vendorName)];
                return {
                    user_id:             userId,
                    expense_date:        t.date,
                    vendor:              vendorName,
                    amount_cents:        Math.round((t.amount || 0) * 100),
                    // Rule takes priority over Plaid's auto-category
                    category:         rule?.category         ?? mapPlaidCategory(t.personal_finance_category),
                    tax_bucket:       rule?.tax_bucket       ?? '',
                    // Auto-deductible: if a business tax bucket is set via rule, mark deductible
                    tax_deductible:   rule?.tax_deductible   ?? (rule?.tax_bucket && rule.tax_bucket !== 'Personal Expense' ? true : false),
                    business_use_pct: rule?.business_use_pct ?? 100,
                    source:              accountSourceMap[t.account_id] || connection.institution_name,
                    notes:               `Plaid: ${t.name || ''} | ${connection.institution_name}`,
                    plaid_transaction_id: t.transaction_id,
                    plaid_account_id:    t.account_id || null,
                };
            });
            rows.forEach(r => touchedSources.add(r.source));

            // Cross-source dedup: link existing CSV rows, insert only truly new ones
            const { toInsert, linked: linkCount } = await crossSourceDedup(sb, userId, rows);
            linked += linkCount;

            if (toInsert.length > 0) {
                const { data: inserted, error } = await sb
                    .from("expenses")
                    .upsert(toInsert, { onConflict: "plaid_transaction_id", ignoreDuplicates: true })
                    .select('id, amount_cents, expense_date');
                if (error) console.error("[Plaid] Insert error:", error);

                // Pass 2: match newly inserted transactions to any pending email receipts
                if (inserted && inserted.length > 0) {
                    await matchPendingReceipts(sb, userId, inserted);
                }
            }
            added += toInsert.length;
        }

        // Process modified transactions — also keep source key current
        for (const t of modTxns) {
            const sourceKey = accountSourceMap[t.account_id] || connection.institution_name;
            await sb
                .from("expenses")
                .update({
                    expense_date:  t.date,
                    vendor:        t.merchant_name || t.name || "Unknown",
                    amount_cents:  Math.round((t.amount || 0) * 100),
                    source:        sourceKey,
                })
                .eq("plaid_transaction_id", t.transaction_id)
                .eq("user_id", userId);
            touchedSources.add(sourceKey);
            modified++;
        }

        // Process removed transactions
        // Plaid removes transactions on pending→posted transitions, corrections, and reversals.
        // Before deleting, check if the user has attached data worth preserving.
        // If so, unlink the Plaid IDs instead of deleting — the row becomes a manual record.
        for (const t of remTxns) {
            const { data: existing } = await sb
                .from('expenses')
                .select('id, notes, receipt_link, tax_deductible')
                .eq('plaid_transaction_id', t.transaction_id)
                .eq('user_id', userId)
                .maybeSingle();

            const hasUserData = existing && (
                (existing.notes && existing.notes.trim().length > 0) ||
                existing.receipt_link ||
                existing.tax_deductible === true
            );

            if (hasUserData) {
                // Preserve user-attached data — detach from Plaid, keep as manual record
                await sb
                    .from('expenses')
                    .update({ plaid_transaction_id: null, plaid_account_id: null })
                    .eq('plaid_transaction_id', t.transaction_id)
                    .eq('user_id', userId);
            } else {
                await sb
                    .from('expenses')
                    .delete()
                    .eq('plaid_transaction_id', t.transaction_id)
                    .eq('user_id', userId);
            }
            removed++;
        }

        cursor = next_cursor;
        hasMore = has_more;
    }

    // Source key repair — runs on every sync to keep all transactions consistent.
    // Pass 1: rows with known plaid_account_id → ensure they use the current source key.
    // Uses .neq() so rows already correct are skipped (no-op update = no write cost).
    // This also self-heals when source key logic changes (e.g. mask suffix added for credit cards).
    for (const [account_id, sourceKey] of Object.entries(accountSourceMap)) {
        await sb
            .from('expenses')
            .update({ source: sourceKey })
            .eq('user_id', userId)
            .eq('plaid_account_id', account_id)
            .neq('source', sourceKey); // only touch rows that are actually wrong
    }
    // Pass 2: rows with NULL plaid_account_id still stuck on 'plaid' → fall back to institution name
    await sb
        .from('expenses')
        .update({ source: connection.institution_name })
        .eq('user_id', userId)
        .is('plaid_account_id', null)
        .eq('source', 'plaid');

    // Update cursor
    await sb
        .from("plaid_connections")
        .update({ cursor, last_synced_at: new Date().toISOString() })
        .eq("id", connection.id);

    // Auto-flag possible duplicates on every source this sync touched — early-warning
    // safety net on top of the pending→posted merge fix above, and the only thing that
    // catches duplicates that predate this fix (e.g. already sitting in the ledger).
    // Reuses the same needs_review/review_pair_id flow as the manual "Scan for duplicates"
    // button, so flagged pairs show up with the existing 🚩 badge + review modal — no new UI.
    let flagged = 0;
    for (const source of touchedSources) {
        try {
            const result = await scanForDuplicates(sb, userId, source);
            flagged += result.found;
        } catch (err) {
            console.error(`[Plaid] Dup scan failed for source "${source}":`, err.message);
        }
    }

    return { added, modified, removed, linked, flagged };
}

// Map Plaid's personal_finance_category to Lumière Ledger categories
function mapPlaidCategory(plaidCat) {
    if (!plaidCat) return '';
    const primary = plaidCat.primary || '';
    const detailed = plaidCat.detailed || '';

    const MAP = {
        'FOOD_AND_DRINK': 'Dining & Drinks',
        'TRANSPORTATION': 'Auto & Transport',
        'TRAVEL': 'Travel & Vacation',
        'ENTERTAINMENT': 'Entertainment',
        'GENERAL_MERCHANDISE': 'Shopping',
        'PERSONAL_CARE': 'Personal Care',
        'MEDICAL': 'Health & Medical',
        'RENT_AND_UTILITIES': 'Bills & Utilities',
        'GOVERNMENT_AND_NON_PROFIT': 'Taxes & Licenses',
        'GENERAL_SERVICES': 'Professional Services',
        'HOME_IMPROVEMENT': 'Home & Garden',
        'INCOME': 'Photo Income',
        'TRANSFER_IN': 'Photo Income',
    };

    // Detailed overrides
    if (detailed.includes('GAS_STATION')) return 'Gas & Fuel';
    if (detailed.includes('GROCERIES')) return 'Groceries';
    if (detailed.includes('PARKING')) return 'Parking & Tolls';
    if (detailed.includes('INSURANCE')) return 'Insurance (Personal)';
    if (detailed.includes('SOFTWARE')) return 'Software & Tech';
    if (detailed.includes('SUBSCRIPTION')) return 'Subscriptions';

    return MAP[primary] || '';
}

module.exports = router;
