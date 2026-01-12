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

    // FALLBACK PROMPTS (Used if AI fails)
    private fallbackPrompts = {
        fire: [
            "Has despertado. {volume}kg movidos. Un incremento del {diff}% respecto a tu última batalla. Mantén este ritmo o vuelve a ser mediocre.",
            "Excelente despliegue. Rompiste {prs} marcas personales hoy. La debilidad está abandonando tu cuerpo, pero no te confíes.",
            "Territorio conquistado. Tu volumen de {volume}kg demuestra disciplina. Mañana te quiero igual o mejor."
        ],
        ice: [
            "Cumpliste, pero no impresionaste. {volume}kg es un número estándar para alguien de tu nivel. Exígete más.",
            "Asistencia registrada. Hiciste el trabajo, pero faltó intensidad. La guerra no se gana con esfuerzo mínimo.",
            "Estás en zona de confort. {volume}kg es aceptable, pero no es legendario. Define si quieres ser soldado o general."
        ],
        skull: [
            "Deserción detectada. Has faltado {skipped} días. Tu legado se desmorona mientras buscas excusas.",
            "Indigno. La inactividad es el enemigo y hoy perdiste. {skipped} días sin reportarte es inaceptable.",
            "Patético. Tu disciplina brilla por su ausencia. Vuelve al frente antes de que sea tarde."
        ],
        neutral: [
            "Día de descanso o actividad no registrada. Recuerda que la recuperación también es estrategia, si es merecida.",
            "Sin datos de combate recientes. El silencio en el radar es peligroso."
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
     * GENERATE DAILY ANALYSIS (GEMINI POWERED)
     */
    async generateEntry(userId: string): Promise<JournalEntry | null> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if already exists
        const { data: existing } = await this.getTodayEntry(userId);
        if (existing) return existing;

        try {
            // 2. GATHER DATA
            const { data: workouts } = await supabase
                .from('workout_sessions')
                .select('*, workout_logs(*)')
                .eq('user_id', userId)
                .gte('started_at', `${today}T00:00:00`)
                .lte('started_at', `${today}T23:59:59`);

            const { data: lastSession } = await supabase
                .from('workout_sessions')
                .select('*, workout_logs(*)')
                .eq('user_id', userId)
                .lt('started_at', `${today}T00:00:00`)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // 3. CALCULATE METRICS
            const todayWorkouts = workouts || [];
            const workoutsCount = todayWorkouts.length;

            let totalVolume = 0;
            // Simplified PR tracking (would need real checking against history)
            let prsCount = 0;

            todayWorkouts.forEach(session => {
                session.workout_logs?.forEach((log: any) => {
                    totalVolume += (log.weight_kg || 0) * (log.reps || 0);
                });
                // Naive way to get exercise names if available (would need join or separate query usually, 
                // but logs might not have name directly depending on structure. 
                // Assuming we might not have names easily without join. We will stick to numbers for now.)
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
                is_active_day: workoutsCount > 0
            };

            // 5. CALL GEMINI (OR FALLBACK)
            let aiContent = "";
            let aiMood: 'fire' | 'ice' | 'skull' | 'neutral' = 'neutral';

            if (GEN_AI_KEY) {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                    const systemPrompt = `
                        ACT AS: "Iron Sergeant", a tactical military training analyst.
                        TONE: Stoic, tough, disciplined, aggressively motivating but fair. "Tough Love".
                        LANGUAGE: Spanish (Español Neutro/Latino).
                        
                        TASK: Analyze the provided workout data and generate a daily report entry.
                        
                        RULES:
                        1. NO greeting like "Hola". Start directly with the verdict.
                        2. Max 3 sentences. Short, punchy.
                        3. Use military/tactical terminology (battle, war, front, mission, ops).
                        4. IF workouts_today > 0 AND volume_change_percent > 5: Praise lightly but demand more. (Mood: FIRE)
                        5. IF workouts_today > 0 AND volume_change_percent <= 5: Acknowledge effort, criticize lack of intensity. (Mood: ICE)
                        6. IF workouts_today == 0:
                           - If skipped_days_streak > 2: BRUTAL criticism. Call them deserter. (Mood: SKULL)
                           - If skipped_days_streak <= 2: Suspicious check-in. Ask if they are resting or slacking. (Mood: NEUTRAL)
                        
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
                skipped_days: skippedDays
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
