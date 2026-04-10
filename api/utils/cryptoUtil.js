/**
 * Encryption Utility — STUB
 * Plaid integration is deferred. This stub satisfies the import contract
 * so the server can start. Replace with libsodium-wrappers implementation
 * when Plaid work begins.
 */

function encrypt(plaintext) {
    throw new Error('[CRYPTO] Plaid encryption not yet implemented. Deferred.');
}

function decrypt(encrypted) {
    throw new Error('[CRYPTO] Plaid decryption not yet implemented. Deferred.');
}

module.exports = { encrypt, decrypt };
