// The photographer's Profile Email is CC'd on invoice emails. Returns undefined
// (no CC) when it is missing, not a single valid address, or already the recipient.
const SINGLE_ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function photographerCc(profileEmail, clientEmail) {
    const cc = String(profileEmail || '').trim();
    if (!SINGLE_ADDRESS.test(cc)) return undefined;
    if (cc.toLowerCase() === String(clientEmail || '').trim().toLowerCase()) return undefined;
    return cc;
}

module.exports = { photographerCc };
