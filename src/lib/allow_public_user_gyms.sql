-- 🔓 DESBLOQUEO DE IDENTIDAD VISUAL
-- Permite que todos los usuarios vean las fotos y colores personalizados de los gimnasios de otros guerreros.

DROP POLICY IF EXISTS "User gyms are viewable by everyone" ON user_gyms;

CREATE POLICY "User gyms are viewable by everyone" 
ON user_gyms 
FOR SELECT 
USING (true);

-- Aseguramos que la tabla tenga habilitado RLS
ALTER TABLE user_gyms ENABLE ROW LEVEL SECURITY;
