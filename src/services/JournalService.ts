import { supabase } from '../lib/supabase';

export interface JournalEntry {
    id: string;
    user_id: string;
    date: string;
    content: string;
    user_note?: string;
    mood: 'neutral' | 'fire' | 'ice' | 'skull';
    metrics_snapshot: {
        total_volume: number;
        volume_diff_percent?: number;
        workouts_count: number;
        prs_count: number;
        skipped_days: number;
        avg_weekly_sessions?: number;
    };
    created_at: string;
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; // Get Key from Env
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

class JournalService {

    // FALLBACK PROMPTS (Formal & Professional)
    private fallbackPrompts = {
        fire: [
            "Hoy registré un excelente rendimiento. Moví {volume}kg, lo que representa un aumento del {diff}% respecto a la sesión anterior. La progresión es sólida.",
            "Sesión muy productiva. He superado mis marcas anteriores y el volumen total de {volume}kg refleja un avance significativo en mi capacidad de trabajo.",
            "Buen desempeño físico hoy. Completé el entrenamiento con {volume}kg de carga total. La constancia está generando resultados medibles."
        ],
        ice: [
            "Entrenamiento completado sin contratiempos. Registré {volume}kg de volumen. Mantuve la técnica y la constancia, aunque el objetivo es aumentar la intensidad progresivamente.",
            "Sesión finalizada. {volume}kg acumulados. Fue un día de mantenimiento; el enfoque estuvo en cumplir con la programación establecida.",
            "Día de trabajo técnico. {volume}kg en total. No hubo récords personales, pero la regularidad es clave para el progreso a largo plazo."
        ],
        skull: [
            "Llevo {skipped} días sin registrar actividad. Es importante retomar la rutina para no perder las adaptaciones físicas ganadas.",
            "He notado una pausa de {skipped} días en mis entrenamientos. Necesito reorganizar mi agenda para recuperar la frecuencia habitual.",
            "Inactividad detectada de {skipped} días. La consistencia es el factor más importante; debo volver al gimnasio lo antes posible."
        ],
        neutral: [
            "Día de descanso activo o recuperación. Es fundamental permitir que el cuerpo asimile el esfuerzo de las sesiones anteriores.",
            "Sin datos recientes. Es un buen momento para revisar la planificación y establecer objetivos para la próxima semana."
        ]
    };

