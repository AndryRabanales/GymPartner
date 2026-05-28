import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Create user chats count helper view or function
CREATE OR REPLACE FUNCTION get_user_chats_count(u_id UUID)
RETURNS BIGINT AS $$
DECLARE
    cnt BIGINT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM chats
    WHERE user_a = u_id OR user_b = u_id;
    RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user gyms count helper view or function
CREATE OR REPLACE FUNCTION get_user_gyms_count(u_id UUID)
RETURNS BIGINT AS $$
DECLARE
    cnt BIGINT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM user_gyms
    WHERE user_id = u_id;
    RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine get_gym_followers_leaderboard to order by GX points!
CREATE OR REPLACE FUNCTION get_gym_followers_leaderboard(gym_id_param UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    gym_name TEXT,
    banner_url TEXT,
    followers_count BIGINT,
    gx_points INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_followers AS (
        SELECT 
            f.following_id AS user_id,
            COUNT(f.follower_id) AS count
        FROM 
            follows f
        GROUP BY 
            f.following_id
    ),
    user_streak_info AS (
        SELECT 
            us.user_id,
            us.current_streak
        FROM 
            user_streaks us
    )
    SELECT 
        p.id,
        p.username::text,
        p.avatar_url::text,
        g.name::text AS gym_name,
        p.custom_settings->>'banner_url' AS banner_url,
        COALESCE(uf.count, 0)::bigint AS followers_count,
        (
            (
                COALESCE(uf.count, 0) * 1 + -- 1gx per follower
                COALESCE(p.checkins_count, 0) * 2 + -- 2gx per workout day
                COALESCE(get_user_chats_count(p.id), 0) * 1 + -- 1gx per match
                COALESCE(p.g_points, 0) + -- base GX (app shares, 5min active, etc)
                (CASE WHEN (p.avatar_url IS NOT NULL AND p.avatar_url <> '' AND p.description IS NOT NULL AND p.description <> '') THEN 2 ELSE 0 END) + -- 2gx completed profile
                COALESCE(get_user_gyms_count(p.id), 0) * 3 -- 3gx per gym unlocked
            )::integer * 
            (CASE WHEN COALESCE(us.current_streak, 0) >= 10 THEN 2 ELSE 1 END)::integer
        ) AS gx_points,
        RANK() OVER (
            ORDER BY 
                (p.boost_until IS NOT NULL AND p.boost_until > NOW()) DESC, 
                (
                    (
                        COALESCE(uf.count, 0) * 1 +
                        COALESCE(p.checkins_count, 0) * 2 +
                        COALESCE(get_user_chats_count(p.id), 0) * 1 +
                        COALESCE(p.g_points, 0) +
                        (CASE WHEN (p.avatar_url IS NOT NULL AND p.avatar_url <> '' AND p.description IS NOT NULL AND p.description <> '') THEN 2 ELSE 0 END) +
                        COALESCE(get_user_gyms_count(p.id), 0) * 3
                    )::integer * 
                    (CASE WHEN COALESCE(us.current_streak, 0) >= 10 THEN 2 ELSE 1 END)::integer
                ) DESC
        ) AS rank
    FROM 
        profiles p
    LEFT JOIN 
        gyms g ON p.home_gym_id::uuid = g.id
    LEFT JOIN 
        user_followers uf ON p.id = uf.user_id
    LEFT JOIN 
        user_streak_info us ON p.id = us.user_id
    WHERE 
        p.home_gym_id::uuid = gym_id_param
    ORDER BY 
        (p.boost_until IS NOT NULL AND p.boost_until > NOW()) DESC,
        gx_points DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function run() {
    console.log('🚀 Running SQL migration to upgrade ranking to GX points...');
    
    // We can run SQL by using raw postgres in Supabase if enabled, or executing RPC to run SQL.
    // Wait, let's see if there is any other way, or if we can run it through postgres client.
    // Let's call supabase.rpc('exec_sql', { sql }) in case it is available, or use alternative.
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.warn('⚠️ exec_sql RPC failed (might not exist):', error.message);
            console.log('Alternative: If direct exec_sql is not supported, we can calculate GX points in frontend services!');
        } else {
            console.log('✅ SQL migration completed successfully!');
        }
    } catch (err) {
        console.error('❌ Error executing SQL migration:', err);
    }
}

run();
