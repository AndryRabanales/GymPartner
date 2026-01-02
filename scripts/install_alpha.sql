
-- ==========================================
-- GYM ALPHA SYSTEM - INSTALLATION SCRIPT
-- ==========================================
-- INSTRUCCIONES:
-- 1. Ve a Supabase -> SQL Editor
-- 2. Copia todo este contenido
-- 3. Ejecuta ("Run")
-- ==========================================

-- 1. Tablas
CREATE TABLE IF NOT EXISTS public.gym_alphas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_volume NUMERIC DEFAULT 0,
    total_workouts INTEGER DEFAULT 0,
    consistency_score NUMERIC DEFAULT 0,
    is_current BOOLEAN DEFAULT TRUE,
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Funciones Helper
CREATE OR REPLACE FUNCTION get_week_start(target_date TIMESTAMPTZ) RETURNS DATE AS $$
BEGIN
    RETURN DATE_TRUNC('week', target_date)::DATE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_week_end(target_date TIMESTAMPTZ) RETURNS DATE AS $$
BEGIN
    RETURN (DATE_TRUNC('week', target_date) + INTERVAL '6 days')::DATE;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCIÓN PRINCIPAL: Calcular Ranking GLOBAL
DROP FUNCTION IF EXISTS calculate_all_gym_rankings();

CREATE OR REPLACE FUNCTION calculate_all_gym_rankings() 
RETURNS TEXT AS $$
DECLARE
    g RECORD;
    week_s DATE;
    week_e DATE;
    count INTEGER := 0;
BEGIN
    week_s := get_week_start(NOW());
    week_e := get_week_end(NOW());

    -- Limpiar flags anteriores
    UPDATE public.gym_alphas SET is_current = FALSE WHERE is_current = TRUE;

    -- Calcular nuevos rankings
    FOR g IN SELECT id FROM gyms LOOP
        -- 2. Calcular nuevos rankings basados en workouts
        INSERT INTO public.gym_alphas (gym_id, user_id, week_start, week_end, total_volume, total_workouts, consistency_score, is_current)
        SELECT 
            w.gym_id,
            w.user_id,
            week_s,
            week_e,
            SUM(COALESCE(s.weight_kg * s.reps, 0)) as total_vol, 
            COUNT(DISTINCT w.id) as total_w,
            (SUM(COALESCE(s.weight_kg * s.reps, 0)) / NULLIF(COUNT(DISTINCT w.id), 0)) as score,
            TRUE
        FROM public.workout_sessions w
        JOIN public.workout_sets s ON w.id = s.session_id
        WHERE w.gym_id = g.id
          AND w.started_at >= week_s::timestamptz AND w.started_at < (week_e + INTERVAL '1 day')::timestamptz
        GROUP BY w.gym_id, w.user_id
        ORDER BY score DESC
        LIMIT 10;
        
        count := count + 1;
    END LOOP;
    
    RETURN 'Gyms procesados: ' || count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. POLÍTICAS DE SEGURIDAD (Hacer visibles los rankings)
ALTER TABLE public.gym_alphas ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública a los rankings (Cualquiera puede ver quién es Alpha)
CREATE POLICY "Public Rankings" ON public.gym_alphas
    FOR SELECT USING (true);

-- Nota: La escritura sigue restringida a las funciones del sistema (Admin)

-- 4. RPC para Frontend
DROP FUNCTION IF EXISTS get_current_alpha(uuid);

CREATE OR REPLACE FUNCTION get_current_alpha(target_gym_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    rank TEXT,
    total_volume NUMERIC,
    total_workouts INTEGER,
    consistency_score NUMERIC,
    achieved_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.user_id,
        p.username,
        p.avatar_url,
        'Alpha'::TEXT,
        a.total_volume,
        a.total_workouts,
        a.consistency_score,
        a.achieved_at
    FROM gym_alphas a
    JOIN profiles p ON a.user_id = p.id
    WHERE a.gym_id = target_gym_id 
      AND a.is_current = TRUE
    ORDER BY a.consistency_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
