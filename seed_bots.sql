-- 🤖 GYMPARTNER BOT FACTORY (Generador de Usuarios Dummy)
-- Ejecuta esto en Supabase SQL Editor para crear 500 usuarios falsos

DO $$
DECLARE
    i INTEGER;
    new_uuid UUID;
    bot_username TEXT;
    bot_xp INTEGER;
    bot_avatar TEXT;
    random_vid TEXT;
BEGIN
    FOR i IN 1..500 LOOP
        -- 1. Generar ID y Datos
        new_uuid := gen_random_uuid();
        bot_username := 'GymBot_' || floor(random() * 8999 + 1000)::TEXT;
        bot_xp := floor(random() * 900 + 100)::INTEGER; -- XP entre 100 y 1000
        bot_avatar := 'https://api.dicebear.com/7.x/notionists/svg?seed=' || bot_username;
        
        -- 2. Insertar en AUTH.USERS (Truco para simular registro real)
        -- Nota: La contraseña no sirve, no podrán iniciar sesión, solo existen.
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
            new_uuid, 
            '00000000-0000-0000-0000-000000000000', 
            'authenticated', 
            'authenticated', 
            'bot_' || i || '_' || floor(random()*10000) || '@gympartner.ai', 
            '$2a$10$wKqK.Xz.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0', -- Dummy hash
            NOW(), NOW(), NOW(), 
            '{"provider":"email","providers":["email"]}', 
            '{}', 
            NOW(), NOW()
        );

        -- 3. Insertar en PUBLIC.PROFILES (Para el Ranking)
        INSERT INTO public.profiles (id, username, avatar_url, xp, created_at)
        VALUES (
            new_uuid,
            bot_username,
            bot_avatar,
            bot_xp,
            NOW()
        );

        -- 4. 🎥 "Bots en los videos" (Posts falsos)
        -- El 20% de los bots subirán un video de prueba.
        IF (random() < 0.2) THEN
            -- Seleccionar video aleatorio de una lista
            IF (random() < 0.5) THEN
                random_vid := 'https://res.cloudinary.com/demo/video/upload/v1690000000/samples/dance-2.mp4';
            ELSE
                random_vid := 'https://res.cloudinary.com/demo/video/upload/v1690000000/samples/elephants.mp4';
            END IF;

            INSERT INTO public.posts (
                user_id, 
                type, 
                media_url, 
                thumbnail_url, 
                caption, 
                created_at,
                rank_score, -- Truco: Darles algo de ranking inicial para que aparezcan
                virality_score
            )
            VALUES (
                new_uuid, 
                'video', 
                random_vid, 
                'https://via.placeholder.com/300x500.png?text=Bot+Video',
                'Entrenando duro con GymPartner 🤖 #' || bot_username,
                NOW() - (random() * INTERVAL '5 days'), -- Fecha aleatoria últimos 5 días
                (random() * 100), --- Score aleatorio
                (random() * 50)
            );
        END IF;

        -- 5. 👀 "Bots mirando videos" (Interacciones)
        -- Dar LIKES a posts existentes al azar para "calentar" el algoritmo.
        -- (Opcional, pero ayuda al realismo)
        
    END LOOP;
END $$;
