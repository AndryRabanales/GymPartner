// scripts/calculate-rankings-simple.js
// Simple script to trigger Supabase RPC function for weekly rankings
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🚀 Triggering weekly rankings calculation...');
    console.log(`📅 Date: ${new Date().toISOString()}`);

    try {
        // Call Supabase RPC function
        const { data, error } = await supabase.rpc('calculate_all_rankings');

        if (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }

        console.log('✅ Rankings calculated successfully!');
        console.log(`   Gyms processed: ${data.gyms_processed}`);
        console.log(`   Week: ${data.week_start} to ${data.week_end}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

main();
