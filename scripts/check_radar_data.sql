-- CHECK 1: Do any users have a banner_url in custom_settings?
SELECT 
    id, 
    username, 
    custom_settings, 
    custom_settings->>'banner_url' as extracted_banner
FROM profiles 
WHERE custom_settings->>'banner_url' IS NOT NULL
LIMIT 5;

-- CHECK 2: Test the Radar Function directly (simulating a location)
-- We'll use the coordinates of the first gym found
WITH ref_gym AS (
    SELECT lat, lng FROM gyms WHERE lat IS NOT NULL LIMIT 1
)
SELECT * 
FROM get_nearby_gymrats(
    (SELECT lat FROM ref_gym), 
    (SELECT lng FROM ref_gym)
)
LIMIT 5;
