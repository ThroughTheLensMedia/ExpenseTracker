require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function setup() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
        console.error("Missing Service Role Key for storage setup.");
        return;
    }

    const sb = createClient(url, key);
    
    console.log("Checking storage buckets...");
    const { data: buckets, error: listError } = await sb.storage.listBuckets();
    
    if (listError) {
        console.error("Failed to list buckets:", listError.message);
        return;
    }

    const exists = buckets.find(b => b.name === 'receipts');
    
    if (!exists) {
        console.log("Bucket 'receipts' not found. Creating...");
        const { data, error } = await sb.storage.createBucket('receipts', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
        });
        if (error) {
            console.error("Failed to create bucket:", error.message);
        } else {
            console.log("Bucket 'receipts' created successfully.");
        }
    } else {
        console.log("Bucket 'receipts' already exists.");
        // Ensure it is public for getPublicUrl to work
        if (!exists.public) {
            console.log("Making bucket 'receipts' public...");
            await sb.storage.updateBucket('receipts', { public: true });
        }
    }
}

setup();
