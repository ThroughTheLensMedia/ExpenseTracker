# Plaid Announcement Email — Existing Users
**From:** Lumière Ledger <support@throughthelens.media>  
**To:** All active users (free_beta + lifetime segments)  
**Subject:** Live bank sync is coming — here's exactly what it costs and why your account stays free

---

## Email Body

---

Hey [First Name],

Big news for Lumière Ledger — **live bank sync is almost here.**

Instead of exporting CSVs from your bank and dragging them in, your transactions will flow in automatically. Every account. Every day. Nothing to remember.

This is powered by Plaid — the same infrastructure behind Mint, YNAB, and Rocket Money. Before it goes live, I want to be completely transparent about how it's priced, because you deserve to know exactly what you're paying for and why.

---

### How Plaid billing works

Plaid charges me **$0.30 per connected account, per month** to run the infrastructure. I'm passing that cost through to you at **$0.50/account/month** — a small margin that keeps the platform running. Every cent beyond my cost goes directly into maintaining a reliable, fast, zero-ad experience.

Stripe handles the payment processing. Their fee is **2.9% + $0.30** on the Plaid subtotal. I'm not marking that up — it shows as its own line item on your invoice so you can see exactly what goes where.

**An example:** If you connect 5 bank accounts (checking, savings, two credit cards, a business account), your monthly Plaid charge is:

```
Plaid live bank sync (5 accounts × $0.50)    $2.50
Stripe processing fee (2.9% + $0.30)          $0.37
                                    ──────────────
                               Total:          $2.87/month
```

That's it. No hidden fees. No surprise charges. You connect zero accounts, you pay zero. You can disconnect at any time and the charge stops the next billing cycle.

You'll need a card on file before you can connect your first bank — Stripe handles that securely and I never see your card details. You'll also get a full invoice by email every month, itemized exactly as shown above.

---

### Your account — what changes for you

**Nothing changes about your free access to Lumière Ledger.**

You're on a lifetime free account. That means:

- **$0/month platform fee** — forever
- Full access to the ledger, invoicing, CRM, tax tools, and everything that's been built
- Plaid bank sync is **completely optional** — if you never connect a bank, you pay nothing

To put your savings in perspective: the standard Studio plan is **$19/month ($228/year)**. You're getting that same platform access at $0. If you decide to add Plaid on top of that, you're still paying a fraction of what most financial tools cost.

---

### When does this go live?

Plaid is pending final account approval on my end. I'll send another email the day it's available with a direct link to connect your first account. No action needed from you today.

If you have questions before then, reply to this email. I read every one.

— Joshua  
Through The Lens Media  
Lumière Ledger

---

*You're receiving this because you have an active Lumière Ledger account. To manage your account or update your email preferences, visit your Control Center → Profile tab.*

---

## Notes for Sending

**Segment:** free_beta + lifetime users only (not future paid subscribers — they'll get the Plaid feature announcement separately)

**Personalization tokens:**
- `[First Name]` → pull from Supabase `auth.users.user_metadata.full_name` or `auth.users.email` prefix as fallback

**Timing:** Send 1–2 weeks before Plaid goes live in production

**Follow-up email (day of launch):**
- Subject: "Live bank sync is now available — connect your first account"
- Body: short, 3 sentences, direct CTA button → `/StudioControlCenter?tab=integration`

**Do not send via bulk ESP without unsubscribe footer** — CAN-SPAM compliance required.
Add: "Lumière Ledger · Through The Lens Media · Las Vegas, NV · [Unsubscribe]"
