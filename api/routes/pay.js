const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { sendInvoiceApprovalEmail } = require('../utils/mailer');
const { decryptOrPlain } = require('../utils/cryptoUtil');
const Stripe = require('stripe');

// Invoice balance in cents — the single formula used to create the Checkout Session and to verify
// what Stripe actually charged, so the two can never drift apart.
function invoiceTotals(invoice) {
    const billedItems = (invoice.invoice_items || []).filter(it => it.quantity > 0);
    const subtotalCents = billedItems.reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
    const taxCents = Math.round(subtotalCents * ((invoice.tax_percent || 0) / 100));
    const discountAmt = Math.round(subtotalCents * ((invoice.discount_cents || 0) / 10000));
    return { billedItems, subtotalCents, taxCents, discountAmt, totalCents: subtotalCents + taxCents - discountAmt };
}

/**
 * GET /api/pay/:token
 * Public — no auth required.
 * Returns invoice details + photographer's payment handles so the client can pay.
 */
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Fetch invoice by payment token (uses service role so no RLS restriction)
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found or payment link has expired.' });
        }

        // Don't allow viewing a voided invoice
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }

        // Fetch photographer's settings (payment handles, business name, email)
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag, stripe_publishable_key, logo_url, phone, website')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        let hasStripe = false;
        if (settings?.stripe_publishable_key) {
            try {
                const rawKey = await decryptOrPlain(settings.stripe_publishable_key);
                const stripeKey = typeof rawKey === 'string' ? rawKey.trim() : '';
                hasStripe = Boolean(stripeKey && (stripeKey.startsWith('rk_') || stripeKey.startsWith('sk_')));
            } catch (err) {
                console.error('[PAY] Stripe key decrypt error:', err);
            }
        }

        // Return safe public payload — no secret keys exposed to browser
        res.json({
            invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                status: invoice.status,
                notes: invoice.notes,
                tax_percent: invoice.tax_percent,
                discount_cents: invoice.discount_cents,
                photographer_signed: invoice.photographer_signed,
                customer_signed_at: invoice.customer_signed_at,
                client: {
                    name: invoice.clients?.name,
                    email: invoice.clients?.email,
                },
                items: (invoice.invoice_items || []).map(it => ({
                    description: it.description,
                    quantity: it.quantity,
                    unit_price_cents: it.unit_price_cents,
                })),
            },
            studio: {
                business_name: settings?.business_name || 'Your Photographer',
                email: settings?.email || null,
                phone: settings?.phone || null,
                website: settings?.website || null,
                logo_url: settings?.logo_url || null,
                venmo_handle: settings?.venmo_handle || null,
                zelle_handle: settings?.zelle_handle || null,
                cashapp_tag: settings?.cashapp_tag || null,
                has_stripe: hasStripe,
            }
        });

    } catch (e) {
        console.error('[PAY] GET error:', e);
        res.status(500).json({ error: 'Unable to load invoice.' });
    }
});

/**
 * POST /api/pay/:token/checkout
 * Public — creates a dynamic Stripe Checkout Session for the exact invoice balance.
 */
