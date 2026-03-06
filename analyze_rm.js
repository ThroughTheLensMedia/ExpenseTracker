const fs = require('fs');
const csv = require('csv-parser');

const categories = new Map();
const vendors = new Map();

fs.createReadStream('./Rocket Money Expenses/2023-2025 RM transactions.csv')
    .pipe(csv())
    .on('data', (row) => {
        // RM might have different header names
        const getVal = (possibleHeaders) => {
            for (const h of possibleHeaders) {
                for (const k of Object.keys(row)) {
                    if (k.trim().toLowerCase() === h) return row[k];
                }
            }
            return null;
        };

        const vendor = getVal(['name', 'merchant', 'description', 'payee', 'transaction']);
        const category = getVal(['category', 'transaction category']);
        const amountStr = getVal(['amount', 'value', 'total']);

        if (!vendor || !category || !amountStr) return;

        let amount = parseFloat(amountStr.replace(/[$,]/g, ''));
        if (isNaN(amount)) return;

        // Track categories
        if (!categories.has(category)) {
            categories.set(category, { count: 0, amount: 0, vendors: new Map() });
        }
        const catData = categories.get(category);
        catData.count++;
        catData.amount += Math.abs(amount);

        // Track vendors within categories
        if (!catData.vendors.has(vendor)) {
            catData.vendors.set(vendor, { count: 0, amount: 0 });
        }
        const vendorData = catData.vendors.get(vendor);
        vendorData.count++;
        vendorData.amount += Math.abs(amount);
    })
    .on('end', () => {
        console.log("Analysis Complete. Top Categories & Suggested Rules:");
        console.log("---------------------------------------------------");

        const sortedCats = Array.from(categories.entries()).sort((a, b) => b[1].amount - a[1].amount);

        for (const [cat, data] of sortedCats.slice(0, 50)) {
            if (data.count < 3) continue; // Skip rare categories
            console.log(`\n[Category: ${cat}] - ${data.count} transactions, $${data.amount.toFixed(2)} total`);

            const sortedVendors = Array.from(data.vendors.entries()).sort((a, b) => b[1].amount - a[1].amount);

            for (const [vendor, vData] of sortedVendors.slice(0, 10)) {
                if (vData.count >= 2) {
                    console.log(`  -> IF Vendor EXACTLY "${vendor}" THEN Category = "${cat}" (${vData.count} txns)`);
                }
            }
        }
    });
