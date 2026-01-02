
-- DIAGNOSTIC SCRIPT FOR RADAR DATA
-- Run this in Supabase SQL Editor to understand why Radar is empty.

-- 1. Check Gym Coordinates
SELECT 
    COUNT(*) as total_gyms,
    COUNT(lat) as gyms_with_lat,
    COUNT(lng) as gyms_with_lng,
    (SELECT name FROM gyms WHERE lat IS NOT NULL LIMIT 1) as example_valid_gym
FROM gyms;

-- 2. Check User Links
SELECT 
    COUNT(*) as total_links
FROM user_gyms;

-- 3. Check specific Gyms with Users (Top 5 populated gyms)
SELECT 
    g.name,
    g.lat,
    g.lng,
    COUNT(upg.user_id) as user_count
FROM gyms g
JOIN user_gyms upg ON g.id = upg.gym_id
GROUP BY g.id, g.name, g.lat, g.lng
ORDER BY user_count DESC
LIMIT 5;

-- 4. Test Distance Function (if installed)
-- Should return distance between New York and London (~5500km)
-- NY: 40.7128, -74.0060
-- LDN: 51.5074, -0.1278
SELECT calculate_distance(40.7128, -74.0060, 51.5074, -0.1278) as test_distance_km;
