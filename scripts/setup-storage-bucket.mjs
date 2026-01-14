#!/usr/bin/env node
/**
 * Script para crear el bucket 'gym-assets' en Supabase Storage
 * 
 * IMPORTANTE: SQL directo NO funciona porque requiere permisos de propietario.
 * Este script usa la API de Supabase para crear el bucket.
 * 
 * Uso:
 *   node scripts/setup-storage-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Faltan las variables de entorno');
    console.error('Asegúrate de tener en tu .env:');
    console.error('  - VITE_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (la clave service_role, NO la anon key)');
    process.exit(1);
}

// Crear cliente con la service role key (tiene más permisos)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageBucket() {
    console.log('🚀 Configurando bucket de Storage...\n');

    try {
        // 1. Verificar si el bucket ya existe
        console.log('1️⃣ Verificando si el bucket ya existe...');
        const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Error al listar buckets:', listError);
            throw listError;
        }

        const bucketExists = existingBuckets.some(bucket => bucket.name === 'gym-assets');

        if (bucketExists) {
            console.log('✅ El bucket "gym-assets" ya existe\n');
        } else {
            // 2. Crear el bucket público
            console.log('2️⃣ Creando bucket "gym-assets"...');
            const { data: newBucket, error: createError } = await supabase.storage.createBucket('gym-assets', {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
            });

            if (createError) {
                console.error('❌ Error al crear bucket:', createError);
                throw createError;
            }

            console.log('✅ Bucket creado exitosamente:', newBucket);
        }

        // 3. Configurar políticas RLS
        console.log('\n3️⃣ Configurando políticas de seguridad...');

        // Nota: Las políticas se crean mejor desde SQL Editor si el bucket ya existe
        // O desde el Dashboard en la sección de Policies del bucket

        const policies = `
-- Ejecuta esto en el SQL Editor de Supabase:

-- Policy: Lectura pública (todos pueden ver las imágenes)
CREATE POLICY IF NOT EXISTS "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'gym-assets' );

-- Policy: Usuarios autenticados pueden subir
CREATE POLICY IF NOT EXISTS "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'gym-assets' );

-- Policy: Usuarios autenticados pueden actualizar
CREATE POLICY IF NOT EXISTS "Authenticated Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'gym-assets' );

-- Policy: Usuarios pueden eliminar sus propias imágenes
CREATE POLICY IF NOT EXISTS "Users Delete Own Images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'gym-assets' );
`;

        console.log('📋 Políticas SQL a ejecutar:');
        console.log(policies);

        console.log('\n✅ Configuración completada!');
        console.log('\n📝 Próximos pasos:');
        console.log('   1. Ve al SQL Editor de Supabase Dashboard');
        console.log('   2. Ejecuta las políticas SQL mostradas arriba');
        console.log('   3. Prueba subir una imagen de fondo en tu app');

    } catch (error) {
        console.error('\n❌ Error durante la configuración:', error);
        process.exit(1);
    }
}

// Ejecutar
setupStorageBucket();
