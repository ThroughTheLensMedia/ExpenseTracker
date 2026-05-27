const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { encrypt, decrypt } = require("../utils/cryptoUtil");
const { loadVendorRules, normalizeVendor } = require("../utils/vendorRules");

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
    // Michelle Gornichec — add UUID here once confirmed
]);

// ─── 1. Create Link Token ───
router.post("/create-link-token", async (req, res) => {
    try {
        // Billing gate: all users must have a Stripe customer record before connecting.
        // Exempt list (PLAID_BILLING_EXEMPT) covers Joshua and Michelle only — no plan-type exceptions.
        if (!PLAID_BILLING_EXEMPT.has(req.user.id)) {
            const { data: sub } = await req.sb
                .from('user_subscriptions')
                .select('stripe_customer_id')
                .eq('user_id', req.user.id)
                .maybeSingle();

            if (!sub?.stripe_customer_id) {
                return res.status(402).json({
                    error: 'plaid_payment_required',
                    message: 'A billing method is required to use Live Bank Sync. Please set up your subscription first.',
                });
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

        for (const conn of connections) {
            const result = await syncTransactions(req.sb, client, conn, req.user.id);
            totalAdded    += result.added;
            totalModified += result.modified;
            totalRemoved  += result.removed;
            totalLinked   += result.linked;
        }

        res.json({
            ok: true,
            accounts:  connections.length,
            added:     totalAdded,
            modified:  totalModified,
            removed:   totalRemoved,
            linked:    totalLinked,  // existing CSV rows matched and stamped with Plaid ID
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
            .select("id, institution_name, institution_id, status, last_synced_at, created_at")
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
    try {
        const client = getPlaidClient();

        const { data: connections, error } = await req.sb
            .from("plaid_connections")
            .select("id, institution_name, last_synced_at, access_token")
            .eq("user_id", req.user.id)
            .eq("status", "active");

        if (error) throw error;
        if (!connections?.length) return res.json({ institutions: [] });

        const institutions = [];

        for (const conn of connections) {
            try {
                const access_token = await decrypt(conn.access_token);
                const resp = await client.accountsBalanceGet({ access_token });

                institutions.push({
                    id:               conn.id,
                    institution_name: conn.institution_name,
                    last_synced_at:   conn.last_synced_at,
                    accounts: resp.data.accounts.map(a => ({
                        account_id:    a.account_id,
                        name:          a.name,
                        official_name: a.official_name || null,
                        type:          a.type,
                        subtype:       a.subtype,
                        mask:          a.mask || null,
                        current:       a.balances.current,
                        available:     a.balances.available,
                        currency:      a.balances.iso_currency_code || 'USD',
                    })),
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
// exist (plaid_transaction_id IS NULL, same date + same amount_cents).
// If matched: stamp the Plaid transaction ID onto the existing row — preserving
// the user's category, notes, receipts, and tax flags — and skip insertion.
// If no match: insert as a new Plaid transaction.
async function crossSourceDedup(sb, userId, rows) {
    if (!rows.length) return { toInsert: [], linked: 0 };

    const dates = rows.map(r => r.expense_date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const { data: existing } = await sb
        .from('expenses')
        .select('id, expense_date, amount_cents')
        .eq('user_id', userId)
        .is('plaid_transaction_id', null)   // CSV / manual only
        .gte('expense_date', minDate)
        .lte('expense_date', maxDate);

    if (!existing?.length) return { toInsert: rows, linked: 0 };

    // Build a map: "date|amount_cents" → first unclaimed existing row id
    const lookup = new Map();
    for (const e of existing) {
        const key = `${e.expense_date}|${e.amount_cents}`;
        if (!lookup.has(key)) lookup.set(key, e.id);
    }

    const toInsert = [];
    const toLink   = []; // { existingId, plaid_transaction_id, plaid_account_id }
    const claimed  = new Set();

    for (const row of rows) {
        const key = `${row.expense_date}|${row.amount_cents}`;
        const existingId = lookup.get(key);
        if (existingId && !claimed.has(existingId)) {
            claimed.add(existingId);
            toLink.push({
                existingId,
                plaid_transaction_id: row.plaid_transaction_id,
                plaid_account_id: row.plaid_account_id || null,
            });
        } else {
            toInsert.push(row);
        }
    }

    // Stamp Plaid IDs + account ID onto existing CSV/manual rows
    for (const link of toLink) {
        await sb
            .from('expenses')
            .update({
                plaid_transaction_id: link.plaid_transaction_id,
                plaid_account_id:     link.plaid_account_id,
            })
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

async function syncTransactions(sb, plaidClient, connection, userId) {
    let cursor = connection.cursor;
    let added = 0;
    let modified = 0;
    let removed = 0;
    let linked = 0;
    let hasMore = true;
    const accountSourceMap = {}; // plaid account_id → readable source key

    // Load user's vendor category rules once — applied to every new transaction
    const vendorRules = await loadVendorRules(sb, userId);

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
            const rows = newTxns.map(t => {
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

            // Cross-source dedup: link existing CSV rows, insert only truly new ones
            const { toInsert, linked: linkCount } = await crossSourceDedup(sb, userId, rows);
            linked += linkCount;

            if (toInsert.length > 0) {
                const { error } = await sb
                    .from("expenses")
                    .upsert(toInsert, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
                if (error) console.error("[Plaid] Insert error:", error);
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

    return { added, modified, removed, linked };
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
