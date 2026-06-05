-- ============================================
-- Smart Irrigation Advisor — full bootstrap
-- Paste this entire file into Supabase → SQL Editor → New query → Run.
-- Idempotent. Safe to re-run.
-- ============================================

-- =========  schema.sql  ==========
-- ============================================
-- Smart Irrigation Advisor — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Users (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT DEFAULT '',
    region TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Crops (reference data)
-- ============================================
CREATE TABLE public.crops (
    id SERIAL PRIMARY KEY,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    kc_initial REAL NOT NULL DEFAULT 0.3,
    kc_mid REAL NOT NULL DEFAULT 1.0,
    kc_late REAL NOT NULL DEFAULT 0.7,
    growth_duration_days INTEGER NOT NULL DEFAULT 120,
    category TEXT DEFAULT 'general'
);

-- ============================================
-- 3. Soil Types (reference data)
-- ============================================
CREATE TABLE public.soil_types (
    id SERIAL PRIMARY KEY,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    field_capacity REAL NOT NULL DEFAULT 0.3,
    wilting_point REAL NOT NULL DEFAULT 0.15,
    infiltration_rate REAL NOT NULL DEFAULT 10.0
);

-- ============================================
-- 4. Moroccan Regions (reference data)
-- ============================================
CREATE TABLE public.moroccan_regions (
    id SERIAL PRIMARY KEY,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    climate_zone TEXT DEFAULT 'semi-arid'
);

-- ============================================
-- 5. Irrigation Predictions
-- ============================================
CREATE TABLE public.irrigation_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_id INTEGER NOT NULL REFERENCES public.crops(id),
    soil_type_id INTEGER NOT NULL REFERENCES public.soil_types(id),
    region_id INTEGER NOT NULL REFERENCES public.moroccan_regions(id),
    planting_date DATE,
    growth_stage TEXT DEFAULT 'initial',
    weather_data JSONB DEFAULT '{}',
    eto_value REAL DEFAULT 0,
    etc_value REAL DEFAULT 0,
    recommended_water_mm REAL DEFAULT 0,
    recommendation_fr TEXT DEFAULT '',
    recommendation_ar TEXT DEFAULT '',
    alert_level TEXT DEFAULT 'normal' CHECK (alert_level IN ('normal', 'warning', 'critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5b. Daily AI recommendations for irrigation calculations
-- ============================================
CREATE TABLE public.irrigation_ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id UUID NOT NULL REFERENCES public.irrigation_predictions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    locale TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'ar')),
    model TEXT DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(prediction_id, recommendation_date, locale)
);

-- ============================================
-- 6. Disease Predictions
-- ============================================
CREATE TABLE public.disease_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    image_url TEXT DEFAULT '',
    disease_key TEXT NOT NULL DEFAULT 'unknown',
    disease_name_fr TEXT DEFAULT '',
    disease_name_ar TEXT DEFAULT '',
    confidence_score REAL DEFAULT 0,
    treatment_fr TEXT DEFAULT '',
    treatment_ar TEXT DEFAULT '',
    crop_type TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. Weather Cache
-- ============================================
CREATE TABLE public.weather_cache (
    id SERIAL PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES public.moroccan_regions(id),
    forecast_data JSONB DEFAULT '{}',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_weather_cache_region ON public.weather_cache(region_id);
CREATE INDEX idx_weather_cache_expires ON public.weather_cache(expires_at);

-- ============================================
-- 8. Contact Messages
-- ============================================
CREATE TABLE public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_contact_status ON public.contact_messages(status);

-- ============================================
-- 9. Newsletter Subscribers
-- ============================================
CREATE TABLE public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    locale TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'ar')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_newsletter_active ON public.newsletter_subscribers(is_active);

-- ============================================
-- 10. App Config (key-value store)
-- ============================================
CREATE TABLE public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_irrigation_user ON public.irrigation_predictions(user_id, created_at DESC);
CREATE INDEX idx_irrigation_ai_user_date ON public.irrigation_ai_recommendations(user_id, recommendation_date DESC);
CREATE INDEX idx_disease_user ON public.disease_predictions(user_id, created_at DESC);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_active ON public.users(is_active);

