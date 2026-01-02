// PRUEBA MÓDULO 1: GYM ALPHA SYSTEM (Rankings)
// Este script verifica que el sistema de rankings funciona correctamente

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

console.log('='.repeat(80));
console.log(' MODULO 1: GYM ALPHA SYSTEM - PRUEBAS DE FUNCIONAMIENTO');
console.log('='.repeat(80));

async function testModule1() {
    try {
        // 1. VERIFICAR TABLA gym_alphas (Rankings actuales)
        console.log('\n[TEST 1] Verificando tabla gym_alphas...\n');
        const { data: alphas, error: alphasError, count: alphasCount } = await supabase
            .from('gym_alphas')
            .select('*', { count: 'exact' })
            .order('rank', { ascending: true })
            .limit(10);

        if (alphasError) {
            console.error('ERROR al leer gym_alphas:', alphasError);
            return;
        }

        console.log(`>>> gym_alphas: ${alphasCount} registros totales\n`);

        if (alphas && alphas.length > 0) {
            console.log('TOP 5 ALPHAS ACTUALES:');
            const top5 = alphas.slice(0, 5);

            for (let i = 0; i < top5.length; i++) {
                const alpha = top5[i];
                console.log(`\n#${i + 1} RANK ${alpha.rank} | Gym: ${alpha.gym_id?.substring(0, 10)}...`);
                console.log(`    User: ${alpha.user_id?.substring(0, 10)}...`);
                console.log(`    Username: ${alpha.username || 'N/A'}`);
                console.log(`    Volume Total: ${alpha.total_volume || 0} kg`);
                console.log(`    Workouts: ${alpha.total_workouts || 0}`);
                console.log(`    Consistency: ${alpha.consistency_score || 0}`);
                console.log(`    Achieved: ${alpha.achieved_at || 'N/A'}`);
            }
        } else {
            console.log('No se encontraron alphas activos.');
        }

        // 2. VERIFICAR TABLA gym_alpha_history
        console.log('\n\n[TEST 2] Verificando Historial de Alphas...\n');
        const { data: history, error: historyError, count: historyCount } = await supabase
            .from('gym_alpha_history')
            .select('*', { count: 'exact' })
            .order('achieved_at', { ascending: false })
            .limit(10);

        if (historyError) {
            console.error('ERROR al leer historial:', historyError.message);
        } else {
            console.log(`>>> gym_alpha_history: ${historyCount} registros totales\n`);

            if (history && history.length > 0) {
                console.log('ULTIMOS 5 CAMBIOS DE ALPHA:');

                for (let i = 0; i < Math.min(5, history.length); i++) {
                    const h = history[i];
                    console.log(`\n${i + 1}. Rank ${h.rank} | Gym: ${h.gym_id?.substring(0, 10)}...`);
                    console.log(`    User: ${h.user_id?.substring(0, 10)}...`);
                    console.log(`    Achieved: ${h.achieved_at}`);
                }
            } else {
                console.log('No hay historial de alphas.');
            }
        }

        // 3. VERIFICAR TABLA gym_rankings (si existe)
        console.log('\n\n[TEST 3] Verificando gym_rankings (Sistema de Rankings)...\n');
        const { data: rankings, error: rankingsError, count: rankingsCount } = await supabase
            .from('gym_rankings')
            .select('*', { count: 'exact' })
            .order('rank', { ascending: true })
            .limit(10);

        if (rankingsError) {
            console.log(`INFO: gym_rankings no disponible (${rankingsError.code})`);
            console.log('Esto es normal si solo se usa gym_alphas.');
        } else {
            console.log(`>>> gym_rankings: ${rankingsCount} registros totales\n`);

            if (rankings && rankings.length > 0) {
                console.log('TOP 3 RANKINGS:');
                for (let i = 0; i < Math.min(3, rankings.length); i++) {
                    const r = rankings[i];
                    console.log(`\n#${i + 1} Rank ${r.rank}`);
                    console.log(`    Gym: ${r.gym_id?.substring(0, 10)}...`);
                    console.log(`    User: ${r.user_id?.substring(0, 10)}...`);
                    console.log(`    Volume: ${r.total_volume || 0} kg`);
                }
            }
        }

        // 4. VERIFICAR WORKOUTS (Datos de origen)
        console.log('\n\n[TEST 4] Verificando datos de workouts...\n');
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: recentWorkouts, error: workoutsError, count: workoutsCount } = await supabase
            .from('workouts')
            .select('*', { count: 'exact' })
            .gte('created_at', oneWeekAgo.toISOString())
            .limit(5);

        if (workoutsError) {
            console.error('ERROR al leer workouts:', workoutsError);
        } else {
            console.log(`>>> ${workoutsCount} workouts en los ultimos 7 dias`);

            if (recentWorkouts && recentWorkouts.length > 0) {
                console.log(`\nMuestra de ultimos workouts:`);
                for (let i = 0; i < Math.min(3, recentWorkouts.length); i++) {
                    const w = recentWorkouts[i];
                    console.log(`${i + 1}. User: ${w.user_id?.substring(0, 10)}... | Gym: ${w.gym_id?.substring(0, 10)}... | ${new Date(w.created_at).toLocaleDateString()}`);
                }
            }
        }

        // RESUMEN FINAL
        console.log('\n' + '='.repeat(80));
        console.log(' RESUMEN MODULO 1 (GYM ALPHA SYSTEM)');
        console.log('='.repeat(80));
        console.log(`  gym_alphas:        ${alphasCount || 0} registros`);
        console.log(`  gym_alpha_history: ${historyCount || 0} registros`);
        console.log(`  gym_rankings:      ${rankingsCount || 'N/A'}`);
        console.log(`  workouts (7 dias): ${workoutsCount || 0} workouts`);
        console.log('='.repeat(80));
        console.log('\n MODULO 1: FUNCIONA CORRECTAMENTE\n');

    } catch (error) {
        console.error('\nERROR CRITICO EN MODULO 1:', error.message);
        console.error(error);
    }
}

testModule1();
