-- ============================================
-- Migration 005 — persist field geometry + irrigation system in irrigation_predictions
-- Safe to re-run.
-- ============================================

ALTER TABLE public.irrigation_predictions
    ADD COLUMN IF NOT EXISTS land_size_m2 NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS irrigation_method TEXT
        CHECK (irrigation_method IS NULL OR irrigation_method IN ('drip', 'sprinkler', 'surface')),
    ADD COLUMN IF NOT EXISTS irrigation_efficiency NUMERIC(4,3),
    ADD COLUMN IF NOT EXISTS gross_water_mm NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS total_water_liters NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS water_savings JSONB,
    ADD COLUMN IF NOT EXISTS drip_info JSONB;
