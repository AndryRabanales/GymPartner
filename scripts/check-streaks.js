
const { createClient } = require('@supabase/supabase-js');

// Load env vars
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon key is usually fine if RLS allows, but for Cron we might need Service Role if RLS is strict. 
// However, the RPC is SECURITY DEFINER, so anon key is sufficient to call it.

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkStreaks() {
    console.log('💀 Starting Streak Death Check...');

    const { data, error } = await supabase.rpc('check_broken_streaks');

    if (error) {
        console.error('❌ Error checking streaks:', error);
        process.exit(1);
    }

    console.log('✅ Streak Check Complete!');
    console.log('📊 Results:', JSON.stringify(data, null, 2));
}

checkStreaks();
