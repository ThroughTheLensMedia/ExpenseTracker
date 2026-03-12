const { supabase } = require('./db');
require('dotenv').config({ path: '/Users/dewey/Downloads/Expense Tracker 2026 v3/.env' });

async function check() {
    const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (error) {
        console.error(error);
    } else {
        console.log("Settings keys:", Object.keys(data || {}));
    }
}
check();
