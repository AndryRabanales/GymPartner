-- ==============================================================================
-- GINX: GX POINTS RESTORATION & CALIBRATION
-- Description: Resets all user GX points to count only their current followers
--              and clears the "profile completed" reward so they can earn it again.
-- ==============================================================================

-- 1. Recalcular gx_points y contadores sociales (followers_count/following_count) basándose ÚNICAMENTE en datos reales activos
UPDATE public.profiles p
SET 
    gx_points = (
        SELECT COALESCE(COUNT(*), 0)
        FROM public.follows f
        JOIN public.profiles p_f ON f.follower_id = p_f.id
        WHERE f.following_id = p.id
    ),
    followers_count = (
        SELECT COALESCE(COUNT(*), 0)
        FROM public.follows f
        JOIN public.profiles p_f ON f.follower_id = p_f.id
        WHERE f.following_id = p.id
    ),
    following_count = (
        SELECT COALESCE(COUNT(*), 0)
        FROM public.follows f
        JOIN public.profiles p_f ON f.following_id = p_f.id
        WHERE f.follower_id = p.id
    );

-- 2. Eliminar la bandera de recompensa de perfil completado para obligar a todos a re-guardar
-- su foto/descripción para ganar los 2 GX de nuevo.
UPDATE public.profiles
SET custom_settings = COALESCE(custom_settings, '{}'::jsonb) - 'profile_completed_reward_awarded';