    /**
     * Get all journal entries for a user, ordered by date desc
     */
    async getEntries(userId: string) {
        return await supabase
            .from('ai_journals')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });
    }

    /**
     * Get specific entry for today (if exists)
     */
    async getTodayEntry(userId: string) {
        const today = new Date().toISOString().split('T')[0];
        return await supabase
            .from('ai_journals')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();
    }

    /**
     * Update the user's personal note
     */
    async updateUserNote(entryId: string, note: string) {
        return await supabase
            .from('ai_journals')
            .update({ user_note: note })
            .eq('id', entryId);
    }

    /**
     * GENERATE DAILY ANALYSIS (GEMINI POWERED - PROFESSIONAL MODE)
     * @param force If true, ignores existing entry and regenerates.
     */
    async generateEntry(userId: string, force: boolean = false, userContext?: string): Promise<JournalEntry | null> {
        const today = new Date().toISOString().split('T')[0];

        try {
            // 0. CHECK FOR STALE DATA (Smart Refresh)
            // If strictly NOT forced, we check if we have a "lazy" entry
            if (!force) {
                const { data: existing } = await this.getTodayEntry(userId);

                if (existing) {
                    // Check if existing says "0 workouts" but REALITY is different
                    // Only do this expensive check if existing seems empty
                    if (existing.metrics_snapshot.workouts_count === 0) {
                        const { count } = await supabase
                            .from('workout_sessions')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', userId)
                            .gte('started_at', `${today}T00:00:00`)
                            .lte('started_at', `${today}T23:59:59`);

                        // If DB has data but Entry says 0 -> FORCE REFRESH
                        if (count && count > 0) {
                            console.log("🔄 Smart Refresh: Validating Stale Entry (DB has workouts, Entry has 0)");
                            return this.generateEntry(userId, true, userContext);
                        }
                    }
                    // Otherwise return cached
                    return existing;
                }
            }

            // 2. GATHER DATA
            // A. Get Today's Workouts with RICH DETAILS
            const { data: todayWorkoutsData } = await supabase
                .from('workout_sessions')
                .select('*, workout_logs(*, equipment:exercise_id(name, target_muscle_group))')
                .eq('user_id', userId)
                .gte('started_at', `${today}T00:00:00`)
                .lte('started_at', `${today}T23:59:59`);

            // B. Get Recent History (Last 30 Days) for consistency analysis
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const strThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];

            const { data: historyWorkouts } = await supabase
                .from('workout_sessions')
                .select('started_at, gym_id')
                .eq('user_id', userId)
                .gte('started_at', `${strThirtyDaysAgo}T00:00:00`)
                .lt('started_at', `${today}T00:00:00`) // Exclude today
                .order('started_at', { ascending: false });

            // Analyze History
            const uniqueDays = new Set(historyWorkouts?.map(w => w.started_at.split('T')[0])).size;
            const avgSessionsPerWeek = Math.round((uniqueDays / 30) * 7);

            const todayWorkouts = todayWorkoutsData || [];
            const workoutsCount = todayWorkouts.length;

            // IDENTIFY ROUTINE CONTEXT
            // If multiple sessions, we focus on the last one for the main "Diagnosis"
            const lastTodaySession = todayWorkouts.length > 0 ? todayWorkouts[todayWorkouts.length - 1] : null;
            const routineName = lastTodaySession?.routine_name; // NEW COLUMN

            // B. Get PREVIOUS SESSION OF THE SAME ROUTINE (The "Reference Point")
            let referenceSession = null;
            if (routineName) {
                const { data: sameRoutineSession } = await supabase
                    .from('workout_sessions')
                    .select('*, workout_logs(*)')
                    .eq('user_id', userId)
                    .eq('routine_name', routineName) // Strict comparison
                    .lt('started_at', `${today}T00:00:00`)
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                referenceSession = sameRoutineSession;
            } else {
                // Fallback: Just get the absolute last session if no routine name match
                const { data: anyLastSession } = await supabase
                    .from('workout_sessions')
                    .select('*, workout_logs(*)')
                    .eq('user_id', userId)
                    .lt('started_at', `${today}T00:00:00`)
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                referenceSession = anyLastSession;
            }

            // 3. CALCULATE METRICS & CONTEXT
            let totalVolume = 0;
            let totalReps = 0; // NEW: Track total reps for analysis
            let maxWeight = 0; // NEW: Track max weight for analysis
            const exercisesDetails: any[] = [];
            const trainedMuscles = new Set<string>();

            // Current Session Analysis
            todayWorkouts.forEach(session => {
                session.workout_logs?.forEach((log: any) => {
                    const vol = (log.weight_kg || 0) * (log.reps || 0);
                    totalVolume += vol;
                    totalReps += (log.reps || 0); // Accumulate reps
                    if ((log.weight_kg || 0) > maxWeight) maxWeight = log.weight_kg || 0; // Track max load

                    const exerciseName = log.equipment?.name || "Ejercicio Desconocido";
                    const muscle = log.equipment?.target_muscle_group || "General";
                    trainedMuscles.add(muscle);

                    exercisesDetails.push({
                        name: exerciseName,
                        muscle: muscle,
                        weight: log.weight_kg,
                        reps: log.reps,
                        set_vol: vol,
                        is_pr: log.is_pr || false
                    });
                });
            });

            // Reference Session Analysis
            let prevVolume = 0;
            let prevReps = 0;
            let prevMaxWeight = 0;

            if (referenceSession && referenceSession.workout_logs) {
                referenceSession.workout_logs.forEach((log: any) => {
                    prevVolume += (log.weight_kg || 0) * (log.reps || 0);
                    prevReps += (log.reps || 0);
                    if ((log.weight_kg || 0) > prevMaxWeight) prevMaxWeight = log.weight_kg || 0;
                });
            }

            // Metrics
            let volumeDiffPercent = 0;
            if (prevVolume > 0) {
                volumeDiffPercent = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
            }

            // Consistency (Days since LAST workout of ANY kind)
            let skippedDays = 0;
            // Fetch strict last active date ignoring routine
            const { data: lastActiveSession } = await supabase
                .from('workout_sessions')
                .select('started_at')
                .eq('user_id', userId)
                .lt('started_at', `${today}T00:00:00`)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastActiveSession) {
                const lastDate = new Date(lastActiveSession.started_at);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - lastDate.getTime());
                skippedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
            }

            // 4. GATHER HISTORICAL CONTEXT (MEMORY)
            // Fetch last 5 entries to give the AI a "Memory" of recent user notes/events
            const { data: recentHistoryEntries } = await supabase
                .from('ai_journals')
                .select('date, user_note, mood')
                .eq('user_id', userId)
                .lt('date', today)
                .order('date', { ascending: false })
                .limit(5);

            const narrativeHistory = recentHistoryEntries?.map(e => ({
                date: e.date,
                mood: e.mood,
                note: e.user_note || "Sin nota"
            })) || [];

            // 5. PREPARE CONTEXT FOR AI (THE AUDITOR DOSSIER WITH MEMORY)
            const context = {
                user_id: userId,
                date: today,
                routine_name: routineName || "Entrenamiento Libre",
                user_input_context: userContext || "Sin comentarios del usuario para hoy.",
                past_user_notes: narrativeHistory, // NEW: Long-term memory
                workouts_today: workoutsCount,
                trained_muscles: Array.from(trainedMuscles),
                performance: {
                    volume: { current: totalVolume, previous: prevVolume, diff_percent: volumeDiffPercent },
                    intensity_max_weight: { current: maxWeight, previous: prevMaxWeight },
                    accumulated_reps: { current: totalReps, previous: prevReps }
                },
                consistency: {
                    days_since_last_workout: skippedDays,
                    avg_weekly_sessions: avgSessionsPerWeek
                }
            };

            // 6. CALL GEMINI (THE AUDITOR)
            let aiContent = "";
            let aiMood: 'fire' | 'ice' | 'skull' | 'neutral' = 'neutral';

            if (GEN_AI_KEY) {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                    const systemPrompt = `
                        ROL: Eres el AUDITOR DE RENDIMIENTO DEPORTIVO. Tu memoria es perfecta.
                        FILOSOFÍA: "Los números no mienten, pero el contexto importa."
                        
                        TONO: 100% Objetivo, Científico-Deportivo, Profesional.
                        IDIOMA: Español (Neutro).
                        
                        PROHIBIDO (Banneados): "Soldado", "Misión", "Guerra", "Batalla", "Técnica" (a menos que el usuario la mencione), "Intuir" (no adivines).
                        PALABRAS CLAVE: Carga, Volumen, Intensidad Relativa, Frecuencia, Adaptación, Sobrecarga Progresiva.

                        OBJETIVO:
                        1. Comparar sesión actual vs anterior.
                        2. Determinar el enfoque fisiológico (Fuerza vs Hipertrofia) basado en datos.
                        3. **MEMORIA SINTETIZADA:** Analiza el "past_user_notes" (Historial de notas del usuario).
                           - Si el usuario reportó lesión hace 2 sesiones y hoy bajó carga, MENCIONALO: "Coherente con lesión reportada el [fecha]".
                           - Si el usuario dijo "voy a comer mejor" y hoy rompió PRs, MENCIONALO: "Posible correlación con dieta reportada".
                           - Construye una narrativa continua, no solo analises el día aislado.

                        DATOS DE ENTRADA:
                        ${JSON.stringify(context, null, 2)}
                        
                        SALIDA REQUERIDA (JSON):
                        {
                            "mood": "fire" (Progreso Real) | "ice" (Mantenimiento/Deload) | "skull" (Regresión Injustificada),
                            "verdict": "Resumen de 3-5 palabras. Ej: 'Fuerza +5%. Recuperación visible.'",
                            "content": "Análisis fáctico. Conecta los puntos entre los datos de hoy y las notas pasadas del usuario. Si hay continuidad en sus comentarios (ej: dolor persistente), señálalo."
                        }
                    `;

                    const result = await model.generateContent(systemPrompt);
                    const responseText = result.response.text();
                    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);

                    aiContent = parsed.content;
                    aiMood = parsed.mood;
                    // Note: 'verdict' is currently not stored in DB, we inject it into content or handle it later. 
                    // To keep DB schema simple, we'll PREPEND the verdict to the content formatted nicely.
                    aiContent = `[${parsed.verdict}] ${aiContent}`;

                } catch (apiError) {
                    console.error("Gemini API Error:", apiError);
                }
            }

            // FALLBACK LOGIC
            if (!aiContent) {
                console.warn("Using Fallback AI Logic");
                if (workoutsCount > 0) {
                    if (volumeDiffPercent > 5) {
                        aiMood = 'fire';
                        aiContent = this.getRandomFallback('fire');
                    } else {
                        aiMood = 'ice';
                        aiContent = this.getRandomFallback('ice');
                    }
                    // Simple replacement for fallback genericness
                    if (trainedMuscles.size > 0) {
                        aiContent += ` El enfoque principal fue: ${Array.from(trainedMuscles).join(', ')}.`;
                    }
                } else {
                    if (skippedDays > 2) {
                        aiMood = 'skull';
                        aiContent = this.getRandomFallback('skull');
                    } else {
                        aiMood = 'neutral';
                        aiContent = this.getRandomFallback('neutral');
                    }
                }

                aiContent = aiContent
                    .replace('{volume}', totalVolume.toLocaleString())
                    .replace('{diff}', volumeDiffPercent > 0 ? `+${volumeDiffPercent}` : `${volumeDiffPercent}`)
                    .replace('{skipped}', skippedDays.toString());
            }

            // 6. SAVE OR UPDATE DB
            // If forced, we might want to update the existing record instead of inserting specific constraints
            // But 'upsert' works if we have a unique constraint on (user_id, date). 
            // In setup we might not have set unique constraint strictly, let's check basic logic:

            const snapshot = {
                total_volume: totalVolume,
                volume_diff_percent: volumeDiffPercent,
                workouts_count: workoutsCount,
                prs_count: 0, // Need deeper logic for real PRs
                skipped_days: skippedDays,
                avg_weekly_sessions: avgSessionsPerWeek,
                muscles: Array.from(trainedMuscles)
            };

            const payload = {
                user_id: userId,
                date: today,
                content: aiContent,
                mood: aiMood,
                metrics_snapshot: snapshot
            };

            const { data: newEntry, error } = await supabase
                .from('ai_journals')
                .upsert(payload, { onConflict: 'user_id,date' }) // Assuming unique index exists
                .select()
                .single();

            if (error) throw error;
            return newEntry;

        } catch (error) {
            console.error("AI Journal Generation Failed:", error);
            return null;
        }
    }

    private getRandomFallback(type: 'fire' | 'ice' | 'skull' | 'neutral'): string {
        const list = this.fallbackPrompts[type];
        return list[Math.floor(Math.random() * list.length)];
    }
}

export const journalService = new JournalService();
