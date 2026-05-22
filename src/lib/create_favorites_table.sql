-- Create gym_favorites table to track which users have favorited which gyms
CREATE TABLE IF NOT EXISTS public.gym_favorites (
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, gym_id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.gym_favorites ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view favorites (to count them)
CREATE POLICY "Anyone can view favorites"
    ON public.gym_favorites
    FOR SELECT
    USING (true);

-- Users can only insert their own favorites
CREATE POLICY "Users can insert their own favorites"
    ON public.gym_favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
CREATE POLICY "Users can delete their own favorites"
    ON public.gym_favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create an index to quickly count favorites for a gym
CREATE INDEX IF NOT EXISTS idx_gym_favorites_gym_id ON public.gym_favorites(gym_id);
