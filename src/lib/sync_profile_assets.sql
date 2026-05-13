-- 🛡️ ENRIQUECIMIENTO DE PERFILES PARA EL RADAR
-- Añade campos de personalización de base directamente al perfil para evitar bloqueos de RLS.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS main_base_image TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS main_base_color TEXT;

-- 🔄 BACKFILL: Sincronizar datos actuales de user_gyms a profiles
UPDATE profiles p
SET 
  main_base_image = ug.custom_bg_url,
  main_base_color = ug.custom_color
FROM user_gyms ug
WHERE ug.user_id = p.id AND ug.is_home_base = true;
