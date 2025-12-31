-- 🧪 KIT DE VERIFICACIÓN DE ALGORITMO V3
-- Ejecuta estos bloques en el SQL Editor de Supabase para "auditar" a tu IA.

-- =====================================================================================
-- 1. 📊 VER EL RANKING ACTUAL (La Matriz)
-- =====================================================================================
-- Muestra los 20 mejores posts según el algoritmo.
-- Fíjate en la columna 'PUNTOS_IA'. ¿Ves cómo los viral/nuevos ganan?
SELECT 
    id,
    substring(caption from 1 for 30) || '...' as texto,
    username,
    type as formato,
    rank_score as PUNTOS_IA,  -- 🧠 Puntaje calculado
    shares_count as copias,
    saves_count as guardados,
    is_viral as viral,
    is_cold_start as nuevo
FROM get_smart_feed_v3(NULL, 100, 0, NULL)
ORDER BY rank_score DESC
LIMIT 20;


-- =====================================================================================
-- 2. 🧪 EXPERIMENTO: "HACER FAMOSO A UN NADIE"
-- =====================================================================================
-- Elige un ID de un post que esté MUY ABAJO en la lista anterior (puntos bajos).
-- Copialo y pégalo donde dice 'TU_ID_AQUI'.
-- Luego selecciona este bloque y ejecútalo.

/*
UPDATE posts 
SET 
    shares_count = 50,    -- 🚀 ¡50 personas compartieron!
    saves_count = 30,     -- 💾 ¡30 personas guardaron!
    virality_score = 150  -- 🔥 ¡Es súper viral!
WHERE id = 'TU_ID_AQUI';  -- <--- PEGA EL ID DEL POST ABURRIDO AQUÍ
*/


-- =====================================================================================
-- 3. 📈 VERIFICAR RESULTADO
-- =====================================================================================
-- Vuelve a ejecutar el Bloque 1.
-- SÚPER IMPORTANTE: El post que elegiste debería haber saltado al número 1 o 2.
-- Si pasó eso, ¡Felicidades! Tu IA funciona y reacciona a la interacción humana.
