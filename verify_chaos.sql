-- 🎲 VERIFICADOR DE CAOS (Jitter Test)
-- Ejecuta este script VARIAS VECES (3 o 4 veces seguidas)
-- y observa cómo cambia el orden de los posts.

SELECT 
    id,
    substring(caption from 1 for 20) || '...' as caption,
    created_at::time as hora,
    rank_score as PUNTOS_DINAMICOS, -- Este número debería cambiar en cada ejecución
    (rank_score - floor(rank_score)) as decimales_caos -- El "ruido" aleatorio
FROM get_smart_feed_v3(NULL, 10, 0, NULL);
