// scripts/calculate-rankings.js
// Este script calcula rankings semanales para todos los gyms
// Puede ejecutarse manualmente o via cron job

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key (admin)

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables!');
    console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateRankings() {
    console.log('🚀 Starting weekly rankings calculation...');
    console.log(`📅 Date: ${new Date().toISOString()}`);

    try {
        // Importar el servicio (necesitamos transpilarlo primero o usar dynamic import)
        const alphaService = await import('../src/services/AlphaService.ts');

        console.log('📊 Calculating rankings for all gyms...');
        const result = await alphaService.alphaService.calculateWeeklyRankings();

        console.log('\n✅ Rankings calculation completed!');
        console.log(`   Gyms processed: ${result.gymsProcessed}`);
        console.log(`   Errors: ${result.errors.length}`);

        if (result.errors.length > 0) {
            console.error('\n❌ Errors occurred:');
            result.errors.forEach(err => console.error(`   - ${err}`));
        }

        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

calculateRankings();