-- ============================================
-- Function: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Run on new auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =========  rls_policies.sql  ==========
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

-- =========  seed_data.sql  ==========
-- ============================================
-- Smart Irrigation Advisor — Seed Data
-- Run this AFTER schema.sql
-- ============================================

-- ============================================
-- Moroccan Regions
-- ============================================
INSERT INTO public.moroccan_regions (name_fr, name_ar, latitude, longitude, climate_zone) VALUES
    ('Marrakech', 'مراكش', 31.6295, -7.9811, 'semi-arid'),
    ('Fès', 'فاس', 34.0181, -5.0078, 'semi-arid'),
    ('Casablanca', 'الدار البيضاء', 33.5731, -7.5898, 'mediterranean'),
    ('Agadir', 'أكادير', 30.4278, -9.5981, 'semi-arid'),
    ('Meknès', 'مكناس', 33.8935, -5.5547, 'semi-arid'),
    ('Oujda', 'وجدة', 34.6867, -1.9114, 'steppe'),
    ('Beni Mellal', 'بني ملال', 32.3373, -6.3498, 'semi-arid'),
    ('Errachidia', 'الرشيدية', 31.9314, -4.4288, 'arid'),
    ('Souss-Massa', 'سوس ماسة', 30.3500, -9.2500, 'semi-arid'),
    ('Draa-Tafilalet', 'درعة تافيلالت', 31.5000, -5.5000, 'arid'),
    ('Tanger', 'طنجة', 35.7595, -5.8340, 'mediterranean'),
    ('Rabat', 'الرباط', 34.0209, -6.8416, 'mediterranean');

-- ============================================
-- Crops (with FAO-56 Kc coefficients)
-- ============================================
INSERT INTO public.crops (name_fr, name_ar, kc_initial, kc_mid, kc_late, growth_duration_days, category) VALUES
    ('Blé', 'قمح', 0.30, 1.15, 0.40, 120, 'céréales'),
    ('Maïs', 'ذرة', 0.30, 1.20, 0.60, 130, 'céréales'),
    ('Tomate', 'طماطم', 0.60, 1.15, 0.80, 140, 'légumes'),
    ('Olivier', 'زيتون', 0.65, 0.70, 0.70, 365, 'arboriculture'),
    ('Agrumes', 'حوامض', 0.70, 0.65, 0.65, 365, 'arboriculture'),
    ('Pomme de terre', 'بطاطس', 0.50, 1.15, 0.75, 100, 'légumes'),
    ('Luzerne', 'فصة', 0.40, 0.95, 0.90, 365, 'fourrage'),
    ('Betterave sucrière', 'شمندر سكري', 0.35, 1.20, 0.70, 180, 'industriel'),
    ('Oignon', 'بصل', 0.70, 1.05, 0.75, 110, 'légumes'),
    ('Haricot', 'فاصوليا', 0.40, 1.15, 0.35, 90, 'légumes');

-- ============================================
-- Soil Types
-- ============================================
INSERT INTO public.soil_types (name_fr, name_ar, field_capacity, wilting_point, infiltration_rate) VALUES
    ('Argileux', 'تربة طينية', 0.40, 0.20, 5.0),
    ('Sableux', 'تربة رملية', 0.15, 0.05, 50.0),
    ('Limoneux', 'تربة طميية', 0.35, 0.15, 15.0),
    ('Argilo-sableux', 'تربة طينية رملية', 0.30, 0.12, 20.0),
    ('Limon argileux', 'طمي طيني', 0.38, 0.18, 8.0);

