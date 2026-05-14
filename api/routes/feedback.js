const express = require("express");
const router = express.Router();

// POST /feedback
// Authenticated — user must be logged in. Not gated by licensing so any user can report issues.
router.post("/", async (req, res) => {
  try {
    const { type, message, name, email, diagnostics } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const feedbackType = type || "General";
    const senderName = name || "Lumière Ledger User";
    const senderEmail = email || req.user?.email || "unknown";
    const userId = req.user?.id || "unknown";

    const typeEmoji = {
      "Bug": "🐛",
      "Idea": "💡",
      "Question": "❓",
      "General": "💬",
    }[feedbackType] || "💬";

    const diagSection = diagnostics
      ? `
        <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:16px;margin-top:20px;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.06em;">DIAGNOSTIC INFO</p>
          <pre style="margin:0;font-size:11px;color:#94a3b8;white-space:pre-wrap;word-break:break-word;">${JSON.stringify(diagnostics, null, 2)}</pre>
        </div>
      `
      : "";

    const html = `
      <div style="background:#0f172a;color:white;padding:40px;font-family:'Inter',sans-serif;border-radius:12px;max-width:640px;">
        <h2 style="color:#6366f1;margin:0 0 6px;">${typeEmoji} LUMIÈRE LEDGER FEEDBACK</h2>
        <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;">Type: <strong style="color:#e2e8f0;">${feedbackType}</strong></p>

        <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;"><strong style="color:#38bdf8;">From:</strong> ${senderName} &lt;${senderEmail}&gt;</p>
          <p style="margin:0;"><strong style="color:#38bdf8;">User ID:</strong> ${userId}</p>
        </div>

        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.06em;">MESSAGE</p>
          <p style="margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message.trim()}</p>
        </div>

        ${diagSection}

        <p style="color:#64748b;font-size:11px;margin-top:24px;">Submitted from Lumière Ledger • ${new Date().toISOString()}</p>
      </div>
    `;

    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM || "Lumière Ledger <support@lumiereledger.com>",
      to: ["joshua.deuermeyer@gmail.com"],
      replyTo: senderEmail !== "unknown" ? senderEmail : undefined,
      subject: `${typeEmoji} [Feedback] ${feedbackType} — ${senderName}`,
      html,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("[FEEDBACK]", e);
    res.status(500).json({ error: "Failed to send feedback." });
  }
});

module.exports = router;
