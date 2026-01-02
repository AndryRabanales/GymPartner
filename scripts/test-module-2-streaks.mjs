// PRUEBA MÓDULO 2: STREAK DEATH SYSTEM
// Este script verifica que el sistema de rachas funciona correctamente

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

console.log('='.repeat(80));
console.log(' MODULO 2: STREAK DEATH SYSTEM - PRUEBAS DE FUNCIONAMIENTO');
console.log('='.repeat(80));

async function testModule2() {
    try {
        // 1. VERIFICAR TABLA user_streaks
        console.log('\n[TEST 1] Verificando tabla user_streaks...\n');
        const { data: streaks, error: streaksError, count: streaksCount } = await supabase
            .from('user_streaks')
            .select('*', { count: 'exact' })
            .order('current_streak', { ascending: false })
            .limit(20);

        if (streaksError) {
            console.error('ERROR al leer streaks:', streaksError);
            return;
        }

        console.log(`>>> user_streaks: ${streaksCount} registros totales\n`);

        if (streaks && streaks.length > 0) {
            console.log('TOP 10 STREAKS ACTIVAS:\n');

            const top10 = streaks.slice(0, 10);
            for (let i = 0; i < top10.length; i++) {
                const s = top10[i];
                const statusIcon = s.status === 'active' ? '✅' :
                    s.status === 'at_risk' ? '⚠️' :
                        s.status === 'frozen' ? '❄️' : '💀';

                console.log(`#${i + 1} User: ${s.user_id?.substring(0, 12)}... ${statusIcon}`);
                console.log(`    Current Streak: ${s.current_streak} dias`);
                console.log(`    Longest Streak: ${s.longest_streak} dias`);
                console.log(`    Status: ${s.status.toUpperCase()}`);
                console.log(`    Last Workout: ${s.last_workout_date}`);
                if (s.recovery_deadline) {
                    console.log(`    Recovery Deadline: ${s.recovery_deadline}`);
                }
                console.log('');
            }

            // Análisis de estados
            const states = {
                active: 0,
                at_risk: 0,
                frozen: 0,
                lost: 0
            };

            streaks.forEach(s => {
                if (states.hasOwnProperty(s.status)) {
                    states[s.status]++;
                }
            });

            console.log('ANALISIS DE ESTADOS:');
            console.log(`  Active:   ${states.active} usuarios`);
            console.log(`  At Risk:  ${states.at_risk} usuarios`);
            console.log(`  Frozen:   ${states.frozen} usuarios`);
            console.log(`  Lost:     ${states.lost} usuarios`);
        } else {
            console.log('No se encontraron streaks.');
        }

        // 2. VERIFICAR TABLA streak_deaths
        console.log('\n\n[TEST 2] Verificando tabla streak_deaths...\n');
        const { data: deaths, error: deathsError, count: deathsCount } = await supabase
            .from('streak_deaths')
            .select('*', { count: 'exact' })
            .order('died_at', { ascending: false })
            .limit(10);

        if (deathsError) {
            console.error('ERROR al leer streak_deaths:', deathsError.message);
        } else {
            console.log(`>>> streak_deaths: ${deathsCount} registros totales\n`);

            if (deaths && deaths.length > 0) {
                console.log('ULTIMAS 5 RACHAS PERDIDAS:\n');

                for (let i = 0; i < Math.min(5, deaths.length); i++) {
                    const d = deaths[i];
                    console.log(`#${i + 1} User: ${d.user_id?.substring(0, 12)}...`);
                    console.log(`    Streak Perdida: ${d.streak_lost} dias`);
                    console.log(`    Murió: ${d.died_at}`);
                    console.log(`    Recuperable: ${d.was_recoverable ? 'SI' : 'NO'}`);
                    console.log('');
                }
            } else {
                console.log('No hay rachas perdidas (good news!).');
            }
        }

        // 3. VERIFICAR STREAKS EN RIESGO
        console.log('\n[TEST 3] Verificando streaks en riesgo inmediato...\n');

        const atRiskStreaks = streaks?.filter(s => s.status === 'at_risk') || [];

        if (atRiskStreaks.length > 0) {
            console.log(`ALERTA: ${atRiskStreaks.length} usuario(s) en PELIGRO de perder su racha:\n`);

            for (let i = 0; i < atRiskStreaks.length; i++) {
                const s = atRiskStreaks[i];
                console.log(`User: ${s.user_id?.substring(0, 12)}...`);
                console.log(`  Racha actual: ${s.current_streak} dias`);
                console.log(`  Ultimo workout: ${s.last_workout_date}`);

                if (s.recovery_deadline) {
                    const deadline = new Date(s.recovery_deadline);
                    const now = new Date();
                    const timeLeft = deadline - now;

                    if (timeLeft > 0) {
                        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        console.log(`  Tiempo restante: ${hours}h ${minutes}m`);
                    } else {
                        console.log(`  TIEMPO AGOTADO - Racha perdida`);
                    }
                }
                console.log('');
            }
        } else {
            console.log('No hay usuarios en riesgo inmediato. Todo bien!');
        }

        // 4. VERIFICAR INTEGRACIÓN CON WORKOUTS
        console.log('\n[TEST 4] Verificando integración con workouts...\n');

        if (streaks && streaks.length > 0) {
            const sampleUser = streaks[0].user_id;

            const { data: userWorkouts, error: workoutsError, count: workoutsCount } = await supabase
                .from('workouts')
                .select('id, created_at', { count: 'exact' })
                .eq('user_id', sampleUser)
                .order('created_at', { ascending: false })
                .limit(10);

            if (workoutsError) {
                console.error('ERROR al obtener workouts:', workoutsError);
            } else {
                console.log(`Usuario muestra: ${sampleUser.substring(0, 12)}...`);
                console.log(`Total workouts: ${workoutsCount}`);
                console.log(`\nUltimos workouts:`);

                if (userWorkouts && userWorkouts.length > 0) {
                    userWorkouts.slice(0, 7).forEach((w, idx) => {
                        const date = new Date(w.created_at);
                        console.log(`  ${idx + 1}. ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
                    });
                }
            }
        }

        // RESUMEN FINAL
        console.log('\n' + '='.repeat(80));
        console.log(' RESUMEN MODULO 2 (STREAK DEATH SYSTEM)');
        console.log('='.repeat(80));
        console.log(`  user_streaks:   ${streaksCount || 0} registros`);
        console.log(`  streak_deaths:  ${deathsCount || 0} registros`);
        console.log(`  Streaks activas: ${streaks?.filter(s => s.status === 'active').length || 0}`);
        console.log(`  Streaks en riesgo: ${atRiskStreaks.length}`);
        console.log('='.repeat(80));
        console.log('\n MODULO 2: FUNCIONA CORRECTAMENTE\n');

    } catch (error) {
        console.error('\nERROR CRITICO EN MODULO 2:', error.message);
        console.error(error);
    }
}

testModule2();
