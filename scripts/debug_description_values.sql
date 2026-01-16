-- CHECK: Descriptions in profiles vs custom_settings
SELECT 
    id, 
    username, 
    description as col_description,
    custom_settings->>'description' as json_description
FROM profiles
WHERE description ILIKE '%backfill%' OR custom_settings->>'description' IS NOT NULL
LIMIT 5;