-- ============================================
-- App Config (default settings)
-- ============================================
INSERT INTO public.app_config (key, value, category, description) VALUES
    ('site_name_fr', 'Smart Irrigation Advisor', 'branding', 'Nom du site en français'),
    ('site_name_ar', 'مستشار الري الذكي', 'branding', 'Nom du site en arabe'),
    ('site_description_fr', 'Plateforme intelligente d''aide à la décision agricole pour les agriculteurs marocains', 'branding', 'Description du site en français'),
    ('site_description_ar', 'منصة ذكية لدعم القرار الزراعي للمزارعين المغاربة', 'branding', 'Description du site en arabe'),
    ('contact_email', 'contact@smartirrigation.ma', 'contact', 'Email de contact principal'),
    ('maintenance_mode', 'false', 'system', 'Mode maintenance activé/désactivé'),
    ('max_upload_size_mb', '5', 'system', 'Taille maximale d''upload en MB'),
    ('default_locale', 'fr', 'system', 'Langue par défaut (fr ou ar)'),
    ('weather_cache_ttl_minutes', '60', 'system', 'Durée de cache météo en minutes'),
    ('enable_newsletter', 'true', 'features', 'Activer/désactiver la newsletter'),
    ('enable_disease_detection', 'true', 'features', 'Activer/désactiver la détection des maladies');

-- ============================================
-- Default Admin User (update with your Supabase user ID)
-- After creating your first account, run:
-- UPDATE public.users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
-- ============================================

-- =========  storage_bucket.sql  ==========
-- ============================================
-- Smart Irrigation Advisor — Storage bucket setup
-- Run this in the Supabase SQL Editor AFTER schema.sql and rls_policies.sql
-- ============================================
--
-- Provisions the `disease-images` bucket used by `disease_service` / `storage_service`
-- to store leaf photos uploaded by authenticated users.
--
-- The bucket is PUBLIC because the frontend renders image_url tags directly. If
-- you prefer signed URLs, set `public = false` and generate signed URLs in
-- `storage_service.upload_disease_image`.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'disease-images',
    'disease-images',
    true,
    5 * 1024 * 1024,  -- 5 MB ceiling, matches POST /api/disease/predict
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- Object policies
-- ============================================
-- The backend uses the service-role key so it bypasses RLS — these policies
-- govern what authenticated users / anon visitors can do directly against
-- storage.objects.

DROP POLICY IF EXISTS "disease_images_public_read" ON storage.objects;
CREATE POLICY "disease_images_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'disease-images');

-- Users may upload only to their own folder: disease-images/<their-uid>/...
DROP POLICY IF EXISTS "disease_images_user_upload" ON storage.objects;
CREATE POLICY "disease_images_user_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'disease-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Users may delete their own images
DROP POLICY IF EXISTS "disease_images_user_delete" ON storage.objects;
CREATE POLICY "disease_images_user_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'disease-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Admins may delete any image
DROP POLICY IF EXISTS "disease_images_admin_delete" ON storage.objects;
CREATE POLICY "disease_images_admin_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'disease-images'
        AND public.is_admin()
    );


-- ============================================
-- Backfill — mirror any pre-existing auth.users into public.users
-- (The handle_new_user trigger only fires on NEW signups, so existing
--  Supabase Auth accounts that predate this setup need a one-time backfill.)
-- ============================================
INSERT INTO public.users (id, full_name, email)
SELECT au.id,
       COALESCE(au.raw_user_meta_data->>'full_name', ''),
       au.email
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- Auto-promote: if no admin yet, the earliest user becomes admin.
UPDATE public.users
   SET role = 'admin'
 WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin');


-- ============================================
-- Migration 001 — notification preferences
-- (Adds columns to public.users for daily email reminders.)
-- ============================================
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS notification_hour SMALLINT NOT NULL DEFAULT 7
        CHECK (notification_hour BETWEEN 0 AND 23),
    ADD COLUMN IF NOT EXISTS notification_region_id INTEGER REFERENCES public.moroccan_regions(id),
    ADD COLUMN IF NOT EXISTS notification_crop_id INTEGER REFERENCES public.crops(id),
    ADD COLUMN IF NOT EXISTS notification_planting_date DATE;

CREATE INDEX IF NOT EXISTS idx_users_notif_hour
    ON public.users (notification_hour)
    WHERE notification_enabled = true;
