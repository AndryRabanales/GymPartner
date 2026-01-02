
-- ==========================================
-- AUTOMATIZACIÓN (CRON JOB)
-- ==========================================
-- Instrucciones:
-- 1. Ve al Dashboard de Supabase -> Database -> Extensions
-- 2. Busca "pg_cron" y actívalo (si no te deja este script).
-- 3. Ejecuta este script en SQL Editor.
-- ==========================================

-- 1. Habilitar la extensión de Cron Jobs (Reloj del Sistema)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Programar el trabajo "Rankings Semanales"
-- Se ejecutará todos los Domingos a las 23:59 UTC
SELECT cron.schedule(
    'calculate-weekly-rankings',  -- Nombre único del trabajo
    '59 23 * * 0',                -- Cron expression (Min 59, Hora 23, Domingo)
    $$SELECT calculate_all_gym_rankings()$$ -- Comando a ejecutar
);

-- 3. Verificar que quedó programado
SELECT * FROM cron.job;
