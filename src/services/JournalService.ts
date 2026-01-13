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

    // FALLBACK PROMPTS (Strictly Factual & 3rd Person)
    private fallbackPrompts = {
        fire: [
            "{userName} registró un aumento de volumen, moviendo un total de {volume}kg (+{diff}%).",
            "Sesión de alto volumen para {userName}. Carga total acumulada: {volume}kg.",
            "{userName} superó el rendimiento anterior con {volume}kg totales."
        ],
        ice: [
            "{userName} registró {volume}kg de volumen total.",
            "Sesión finalizada por {userName} con {volume}kg acumulados.",
            "{userName} completó el entrenamiento registrando {volume}kg."
        ],
        skull: [
            "{userName} lleva {skipped} días sin registrar actividad.",
            "Se registra una pausa de {skipped} días en los entrenamientos de {userName}.",
            "Inactividad de {skipped} días detectada para {userName}."
        ],
        neutral: [
            "Registro de descanso o recuperación para {userName}.",
            "Sin datos de entrenamiento recientes para {userName}."
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
    async generateEntry(userId: string, userName: string, force: boolean = false, userContext?: string): Promise<JournalEntry | null> {
        // DEBUG: Check API Key status
        const keyStatus = GEN_AI_KEY ? `Present (${GEN_AI_KEY.substring(0, 10)}...)` : "MISSING";
        console.log(`🔑 Gemini Key Status: ${keyStatus}`);

        const today = new Date().toISOString().split('T')[0];

        // 0. Use Provided Name (Safe Fallback)
        const finalUserName = userName || "Usuario";

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
                            return this.generateEntry(userId, finalUserName, true, userContext);
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
            // Fetch last 30 entries (USER REQUEST: DEEP MEMORY)
            const { data: recentHistoryEntries } = await supabase
                .from('ai_journals')
                .select('date, user_note, mood')
                .eq('user_id', userId)
                .lt('date', today)
                .order('date', { ascending: false })
                .limit(30);

            const narrativeHistory = recentHistoryEntries?.map(e => ({
                date: e.date,
                mood: e.mood,
                note: e.user_note || "Sin nota"
            })) || [];

            // 5. PREPARE CONTEXT FOR AI (THE AUDITOR DOSSIER WITH MEMORY)
            const context = {
                user_id: userId,
                user_name: userName, // NEW: For personalized 3rd person
                date: today,
                routine_name: routineName || "Entrenamiento Libre",
                user_input_context: userContext || "Sin comentarios del usuario para hoy.",
                past_user_notes: narrativeHistory, // NEW: Long-term memory (30 days)
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
                // FALLBACK MODEL STRATEGY: Try Pinned Flash -> Generic Flash -> Legacy Pro
                const modelsToTry = ["gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-pro"];
                let analyzed = false;

                // 2026-01-13 FIX: Merge System Prompt into User Message to avoid "systemInstruction" 404/400 errors
                // This is a compat-mode for Gemini 1.5 Flash 001 via current endpoint.
                const combinedPrompt = `
                    [SYSTEM INSTRUCTIONS]
                    ROL: Eres el AUDITOR DE RENDIMIENTO DEPORTIVO. Tu memoria es perfecta y abarca las últimas 30 sesiones.
                    FILOSOFÍA: "Los números no mienten, pero el contexto del usuario es la LEY."
                    TONO: 100% Objetivo, Científico-Deportivo, Profesional.
                    PERSPECTIVA: TERCERA PERSONA (El Observador).
                    SUJETO: ${userName}.
                    IDIOMA: Español (Neutro).
                    
                    MANDAMIENTOS DE MEMORIA:
                    1. ADHERENCIA A NOTAS: Si el usuario escribió algo en las últimas 30 sesiones, ÚSALO.
                    2. DETECTIVISMO: Busca patrones en "past_user_notes".
                    3. EVOLUCIÓN: Compara con hace 3 semanas.
                    
                    PROHIBIDO: "Soldado", "Misión", "Guerra", "Batalla", Primera Persona ("Yo").
                    PALABRAS CLAVE: Carga, Volumen, Intensidad Relativa, Frecuencia, Adaptación, Sobrecarga Progresiva.

                    [USER REQUEST]
                    OBJETIVO:
                    1. Comparar sesión actual vs anterior.
                    2. Determinar enfoque fisiológico.
                    3. Analizar historial y notas (Memoria Sintetizada).
                    
                    DATOS DE ENTRADA:
                    ${JSON.stringify(context, null, 2)}
                    
                    SALIDA REQUERIDA (JSON):
                    {
                        "mood": "fire" | "ice" | "skull",
                        "verdict": "Resumen de 3-5 palabras.",
                        "content": "Análisis fáctico en TERCERA PERSONA. Cita notas históricas si son relevantes."
                    }
                `;

                for (const modelName of modelsToTry) {
                    if (analyzed) break;
                    try {
                        // Use SIMPLEST config: Model name only (no systemInstruction param)
                        const model = genAI.getGenerativeModel({
                            model: modelName,
                            generationConfig: { responseMimeType: "application/json" } // Keep JSON safeguard
                        });

                        const result = await model.generateContent(combinedPrompt);
                        const responseText = result.response.text();
                        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanJson);

                        aiContent = parsed.content;
                        aiMood = parsed.mood;
                        aiContent = `[${parsed.verdict}] ${aiContent}`;
                        analyzed = true; // Mark as success to exit loop

                    } catch (apiError: any) {
                        console.warn(`⚠️ Gemini Model ${modelName} Failed.`);

                        if (apiError.toString().includes('404')) {
                            console.error("🔴 ERROR 404: API no habilitada o Modelo no encontrado.");
                        }
                        if (apiError.toString().includes('400')) {
                            console.error("🔴 ERROR 400: Solicitud inválida.");
                        }
                    }
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
                    .replace(/{userName}/g, finalUserName)
                    .replace('{volume}', totalVolume.toLocaleString())
                    .replace('{diff}', volumeDiffPercent > 0 ? `+${volumeDiffPercent}` : `${volumeDiffPercent}`)
                    .replace('{skipped}', skippedDays.toString());
            }

            // 6. SAVE OR UPDATE DB
            const snapshot = {
                total_volume: totalVolume,
                volume_diff_percent: volumeDiffPercent,
                workouts_count: workoutsCount,
                prs_count: 0,
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
                .upsert(payload, { onConflict: 'user_id,date' })
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
