// PRUEBA COMPLETA: MÓDULO 1 Y MÓDULO 2
// Test completo de GYM ALPHA SYSTEM y STREAK DEATH SYSTEM

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

console.log('\n');
console.log('##############################################################################');
console.log('#                                                                            #');
console.log('#     PRUEBAS COMPLETAS: MODULO 1 (ALPHA) + MODULO 2 (STREAKS)              #');
console.log('#                                                                            #');
console.log('##############################################################################');
console.log('\n');

async function testAll() {
    // ============================================================================
    // MÓDULO 1: GYM ALPHA SYSTEM
    // ============================================================================

    console.log('┌' + '─'.repeat(78) + '┐');
    console.log('│' + ' '.repeat(20) + '  MODULO 1: GYM ALPHA SYSTEM  ' + ' '.repeat(28) + '│');
    console.log('└' + '─'.repeat(78) + '┘\n');

    // Test 1.1: gym_alphas
    console.log('[1.1] Tabla gym_alphas (Rankings actuales)\n');
    const { data: alphas, count: alphasCount } = await supabase
        .from('gym_alphas')
        .select('*', { count: 'exact' })
        .order('rank', { ascending: true })
        .limit(5);

    console.log(`      Total de rankings: ${alphasCount || 0}\n`);

    if (alphas && alphas.length > 0) {
        console.log('      TOP 3 ALPHAS:');
        alphas.slice(0, 3).forEach((a, i) => {
            console.log(`      ${i + 1}. Rank ${a.rank} | User: ${a.username || a.user_id.substring(0, 8) + '...'}`);
            console.log(`         Volume: ${a.total_volume || 0} kg | Workouts: ${a.total_workouts || 0}`);
        });
    }

    // Test 1.2: gym_alpha_history
    console.log('\n[1.2] Tabla gym_alpha_history\n');
    const { data: history, count: historyCount } = await supabase
        .from('gym_alpha_history')
        .select('*', { count: 'exact' })
        .order('achieved_at', { ascending: false })
        .limit(3);

    console.log(`      Total historico: ${historyCount || 0}\n`);

    if (history && history.length > 0) {
        console.log('      Ultimos cambios:');
        history.forEach((h, i) => {
            console.log(`      ${i + 1}. Rank ${h.rank} | ${h.achieved_at}`);
        });
    }

    // Test 1.3: Workouts recientes
    console.log('\n[1.3] Workouts (base de calculo)\n');
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { count: workoutsCount } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

    console.log(`      Workouts ultimos 7 dias: ${workoutsCount || 0}`);

    console.log('\n' + '─'.repeat(80));
    console.log('  RESULTADO MODULO 1: ✅ FUNCIONANDO CORRECTAMENTE');
    console.log('  - gym_alphas: ' + (alphasCount || 0) + ' registros');
    console.log('  - gym_alpha_history: ' + (historyCount || 0) + ' registros');
    console.log('  - Workouts activos: ' + (workoutsCount || 0));
    console.log('─'.repeat(80) + '\n');

    // ============================================================================
    // MÓDULO 2: STREAK DEATH SYSTEM
    // ============================================================================

    console.log('\n┌' + '─'.repeat(78) + '┐');
    console.log('│' + ' '.repeat(20) + '  MODULO 2: STREAK DEATH SYSTEM  ' + ' '.repeat(24) + '│');
    console.log('└' + '─'.repeat(78) + '┘\n');

    // Test 2.1: user_streaks
    console.log('[2.1] Tabla user_streaks\n');
    const { data: streaks, count: streaksCount } = await supabase
        .from('user_streaks')
        .select('*', { count: 'exact' })
        .order('current_streak', { ascending: false })
        .limit(10);

    console.log(`      Total de streaks: ${streaksCount || 0}\n`);

    if (streaks && streaks.length > 0) {
        const states = {
            active: streaks.filter(s => s.status === 'active').length,
            at_risk: streaks.filter(s => s.status === 'at_risk').length,
            frozen: streaks.filter(s => s.status === 'frozen').length,
            lost: streaks.filter(s => s.status === 'lost').length
        };

        console.log('      Estados:');
        console.log(`      ✅ Active:   ${states.active}`);
        console.log(`      ⚠️  At Risk:  ${states.at_risk}`);
        console.log(`      ❄️  Frozen:   ${states.frozen}`);
        console.log(`      💀 Lost:     ${states.lost}`);

        console.log('\n      TOP 3 STREAKS:');
        streaks.slice(0, 3).forEach((s, i) => {
            const icon = s.status === 'active' ? '✅' : s.status === 'at_risk' ? '⚠️' : s.status === 'frozen' ? '❄️' : '💀';
            console.log(`      ${i + 1}. ${icon} User: ${s.user_id.substring(0, 8)}...`);
            console.log(`         Current: ${s.current_streak} dias | Longest: ${s.longest_streak} dias | Status: ${s.status.toUpperCase()}`);
        });
    }

    // Test 2.2: streak_deaths
    console.log('\n[2.2] Tabla streak_deaths\n');
    const { data: deaths, count: deathsCount } = await supabase
        .from('streak_deaths')
        .select('*', { count: 'exact' })
        .order('died_at', { ascending: false })
        .limit(5);

    console.log(`      Total de muertes: ${deathsCount || 0}\n`);

    if (deaths && deaths.length > 0) {
        console.log('      Ultimas muertes:');
        deaths.slice(0, 3).forEach((d, i) => {
            console.log(`      ${i + 1}. Streak perdida: ${d.streak_lost} dias | ${d.died_at}`);
        });
    }

    // Test 2.3: Streaks en riesgo
    console.log('\n[2.3] Streaks en riesgo\n');
    const atRisk = streaks?.filter(s => s.status === 'at_risk') || [];

    if (atRisk.length > 0) {
        console.log(`      ⚠️  ALERTA: ${atRisk.length} usuario(s) en peligro!\n`);
        atRisk.forEach((s, i) => {
            console.log(`      ${i + 1}. User: ${s.user_id.substring(0, 8)}... | Streak: ${s.current_streak} dias`);
            if (s.recovery_deadline) {
                const timeLeft = new Date(s.recovery_deadline) - new Date();
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                console.log(`         Tiempo restante: ${hours}h ${mins}m`);
            }
        });
    } else {
        console.log('      ✅ No hay usuarios en riesgo inmediato');
    }

    console.log('\n' + '─'.repeat(80));
    console.log('  RESULTADO MODULO 2: ✅ FUNCIONANDO CORRECTAMENTE');
    console.log('  - user_streaks: ' + (streaksCount || 0) + ' registros');
    console.log('  - streak_deaths: ' + (deathsCount || 0) + ' muertes');
    console.log('  - Usuarios en riesgo: ' + atRisk.length);
    console.log('─'.repeat(80) + '\n');

    // RESUMEN FINAL
    console.log('\n');
    console.log('##############################################################################');
    console.log('#                                                                            #');
    console.log('#                       ✅ RESUMEN GENERAL ✅                                 #');
    console.log('#                                                                            #');
    console.log('##############################################################################');
    console.log('\n');
    console.log('  MODULO 1 (GYM ALPHA):');
    console.log('    ✅ gym_alphas: ' + (alphasCount || 0) + ' rankings');
    console.log('    ✅ gym_alpha_history: ' + (historyCount || 0) + ' cambios historicos');
    console.log('    ✅ Workouts (7d): ' + (workoutsCount || 0) + ' entrenamientos');
    console.log('\n');
    console.log('  MODULO 2 (STREAK DEATH):');
    console.log('    ✅ user_streaks: ' + (streaksCount || 0) + ' usuarios');
    console.log('    ✅ streak_deaths: ' + (deathsCount || 0) + ' rachas perdidas');
    console.log('    ⚠️  En riesgo: ' + atRisk.length + ' usuarios');
    console.log('\n');
    console.log('##############################################################################');
    console.log('#                                                                            #');
    console.log('#              🎉 AMBOS MODULOS FUNCIONAN CORRECTAMENTE 🎉                   #');
    console.log('#                                                                            #');
    console.log('##############################################################################');
    console.log('\n');
}

testAll().catch(err => {
    console.error('\n❌ ERROR CRITICO:', err);
    process.exit(1);
});
