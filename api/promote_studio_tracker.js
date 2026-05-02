require('dotenv').config({ path: '../.env' });
const { sendPromoEmail } = require('./utils/mailer');

async function run() {
    const targetEmail = process.argv[2];
    if (!targetEmail) {
        console.error("Usage: node promote_studio_tracker.js <recipient-email>");
        process.exit(1);
    }

    console.log(`🚀 Sending Lumière Ledger Promo to ${targetEmail}...`);
    const result = await sendPromoEmail({ 
        to: targetEmail,
        subject: "📸 Transform Your Studio Operations for 2026"
    });

    if (result.success) {
        console.log("✅ Promo email dispatched successfully!");
        console.log("Check your inbox to see the elite marketing template.");
    } else {
        console.error("❌ Failed to send promo email:", result.error);
    }
}

run();
