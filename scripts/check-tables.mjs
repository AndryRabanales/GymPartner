// Script para verificar qué tablas existen en la BD
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔍 Verificando tablas existentes en la base de datos...\n');

async function checkTables() {
    // Lista de tablas a verificar
    const tablesToCheck = [
        'gym_rankings',
        'gym_alphas',
        'gym_alpha_history',
        'user_streaks',
        'streak_deaths',
        'workouts',
        'users',
        'gyms'
    ];

    for (const table of tablesToCheck) {
        const { data, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`❌ ${table}: NO EXISTE (${error.code})`);
        } else {
            console.log(`✅ ${table}: EXISTE`);
        }
    }
}

checkTables();
