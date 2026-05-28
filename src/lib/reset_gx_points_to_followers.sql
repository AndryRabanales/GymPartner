-- ==============================================================================
-- GINX: GX POINTS RESTORATION & CALIBRATION
-- Description: Resets all user GX points to count only their current followers
--              and clears the "profile completed" reward so they can earn it again.
-- ==============================================================================

-- 1. Recalcular gx_points basándose ÚNICAMENTE en la cantidad de seguidores actuales (1 GX por seguidor)
UPDATE public.profiles p
SET gx_points = (
    SELECT COALESCE(COUNT(*), 0)
    FROM public.follows f
    WHERE f.following_id = p.id
);

-- 2. Eliminar la bandera de recompensa de perfil completado para obligar a todos a re-guardar
-- su foto/descripción para ganar los 2 GX de nuevo.
UPDATE public.profiles
SET custom_settings = COALESCE(custom_settings, '{}'::jsonb) - 'profile_completed_reward_awarded';
