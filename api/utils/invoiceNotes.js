// Mirrors the frontend's presentation rule without changing persisted invoice notes.
function combineInvoiceNotes(profileNotes, invoiceNotes) {
    const profile = String(profileNotes || '').trim();
    const invoice = String(invoiceNotes || '').trim();
    if (!profile) return invoice;
    if (!invoice) return profile;
    const normalized = value => value.replace(/\s+/g, ' ');
    const containsNote = (text, note) => {
        const source = normalized(text);
        const target = normalized(note);
        let index = source.indexOf(target);
        while (index !== -1) {
            const before = source[index - 1];
            const after = source[index + target.length];
            if ((!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after))) return true;
            index = source.indexOf(target, index + 1);
        }
        return false;
    };
    if (containsNote(invoice, profile)) return invoice;
    if (containsNote(profile, invoice)) return profile;
    return `${profile}\n\n${invoice}`;
}

module.exports = { combineInvoiceNotes };
