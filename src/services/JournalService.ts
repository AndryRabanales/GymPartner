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
    };
    created_at: string;
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; // Get Key from Env
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

class JournalService {

    // FALLBACK PROMPTS (First Person - "Ghostwriter" Mode)
    private fallbackPrompts = {
        fire: [
            "Hoy me sentí imparable. Moví {volume}kg, un {diff}% más que la última vez. La constancia está pagando dividendos y me siento más fuerte que nunca.",
            "Increíble sesión. Rompí récords personales y siento que recuperé el control. {volume}kg totales es mi nueva norma. A seguir así.",
            "Territorio conquistado. Completé mi entrenamiento con {volume}kg de volumen. Me siento disciplinado y en camino a mi mejor versión."
        ],
        ice: [
            "Cumplí con el deber. {volume}kg movidos. No fue mi mejor sesión, pero la disciplina es ir incluso cuando no hay ganas.",
            "Entrenamiento finalizado. Mantuve el ritmo con {volume}kg, aunque sé que puedo dar un poco más de intensidad la próxima vez.",
            "Día de trabajo honesto. {volume}kg en la bolsa. No rompí récords, pero mantuve la racha viva."
        ],
        skull: [
            "He fallado. Llevo {skipped} días sin entrenar y se nota. Me siento estancado y necesito romper este ciclo de inactividad ya.",
            "La pereza me ganó estos últimos {skipped} días. Es hora de dejar las excusas y volver al hierro. Me siento decepcionado pero motivado a cambiar.",
            "Desconexión total. {skipped} días fuera del gimnasio. Mi disciplina está flaqueando y necesito retomarla urgentemente."
        ],
        neutral: [
            "Hoy toca descanso o desconexión. La recuperación es parte del proceso, siempre y cuando no se convierta en hábito.",
            "Sin actividad registrada. Es un buen momento para reflexionar sobre mis objetivos y planificar la semana."
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
     * GENERATE DAILY ANALYSIS (GEMINI POWERED - ABOTBIOGRAPHER MODE)
     */
    async generateEntry(userId: string): Promise<JournalEntry | null> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if already exists
        const { data: existing } = await this.getTodayEntry(userId);
        if (existing) return existing;

        try {
            // 2. GATHER DATA
            // A. Get Today's Workouts
            const { data: todayWorkoutsData } = await supabase
                .from('workout_sessions')
                .select('*, workout_logs(*)')
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

            // 3. CALCULATE METRICS
            const todayWorkouts = todayWorkoutsData || [];
            const workoutsCount = todayWorkouts.length;

            let totalVolume = 0;
            // Simplified PR tracking (would need real checking against history)
            let prsCount = 0;

            todayWorkouts.forEach(session => {
                session.workout_logs?.forEach((log: any) => {
                    totalVolume += (log.weight_kg || 0) * (log.reps || 0);
                });
            });

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
                        ACT AS: The user writing their own personal gym journal / diary.
                        PERSPECTIVE: First Person ("I", "Me", "My", "Hoy hice...", "Me sentí...").
                        TONE: Realistic, introspective, slightly analytical but human. "Quantified Self".
                        LANGUAGE: Spanish (Español Neutro/Latino).
                        
                        TASK: Write a diary entry summarizing my gym performance today based on the data.
                        
                        RULES:
                        1. START DIRECTLY with the reflection. No "Querido diario".
                        2. Max 3 sentences. Concise but meaningful.
                        3. MENTION SPECIFICS: "Today I lifted X kg", "I've been consistent this week", "I skipped X days".
                        4. ANALYZE CONSISTENCY: Compare today vs my 30-day average (avg_per_week).
                        5. MOOD LOGIC:
                           - FIRE: workouts_today > 0 AND (volume_change_percent > 5 OR total_volume_kg > previous_volume_kg). Be proud.
                           - ICE: workouts_today > 0 AND volume mainly flat/lower. Be honest/neutral about effort.
                           - SKULL: workouts_today == 0 AND skipped_days_streak > 2. Be disappointed/worried about the streak.
                           - NEUTRAL: Rest day or light activity.
                        
                        OUTPUT FORMAT (JSON):
                        {
                            "mood": "fire" | "ice" | "skull" | "neutral",
                            "content": "The text of the entry..."
                        }
                        
                        DATA:
                        ${JSON.stringify(context)}
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
                    // Fallback to local logic logic below
                }
            }

            // FALLBACK LOGIC (If API Key missing or API error)
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
                } else {
                    if (skippedDays > 2) {
                        aiMood = 'skull';
                        aiContent = this.getRandomFallback('skull');
                    } else {
                        aiMood = 'neutral';
                        aiContent = this.getRandomFallback('neutral');
                    }
                }

                // Replace placeholders in fallback
                aiContent = aiContent
                    .replace('{volume}', totalVolume.toLocaleString())
                    .replace('{diff}', volumeDiffPercent > 0 ? `+${volumeDiffPercent}` : `${volumeDiffPercent}`)
                    .replace('{prs}', prsCount.toString())
                    .replace('{skipped}', skippedDays.toString());
            }

            // 6. SAVE TO DB
            const snapshot = {
                total_volume: totalVolume,
                volume_diff_percent: volumeDiffPercent,
                workouts_count: workoutsCount,
                prs_count: prsCount,
                skipped_days: skippedDays,
                avg_weekly_sessions: avgSessionsPerWeek
            };

            const { data: newEntry, error } = await supabase
                .from('ai_journals')
                .insert({
                    user_id: userId,
                    date: today,
                    content: aiContent,
                    mood: aiMood,
                    metrics_snapshot: snapshot
                })
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
