
import type { WorkoutSession } from '../services/WorkoutService';

export const EQUIPMENT_MUSCLE_GROUPS = [
    'Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core', 'Cardio'
];

export class StatsAnalyzer {
    /**
     * Calculates Estimated 1RM using the Epley Formula.
     * 1RM = weight * (1 + reps / 30)
     */
    static calculate1RM(weight: number, reps: number): number {
        if (reps === 1) return weight;
        if (reps === 0) return 0;
        return Math.round(weight * (1 + reps / 30));
    }

    /**
     * Processes workout history to determine muscle balance (number of sets per group).
     * Returns data format suitable for Recharts RadarChart.
     */
    static processMuscleBalance(sessions: WorkoutSession[]) {
        const muscleCounts: Record<string, number> = {};

        // Initialize all groups to 0 to ensure shape is complete
        EQUIPMENT_MUSCLE_GROUPS.forEach(group => {
            muscleCounts[group] = 0;
        });

        sessions.forEach(session => {
            // @ts-ignore - Supabase join type safety
            session.workout_logs?.forEach((log: any) => {
                const sets = log.sets || 1;


                // Add to Muscle Counts (Normalization)
                // Try to get muscle group from joined equipment
                let equipmentData = log.equipment;
                if (Array.isArray(equipmentData) && equipmentData.length > 0) equipmentData = equipmentData[0];
                // 1. Define Standard Mappings
                const mapping: Record<string, string> = {
                    'chest': 'Pecho', 'pectorales': 'Pecho', 'pecho': 'Pecho',
                    'back': 'Espalda', 'dorsales': 'Espalda', 'espalda': 'Espalda',
                    'legs': 'Pierna', 'cuádriceps': 'Pierna', 'isquios': 'Pierna', 'glúteos': 'Pierna', 'pierna': 'Pierna',
                    'shoulders': 'Hombro', 'deltoides': 'Hombro', 'hombro': 'Hombro',
                    'biceps': 'Bíceps', 'bíceps': 'Bíceps',
                    'triceps': 'Tríceps', 'tríceps': 'Tríceps',
                    'abs': 'Core', 'abdominales': 'Core', 'core': 'Core',
                    'cardio': 'Cardio'
                };

                // 2. Initial Normalization from DB OR History Snapshot
                // PRIORITY: History Snapshot > Live DB Data
                let muscle = log.category_snapshot || equipmentData?.target_muscle_group;

                // If snapshot is generic "Custom" or empty, fall back to live data? 
                // No, if snapshot is present, we trust it was the state at that time.
                // UNLESS it is explicitly "Custom" which isn't a muscle.
                if (muscle === 'Custom') muscle = equipmentData?.target_muscle_group;

                let cleanMuscle = muscle ? (mapping[muscle.toLowerCase()] || muscle) : null;
                const isValidMuscle = cleanMuscle && EQUIPMENT_MUSCLE_GROUPS.includes(cleanMuscle);

                // 3. Smart Fallback: If DB category is Missing OR Generic/Custom (not in radar), check Name
                if (!isValidMuscle) {
                    const exerciseName = (equipmentData?.name || '').toLowerCase();

                    // A. Prioritize Name Heuristics
                    if (exerciseName) {
                        if (exerciseName.includes('jalon') || exerciseName.includes('remo') || exerciseName.includes('dominadas') || exerciseName.includes('polea')) cleanMuscle = 'Espalda';
                        else if (exerciseName.includes('banco') || exerciseName.includes('pec') || exerciseName.includes('press') || exerciseName.includes('cruce')) cleanMuscle = 'Pecho';
                        else if (exerciseName.includes('sentadilla') || exerciseName.includes('prensa') || exerciseName.includes('extension') || exerciseName.includes('curl femoral')) cleanMuscle = 'Pierna';
                        else if (exerciseName.includes('militar') || exerciseName.includes('lateral') || exerciseName.includes('hombro')) cleanMuscle = 'Hombro';
                        else if (exerciseName.includes('biceps') || exerciseName.includes('bíceps') || exerciseName.includes('curl')) cleanMuscle = 'Bíceps';
                        else if (exerciseName.includes('triceps') || exerciseName.includes('tríceps') || exerciseName.includes('copa')) cleanMuscle = 'Tríceps';
                        else if (exerciseName.includes('abs') || exerciseName.includes('crunch') || exerciseName.includes('plancha')) cleanMuscle = 'Core';
                    }

                    // B. Secondary Fallback: Check if we now have a valid muscle
                    const isNowValid = cleanMuscle && EQUIPMENT_MUSCLE_GROUPS.includes(cleanMuscle);

                    if (!isNowValid) {
                        // C. Last Resort: Metrics or Catch-All
                        // User Request: "If nothing recognized, then Cardio"
                        if ((log.time || log.metrics_data?.time) > 0) cleanMuscle = 'Cardio';
                        else if ((log.distance || log.metrics_data?.distance) > 0) cleanMuscle = 'Cardio';
                        else if (log.metrics_data && Object.keys(log.metrics_data).length > 0) cleanMuscle = 'Cardio';
                        else cleanMuscle = 'Cardio'; // Final catch-all as requested
                    }
                }

                if (cleanMuscle && muscleCounts[cleanMuscle] !== undefined) {
                    muscleCounts[cleanMuscle] += sets;
                }
            });
        });

        // Convert to Recharts format
        // Recharts Radar expects: { subject: 'Math', A: 120, fullMark: 150 }
        const data = Object.keys(muscleCounts).map(key => ({
            subject: key,
            A: muscleCounts[key],
            fullMark: Math.max(...Object.values(muscleCounts)) * 1.2 || 10 // Dynamic scale
        }));

        return data;
    }

