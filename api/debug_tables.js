require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function check() {
    console.log("CWD:", process.cwd());
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        console.error("Missing SUPABASE credentials in .env");
        console.log("URL:", url ? "exists" : "missing");
        console.log("KEY:", key ? "exists (length " + key.length + ")" : "missing");
        return;
    }

    const sb = createClient(url, key);
    
    console.log("Checking tables...");
    
        try {
            const { data, error } = await sb.from('expenses').select('*').limit(1);
            if (error) {
                console.error(`- Table [expenses]: ERROR - ${error.message} (${error.code})`);
            } else {
                console.log(`- expenses schema:`, Object.keys(data[0] || {}));
            }
        } catch (e) {
            console.error(`FATAL - ${e.message}`);
        }
}

check();
