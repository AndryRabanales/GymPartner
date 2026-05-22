-- Este script insertará todos los ejercicios predeterminados del sistema en la base de datos.
-- Evita duplicados si alguno de estos ya fue creado por algún usuario (gracias al ON CONFLICT).

INSERT INTO public.exercises (name, target_muscle_group) VALUES
    -- PECHO (CHEST)
    ('Press Inclinado (Máquina)', 'Pecho'),
    ('Press Inclinado (Mancuernas)', 'Pecho'),
    ('Press Inclinado (Barra)', 'Pecho'),
    ('Press Inclinado (Polea/Cable)', 'Pecho'),
    ('Smith Press Inclinado', 'Pecho'),
    ('Press Banca Plano (Barra)', 'Pecho'),
    ('Press Banca Plano (Mancuernas)', 'Pecho'),
    ('Press de Pecho (Máquina)', 'Pecho'),
    ('Press Plano (Polea/Cable)', 'Pecho'),
    ('Smith Press Plano', 'Pecho'),
    ('Peck Deck (Mariposa)', 'Pecho'),
    ('Cruce de Poleas (Crossover Alto)', 'Pecho'),
    ('Press Declinado (Barra)', 'Pecho'),
    ('Press Declinado (Mancuernas)', 'Pecho'),
    ('Press Declinado (Máquina)', 'Pecho'),
    ('Cruce de Poleas (Crossover Bajo)', 'Pecho'),
    ('Fondos (Dips)', 'Pecho'),
    ('Fondos Asistidos (Máquina)', 'Pecho'),

    -- ESPALDA (BACK)
    ('Jalón al Pecho (Polea Alta)', 'Espalda'),
    ('Jalón al Pecho (Agarre Estrecho)', 'Espalda'),
    ('Dominadas (Pullups)', 'Espalda'),
    ('Dominadas Asistidas (Máquina)', 'Espalda'),
    ('Pull-Over en Polea', 'Espalda'),
    ('Remo con Barra (Pendlay/Yates)', 'Espalda'),
    ('Remo con Mancuerna (Unilateral)', 'Espalda'),
    ('Remo Gironda (Polea Baja)', 'Espalda'),
    ('Remo en Máquina (Pecho Apoyado)', 'Espalda'),
    ('Remo en T (Barra/Máquina)', 'Espalda'),
    ('Peso Muerto (Deadlift)', 'Espalda'),

    -- HOMBRO (SHOULDERS)
    ('Press Militar (Barra)', 'Hombro'),
    ('Press Militar (Mancuernas)', 'Hombro'),
    ('Press de Hombros (Máquina)', 'Hombro'),
    ('Elevaciones Frontales (Mancuernas)', 'Hombro'),
    ('Elevaciones Frontales (Polea)', 'Hombro'),
    ('Elevaciones Laterales (Mancuernas)', 'Hombro'),
    ('Elevaciones Laterales (Polea)', 'Hombro'),
    ('Elevaciones Laterales (Máquina)', 'Hombro'),
    ('Pájaros/Vuelos (Mancuernas)', 'Hombro'),
    ('Face Pull', 'Hombro'),
    ('Peck Deck Invertido', 'Hombro'),

    -- PIERNA (LEGS)
    ('Sentadilla Libre (Barra)', 'Pierna'),
    ('Sentadilla Frontal', 'Pierna'),
    ('Sentadilla Hack (Máquina)', 'Pierna'),
    ('Prensa de Piernas (45°)', 'Pierna'),
    ('Extensiones de Cuádriceps', 'Pierna'),
    ('Zancadas/Lunges (Mancuernas/Barra)', 'Pierna'),
    ('Sentadilla Bulgara', 'Pierna'),
    ('Peso Muerto Rumano (Barra/Mancuernas)', 'Pierna'),
    ('Curl Femoral Tumbado (Máquina)', 'Pierna'),
    ('Curl Femoral Sentado (Máquina)', 'Pierna'),
    ('Good Mornings (Buenos Días)', 'Pierna'),

    -- GLÚTEOS
    ('Hip Thrust (Barra)', 'Glúteos'),
    ('Hip Thrust (Máquina)', 'Glúteos'),
    ('Patada de Glúteo (Polea)', 'Glúteos'),
    ('Patada de Glúteo (Máquina)', 'Glúteos'),

    -- BÍCEPS (ARMS)
    ('Curl con Barra (Recta/Z)', 'Bíceps'),
    ('Curl con Mancuernas (Supino/Alterno)', 'Bíceps'),
    ('Curl Martillo (Mancuernas)', 'Bíceps'),
    ('Curl Predicador (Barra/Mancuerna)', 'Bíceps'),
    ('Curl Predicador (Máquina)', 'Bíceps'),
    ('Curl de Bíceps en Polea', 'Bíceps'),
    ('Curl Araña (Spider Curl)', 'Bíceps'),

    -- TRÍCEPS (ARMS)
    ('Extensiones de Tríceps (Polea/Cuerda)', 'Tríceps'),
    ('Extensiones de Tríceps (Barra recta)', 'Tríceps'),
    ('Press Francés (Barra Z/Mancuernas)', 'Tríceps'),
    ('Copa a una mano (Mancuerna)', 'Tríceps'),
    ('Fondos en Paralelas/Bancos', 'Tríceps'),
    ('Patada de Tríceps (Mancuerna)', 'Tríceps'),

    -- ABDOMINALES (ABS)
    ('Crunch Abdominal', 'Abdominales'),
    ('Elevación de Piernas (Colgado)', 'Abdominales'),
    ('Plancha (Plank)', 'Abdominales'),
    ('Rueda Abdominal', 'Abdominales'),
    ('Crunch en Máquina', 'Abdominales'),
    ('Crunch en Polea Alta', 'Abdominales'),
    ('Russian Twist', 'Abdominales'),

    -- CARDIO
    ('Cinta de Correr', 'Cardio'),
    ('Elíptica', 'Cardio'),
    ('Bicicleta Estática', 'Cardio'),
    ('Remo (Concept2)', 'Cardio'),
    ('Escaladora (Stairmaster)', 'Cardio'),
    ('Salto de Cuerda', 'Cardio')

ON CONFLICT (name) DO NOTHING;