    /**
     * Finds the best estimated 1RM for a specific exercise in history.
     */
    static getBest1RM(sessions: WorkoutSession[], equipmentId: string) {
        let max1RM = 0;
        let bestLift = { weight: 0, reps: 0, date: '' };

        sessions.forEach(session => {
            // @ts-ignore
            session.workout_logs?.filter((log: any) => log.exercise_id === equipmentId).forEach((log: any) => {
                const est1RM = this.calculate1RM(log.weight_kg, log.reps);
                if (est1RM > max1RM) {
                    max1RM = est1RM;
                    bestLift = {
                        weight: log.weight_kg,
                        reps: log.reps,
                        date: session.started_at
                    };
                }
            });
        });

        return { estimatedMax: max1RM, bestLift };
    }

    /**
     * Processes weekly volume trends for the last 12 weeks.
     */
    static processVolumeTrends(sessions: WorkoutSession[]) {
        const weeks: Record<string, number> = {};

        // Helper: Get the Monday of the week for a given date
        const getMonday = (d: Date) => {
            const date = new Date(d);
            const day = date.getDay(); // 0 (Sun) to 6 (Sat)
            const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(date.setDate(diff));
            return monday.toISOString().split('T')[0]; // YYYY-MM-DD
        };

        sessions.forEach(session => {
            if (!session.started_at) return;
            const date = new Date(session.started_at);
            const weekStart = getMonday(date);

            let sessionVol = 0;
            // @ts-ignore
            session.workout_logs?.forEach((log: any) => {
                const sets = log.sets || 1;
                let logVol = 0;

                // 1. Standard Weight Volume
                if (log.weight_kg > 0) {
                    logVol = (log.weight_kg * log.reps * sets);
                }
                // 2. Specific Cardio Mapping (Time/Distance)
                else if ((log.time || log.metrics_data?.time) > 0) {
                    const t = (log.time || log.metrics_data?.time);
                    logVol = t * 1.5;
                }
                else if ((log.distance || log.metrics_data?.distance) > 0) {
                    const d = (log.distance || log.metrics_data?.distance);
                    logVol = d * 0.5;
                }
                // 3. Bodyweight/Calisthenics (Reps Only)
                else if (log.reps > 0) {
                    logVol = (log.reps * 60 * sets * 0.5);
                }
                // 4. Fallback: GENERIC CUSTOM METRIC (e.g. "Saltos", "Burpees")
                else if (log.metrics_data) {
                    // Sum all numeric values found in the custom JSON
                    const customSum = Object.values(log.metrics_data).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
                    logVol = customSum * 0.5; // Default Work Score for unknown metrics
                }

                sessionVol += logVol;
            });

            weeks[weekStart] = (weeks[weekStart] || 0) + sessionVol;
        });

        // Convert to array and sort by date
        const sortedWeeks = Object.entries(weeks)
            .map(([date, volume]) => ({ date, volume }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Format for Chart (Last 10 weeks)
        return sortedWeeks.slice(-10).map(w => {
            const d = new Date(w.date);
            // Format: "12 Oct"
            const name = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            return {
                name,
                volume: w.volume,
                fullDate: w.date // Keep for debugging or advanced tooltips if needed
            };
        });
    }

    /**
     * Generates a date-value map for the heatmap.
     */
    static processConsistency(sessions: WorkoutSession[]) {
        const heatmap: Record<string, number> = {};

        sessions.forEach(session => {
            if (!session.started_at) return;
            const d = new Date(session.started_at);
            // Use local time to ensure "Today" means "Today" for the user, 
            // regardless of UTC offset (fixes 24h/timezone issues).
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            heatmap[dateKey] = (heatmap[dateKey] || 0) + 1;
        });

        // Convert to array of { date, count }
        return Object.entries(heatmap).map(([date, count]) => ({ date, count }));
    }
}
