-- Check metrics configuration for "Cruce de Poleas" or "Crossover"
SELECT 
    id,
    name,
    track_weight,
    track_reps,
    track_time,
    track_distance,
    track_rpe,
    custom_metric,
    metrics
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%' 
   OR LOWER(name) LIKE '%crossover%'
   OR LOWER(name) LIKE '%polea%';
