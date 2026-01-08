
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'profiles';

-- check for user_follows table
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_name = 'user_follows';

-- check foreign keys for profiles to see gym relation
SELECT
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.key_column_usage AS kcu
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = kcu.constraint_name
WHERE 
    kcu.table_name = 'profiles';