router.post('/:token/checkout', async (req, res) => {
    try {
        const { token } = req.params;

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }
        if (invoice.status === 'paid') {
            return res.status(409).json({ error: 'This invoice has already been paid in full.' });
        }
        // Client approval must come first — enforced here, not just in the pay page UI.
        if (!invoice.customer_signed_at) {
            return res.status(403).json({ error: 'Please approve this invoice before paying by card.', code: 'approval_required' });
        }

        // Fetch photographer's Stripe key from settings
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        if (!settings?.stripe_publishable_key) {
            return res.status(400).json({ error: 'Online card payments are not configured for this business.' });
        }

        const stripeKey = await decryptOrPlain(settings.stripe_publishable_key);
        if (!stripeKey || (!stripeKey.startsWith('rk_') && !stripeKey.startsWith('sk_'))) {
            return res.status(400).json({ error: 'Stripe is not fully configured. Please ensure a valid Stripe Secret or Restricted Key is saved in Studio Settings.' });
        }

        const userStripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

        // Calculate totals
        const { billedItems, taxCents, discountAmt, totalCents } = invoiceTotals(invoice);

        if (totalCents <= 0) {
            return res.status(400).json({ error: 'Invoice total must be greater than $0 to pay online.' });
        }

        const appUrl = process.env.APP_URL || 'https://www.lumiereledger.com';

        // Clean itemized breakdown for Stripe Checkout
        let line_items = [];
        if (discountAmt > 0) {
            // When a discount is applied, lump sum with itemized description guarantees penny-perfect balance
            line_items = [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Invoice #${invoice.invoice_number} — ${settings.business_name || 'Services'}`,
                            description: billedItems.map(it => `${it.quantity}x ${it.description}`).join(' • ') + (taxCents > 0 ? ` + Tax (${invoice.tax_percent}%)` : '') + ` (Discount applied)`,
                        },
                        unit_amount: totalCents,
                    },
                    quantity: 1,
                }
            ];
        } else {
            // Full professional line-item breakdown
            line_items = billedItems.map(it => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: it.description || 'Service item',
                    },
                    unit_amount: it.unit_price_cents,
                },
                quantity: it.quantity,
            }));

            if (taxCents > 0) {
                line_items.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Sales Tax (${invoice.tax_percent}%)`,
                        },
                        unit_amount: taxCents,
                    },
                    quantity: 1,
                });
            }
        }

        // Create Checkout Session directly in the photographer's Stripe account
        const session = await userStripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: invoice.clients?.email || undefined,
            client_reference_id: invoice.id,
            metadata: {
                invoice_id: invoice.id,
                invoice_number: String(invoice.invoice_number),
                payment_token: token,
            },
            line_items,
            success_url: `${appUrl}/pay/${token}?session_id={CHECKOUT_SESSION_ID}&paid=1`,
            cancel_url: `${appUrl}/pay/${token}`,
        });

        res.json({ url: session.url });

    } catch (e) {
        console.error('[PAY] Stripe checkout error:', e);
        res.status(500).json({ error: e.message || 'Failed to initialize card checkout.' });
    }
});

/**
 * POST /api/pay/:token/verify-session
 * Public — verifies Stripe payment upon client return, marks invoice as paid, and notifies photographer.
 * The Checkout Session must belong to THIS invoice and match its exact balance — a paid session from
 * another invoice (or any other payment on the photographer's Stripe account) never marks it paid.
 */
router.post('/:token/verify-session', async (req, res) => {
    try {
        const { token } = req.params;
        const { session_id } = req.body || {};

        if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required.' });
        }

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }

        // Idempotent: already recorded as paid (page refresh, second tab, resend of the return link)
        if (invoice.status === 'paid') {
            return res.json({ ok: true, already_paid: true, already_signed: Boolean(invoice.customer_signed_at), signed_at: invoice.customer_signed_at });
        }

        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        const stripeKey = await decryptOrPlain(settings?.stripe_publishable_key);
        if (!stripeKey) {
            return res.status(400).json({ error: 'Studio payment configuration missing.' });
        }

        const userStripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
        let session;
        try {
            session = await userStripe.checkout.sessions.retrieve(session_id);
        } catch (stripeErr) {
            console.error(`[PAY] verify-session: could not retrieve session for invoice ${invoice.id}:`, stripeErr.message);
            return res.status(400).json({ error: 'This payment session could not be verified.', code: 'session_not_found' });
        }

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment has not been completed.' });
        }

        // Bind the session to this invoice and its exact balance.
        const { totalCents } = invoiceTotals(invoice);
        const invoiceRef = String(invoice.id);
        const belongsToInvoice = String(session.client_reference_id) === invoiceRef && String(session.metadata?.invoice_id) === invoiceRef;
        const currencyMatches = String(session.currency || '').toLowerCase() === 'usd';
        const amountMatches = session.amount_total === totalCents;
        if (!belongsToInvoice || !currencyMatches || !amountMatches) {
            // Money moved on Stripe but it does not match this invoice — do NOT mark paid; leave a trail for the photographer.
            console.error(`[PAY] verify-session MISMATCH invoice ${invoice.id} (session ${session.id || session_id}): belongsToInvoice=${belongsToInvoice} currency=${session.currency} amount_total=${session.amount_total} expected=${totalCents}`);
            return res.status(400).json({
                error: 'This payment does not match this invoice, so it was not recorded automatically. If you were charged, please contact your photographer and do not pay again.',
                code: 'session_mismatch',
            });
        }

        const paidAt = new Date().toISOString();
        const customerName = session.customer_details?.name || invoice.clients?.name || 'Client';

        // Mark paid once. A client who approved first keeps their original signature and approval time.
        const patch = { status: 'paid', updated_at: paidAt };
        if (!invoice.customer_signed_at) {
            patch.customer_signature = customerName;
            patch.customer_signed_at = paidAt;
        }
        const { data: updatedRows, error: updateError } = await supabase
            .from('invoices')
            .update(patch)
            .eq('id', invoice.id)
            .neq('status', 'paid')
            .neq('status', 'void')
            .select('id');

        if (updateError) throw updateError;

        // Nothing updated → a concurrent request already recorded this payment; do not notify twice.
        if (!updatedRows || updatedRows.length === 0) {
            return res.json({ ok: true, already_paid: true, already_signed: true, signed_at: invoice.customer_signed_at || paidAt });
        }

        const signedAt = patch.customer_signed_at || invoice.customer_signed_at;
        const signatureName = patch.customer_signature || invoice.customer_signature || customerName;

        if (settings?.email) {
            let extEventName = '';
            const displayNotes = invoice.notes || '';
            const metaMatch = displayNotes.match(/---METADATA---\nEventName: (.*)\nEventType: (.*)/);
            if (metaMatch) {
                extEventName = metaMatch[1];
            }

            // The payment is already recorded — a mail failure must not turn a successful payment into an error page.
            try {
                await sendInvoiceApprovalEmail({
                    to: settings.email,
                    studioName: settings.business_name || 'Lumière Ledger',
                    clientName: invoice.clients?.name || customerName,
                    clientEmail: invoice.clients?.email || session.customer_details?.email || '',
                    invoiceNumber: invoice.invoice_number,
                    eventName: extEventName,
                    totalCents,
                    signedAt,
                    customerSignature: `${signatureName} (Paid via Stripe)`,
                    paymentHandles: {
                        stripe: 'Paid with Card via Stripe Checkout',
                    },
                    invoiceId: invoice.id,
                });
            } catch (mailErr) {
                console.error(`[PAY] Paid notification email failed for invoice ${invoice.id}:`, mailErr.message);
            }
        }

        res.json({
            ok: true,
            message: 'Payment received and verified successfully.',
            signed_at: signedAt,
            customer_signature: signatureName,
        });

    } catch (e) {
        console.error('[PAY] verify-session error:', e);
        res.status(500).json({ error: 'Failed to verify payment session.' });
    }
});

/**
 * POST /api/pay/:token
 * Public — manual customer e-signature approval for peer-to-peer / cash payments.
 */
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { signature } = req.body;

        if (!signature || signature.trim().length < 2) {
            return res.status(400).json({ error: 'A valid full name is required to approve this invoice.' });
        }

        // Fetch invoice to validate it's still signable
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided and cannot be approved.' });
        }
        if (invoice.customer_signed_at) {
            return res.status(409).json({ error: 'This invoice has already been approved.' });
        }

        const signedAt = new Date().toISOString();

        // Save signature to invoice — status remains 'sent' (photographer confirms manual payments)
        const { error: updateError } = await supabase
            .from('invoices')
            .update({
                customer_signature: signature.trim(),
                customer_signed_at: signedAt,
                updated_at: signedAt,
            })
            .eq('id', invoice.id);

        if (updateError) throw updateError;

        // Calculate total for the notification email
        const subtotalCents = (invoice.invoice_items || []).reduce(
            (s, it) => s + (it.unit_price_cents * it.quantity), 0
        );
        const taxCents = Math.round(subtotalCents * ((invoice.tax_percent || 0) / 100));
        const discountPct = (invoice.discount_cents || 0) / 10000;
        const discountAmt = Math.round(subtotalCents * discountPct);
        const totalCents = subtotalCents + taxCents - discountAmt;

        // Fetch photographer's business email + payment handles for notification
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        const studioEmail = settings?.email;

        if (studioEmail) {
            let extEventName = '';
            const displayNotes = invoice.notes || '';
            const metaMatch = displayNotes.match(/---METADATA---\nEventName: (.*)\nEventType: (.*)/);
            if (metaMatch) {
                extEventName = metaMatch[1];
            }

            await sendInvoiceApprovalEmail({
                to: studioEmail,
                studioName: settings?.business_name || 'Lumière Ledger',
                clientName: invoice.clients?.name || 'Your Client',
                clientEmail: invoice.clients?.email || '',
                invoiceNumber: invoice.invoice_number,
                eventName: extEventName,
                totalCents,
                signedAt,
                customerSignature: signature.trim(),
                paymentHandles: {
                    venmo: settings?.venmo_handle,
                    zelle: settings?.zelle_handle,
                    cashapp: settings?.cashapp_tag,
                    stripe: settings?.stripe_publishable_key ? 'Online Card Payments (Stripe)' : null,
                },
                invoiceId: invoice.id,
            });
        } else {
            console.warn(`[PAY] No business email on file for invoice ${invoice.id} — approval notification skipped.`);
        }

        res.json({
            ok: true,
            message: 'Invoice approved successfully. Your photographer has been notified.',
            signed_at: signedAt,
        });

    } catch (e) {
        console.error('[PAY] POST error:', e);
        res.status(500).json({ error: 'Failed to process approval. Please try again.' });
    }
});

module.exports = router;
