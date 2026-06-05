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
