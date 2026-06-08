/**
 * tokenUtils.js
 * Deterministic per-user token derivation for receipt email forwarding.
 * Token = first 12 hex chars of HMAC-SHA256(RECEIPT_HMAC_SECRET, userId).
 * Same userId always produces the same token — no DB column required for generation,
 * but token is stored in settings.receipt_token for fast inbound lookup.
 */

const crypto = require('crypto');

/**
 * deriveReceiptToken(userId)
 * Returns a 12-char hex string unique to this user.
 * Requires RECEIPT_HMAC_SECRET env var.
 */
function deriveReceiptToken(userId) {
    const secret = process.env.RECEIPT_HMAC_SECRET;
    if (!secret) throw new Error('RECEIPT_HMAC_SECRET env var is not set');
    return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 12);
}

module.exports = { deriveReceiptToken };
