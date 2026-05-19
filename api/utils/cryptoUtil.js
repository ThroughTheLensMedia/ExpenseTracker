/**
 * Encryption Utility — libsodium-wrappers (secretbox)
 * Used by Plaid routes to encrypt/decrypt access tokens before DB storage.
 *
 * Env: ENCRYPTION_KEY — 32-byte key as 64-char hex string
 *   Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Set in Vercel env panel before Plaid goes live.
 *
 * Format: "<nonce_base64>:<ciphertext_base64>"
 */

'use strict';

const _sodium = require('libsodium-wrappers');

let _sodium_ready = null;

async function getSodium() {
    if (!_sodium_ready) {
        _sodium_ready = _sodium.ready.then(() => _sodium);
    }
    return _sodium_ready;
}

function getKey() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) throw new Error('[CRYPTO] ENCRYPTION_KEY is not set in environment');
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) throw new Error('[CRYPTO] ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
    return buf;
}

async function encrypt(plaintext) {
    const sodium = await getSodium();
    const key = getKey();
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const msg = sodium.from_string(String(plaintext));
    const cipher = sodium.crypto_secretbox_easy(msg, nonce, key);
    return Buffer.from(nonce).toString('base64') + ':' + Buffer.from(cipher).toString('base64');
}

async function decrypt(encrypted) {
    const sodium = await getSodium();
    const key = getKey();
    const parts = String(encrypted).split(':');
    if (parts.length !== 2) throw new Error('[CRYPTO] Invalid encrypted format');
    const nonce = Buffer.from(parts[0], 'base64');
    const cipher = Buffer.from(parts[1], 'base64');
    const msg = sodium.crypto_secretbox_open_easy(cipher, nonce, key);
    if (!msg) throw new Error('[CRYPTO] Decryption failed — wrong key or corrupted data');
    return sodium.to_string(msg);
}

module.exports = { encrypt, decrypt };
