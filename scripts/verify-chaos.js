
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Make sure to run with --env-file=.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyChaos() {
    console.log('🔍 VERIFICANDO EL CAOS EN LA BASE DE DATOS...\n');

    // 1. Verificar Ranking - Avoiding 'rank' column if it conflicts, or quoting it? 
    // It seems 'rank' column exists in gym_alphas but maybe the client query builder has issue.
    // Let's just select username and volume, we can deduce rank by order.
    const { data: rankings, error: rankError } = await supabase
        .from('gym_alphas')
        .select('username, total_volume, gym_id')
        .eq('is_current', true)
        .order('total_volume', { ascending: false })
        .limit(5);

    if (rankError) {
        console.error('❌ Error fetching rankings:', rankError.message);
    } else {
        console.log('🏆 TOP 5 RANKING ACTUAL (DB):');
        rankings.forEach((r, i) => {
            console.log(`   #${i + 1}: ${r.username} - ${r.total_volume.toLocaleString()} Vol`);
        });

        // Check if ZEUS is here
        const zeus = rankings.some(r => r.username && r.username.includes('ZEUS'));
        if (zeus) console.log('\n✅ ZEUS DETECTADO EN EL TOP.');
        else {
            console.log('\n❌ ZEUS NO ESTÁ EN EL TOP.');
            console.log('   (Es posible que el script SQL de "Chaos" no se haya ejecutado correctamente en Supabase)');
        }
    }

    console.log('\n-----------------------------------\n');

    // 2. Verificar Racha (Streak) 'at_risk'
    const { data: streaks, error: streakError } = await supabase
        .from('user_streaks')
        .select('user_id, current_streak, status, last_workout_date')
        .eq('status', 'at_risk')
        .limit(5);

    if (streakError) {
        console.error('❌ Error fetching streaks:', streakError.message);
    } else {
        console.log('🔥 RACHAS EN RIESGO (DB):');
        if (!streaks || streaks.length === 0) {
            console.log('   (Ninguna racha está en riesgo actualmente)');
        } else {
            streaks.forEach(s => {
                console.log(`   User ID: ${s.user_id} | Racha: ${s.current_streak} | Status: ${s.status}`);
            });
            console.log('\n✅ Al menos una racha está en PELIGRO.');
        }
    }
}

verifyChaos();
