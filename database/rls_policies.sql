-- ============================================
-- Smart Irrigation Advisor — Row Level Security
-- Run this AFTER schema.sql
-- ============================================

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moroccan_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrigation_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrigation_ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper: admin role check without recursive RLS
-- ============================================
-- SECURITY DEFINER lets policies ask "is this user an admin?" without applying
-- the users table's own RLS policies again, which would recurse on public.users.
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = uid
          AND role = 'admin'
          AND is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ============================================
-- Users: Users can read/update their own profile
-- ============================================
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admin: can view all users
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (public.is_admin());

-- Admin: can update all users
CREATE POLICY "Admins can update all users"
    ON public.users FOR UPDATE
    USING (public.is_admin());

-- ============================================
-- Reference tables: public read access
-- ============================================
CREATE POLICY "Anyone can read crops"
    ON public.crops FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read soil types"
    ON public.soil_types FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read regions"
    ON public.moroccan_regions FOR SELECT
    USING (true);

-- ============================================
-- Irrigation Predictions: user owns their data
-- ============================================
CREATE POLICY "Users can view own irrigation predictions"
    ON public.irrigation_predictions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own irrigation predictions"
    ON public.irrigation_predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all irrigation predictions"
    ON public.irrigation_predictions FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can view own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR SELECT
    USING (public.is_admin());

-- ============================================
-- Disease Predictions: user owns their data
-- ============================================
CREATE POLICY "Users can view own disease predictions"
    ON public.disease_predictions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own disease predictions"
    ON public.disease_predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all disease predictions"
    ON public.disease_predictions FOR SELECT
    USING (public.is_admin());

-- ============================================
-- Weather Cache: public read, service role write
-- ============================================
CREATE POLICY "Anyone can read weather cache"
    ON public.weather_cache FOR SELECT
    USING (true);

-- Weather cache is written by the backend using service_role key
-- No INSERT/UPDATE policies needed for anon/authenticated

-- ============================================
-- Contact Messages: public insert, admin read/update
-- ============================================
CREATE POLICY "Anyone can submit contact messages"
    ON public.contact_messages FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view contact messages"
    ON public.contact_messages FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update contact messages"
    ON public.contact_messages FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete contact messages"
    ON public.contact_messages FOR DELETE
    USING (public.is_admin());

-- ============================================
-- Newsletter: public subscribe, admin manage
-- ============================================
CREATE POLICY "Anyone can subscribe to newsletter"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view newsletter subscribers"
    ON public.newsletter_subscribers FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update newsletter subscribers"
    ON public.newsletter_subscribers FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete newsletter subscribers"
    ON public.newsletter_subscribers FOR DELETE
    USING (public.is_admin());

-- ============================================
-- App Config: public read, admin write
-- ============================================
CREATE POLICY "Anyone can read app config"
    ON public.app_config FOR SELECT
    USING (true);

CREATE POLICY "Admins can update app config"
    ON public.app_config FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can insert app config"
    ON public.app_config FOR INSERT
    WITH CHECK (public.is_admin());
