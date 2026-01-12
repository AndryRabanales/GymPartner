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
     */
    /**
     * GENERATE DAILY ANALYSIS (GEMINI POWERED - PROFESSIONAL MODE)
     * @param force If true, ignores existing entry and regenerates.
     */
    async generateEntry(userId: string, force: boolean = false): Promise<JournalEntry | null> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if already exists (unless forced)
        if (!force) {
            const { data: existing } = await this.getTodayEntry(userId);
            if (existing) return existing;
        }

        try {
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

            // B. Get Previous Session (Most recent before today)
            const { data: lastSession } = await supabase
                .from('workout_sessions')
                .select('*, workout_logs(*)')
                .eq('user_id', userId)
                .lt('started_at', `${today}T00:00:00`)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // 3. CALCULATE METRICS & CONTEXT
            const todayWorkouts = todayWorkoutsData || [];
            const workoutsCount = todayWorkouts.length;

            let totalVolume = 0;
            const exercisesDetails: any[] = [];
            const trainedMuscles = new Set<string>();

            todayWorkouts.forEach(session => {
                session.workout_logs?.forEach((log: any) => {
                    const vol = (log.weight_kg || 0) * (log.reps || 0);
                    totalVolume += vol;

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

            const topExercises = exercisesDetails
                .sort((a, b) => b.weight_kg - a.weight_kg) // Sort by heavy lift
                .slice(0, 5); // Take top 5 heaviest lifts

            let prevVolume = 0;
            if (lastSession && lastSession.workout_logs) {
                lastSession.workout_logs.forEach((log: any) => {
                    prevVolume += (log.weight_kg || 0) * (log.reps || 0);
                });
            }

            let volumeDiffPercent = 0;
            if (prevVolume > 0) {
                volumeDiffPercent = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
            }

            let skippedDays = 0;
            if (workoutsCount === 0 && lastSession) {
                const lastDate = new Date(lastSession.started_at);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - lastDate.getTime());
                skippedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
            }

            // 4. PREPARE CONTEXT FOR AI
            const context = {
                user_id: userId,
                date: today,
                workouts_today: workoutsCount,
                trained_muscles: Array.from(trainedMuscles),
                top_exercises_performed: topExercises,
                total_volume_kg: totalVolume,
                previous_volume_kg: prevVolume,
                volume_change_percent: volumeDiffPercent,
                skipped_days_streak: skippedDays,
                history_30_days: {
                    total_sessions: uniqueDays,
                    avg_per_week: avgSessionsPerWeek
                },
                is_active_day: workoutsCount > 0
            };

            // 5. CALL GEMINI (OR FALLBACK)
            let aiContent = "";
            let aiMood: 'fire' | 'ice' | 'skull' | 'neutral' = 'neutral';

            if (GEN_AI_KEY) {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                    const systemPrompt = `
                        ACT AS: An elite professional sports analyst and personal trainer writing a daily journal for the user.
                        PERSPECTIVE: First Person ("Hoy entrené...", "Me sentí...", "Logré...").
                        TONE: Formal, Objective, Analytical, encouraging but grounded in data.
                        LANGUAGE: Spanish (Español Neutro/Formal).
                        
                        GOAL: Provide a deep yet concise analysis of today's performance, comparing it with history.
                        
                        INPUT DATA:
                        ${JSON.stringify(context, null, 2)}
                        
                        GUIDELINES:
                        1. **Focus on Muscles & Exercises**: Mention specific muscles trained (e.g., "El enfoque de hoy fue Pectoral y Tríceps"). Mention the heaviest or most significant exercises.
                        2. **Analyze Progress**: Compare today's volume vs previous. Did I lift more? Did I maintain? 
                        3. **Check Consistency**: If I missed days, mention it constructively ("Tras 3 días de inactividad..."). If constant, praise discipline.
                        4. **Structure**: 
                           - Sentence 1: Summary of what was done (Muscles/Key Exercises).
                           - Sentence 2: Quantitative analysis (Volume, progress, intensity).
                           - Sentence 3: Conclusion/Forward looking statement.
                        5. **Safety**: No medical advice. No "pain" talk unless recovery related.
                        6. **Length**: Maximum 3-4 powerful sentences.
                        
                        MOOD LOGIC (Internal):
                           - FIRE: workouts_today > 0 AND (volume improved OR PR set).
                           - ICE: workouts_today > 0 AND volume stable.
                           - SKULL: skipped_days_streak > 3.
                           - NEUTRAL: Rest day or light recovery.
                        
                        OUTPUT FORMAT (JSON):
                        {
                            "mood": "fire" | "ice" | "skull" | "neutral",
                            "content": "The narrative text..."
                        }
                    `;

                    const result = await model.generateContent(systemPrompt);
                    const responseText = result.response.text();

                    // Clean code fences if present
                    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);

                    aiContent = parsed.content;
                    aiMood = parsed.mood;

                } catch (apiError) {
                    console.error("Gemini API Error:", apiError);
                    // Fallback handled below
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
