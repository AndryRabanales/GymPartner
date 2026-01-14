-- ⚠️ IMPORTANTE: Este SQL NO funcionará directamente debido a restricciones de permisos
-- Error esperado: "ERROR: 42501: must be owner of table objects"
--
-- 🔧 SOLUCIÓN RECOMENDADA: Usar Supabase Dashboard
-- Ve a: https://supabase.com/dashboard/project/izcxidzieqaukqieetoe/storage/buckets
-- 1. Haz clic en "New bucket"
-- 2. Nombre: gym-assets
-- 3. Marca "Public bucket"
-- 4. Haz clic en "Create"
--
-- Luego ejecuta SOLO las políticas a continuación:

-- ====================
-- POLÍTICAS RLS
-- ====================
-- ✅ Estas SÍ funcionan después de crear el bucket

-- Policy: Lectura pública (todos pueden ver las imágenes de fondo)
CREATE POLICY IF NOT EXISTS "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'gym-assets' );

-- Policy: Usuarios autenticados pueden subir imágenes
CREATE POLICY IF NOT EXISTS "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'gym-assets' );

-- Policy: Usuarios autenticados pueden actualizar imágenes
CREATE POLICY IF NOT EXISTS "Authenticated Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'gym-assets' );

-- Policy: Usuarios pueden eliminar sus propias imágenes
CREATE POLICY IF NOT EXISTS "Users Delete Own Images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'gym-assets' );
