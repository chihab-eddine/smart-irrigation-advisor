-- ============================================
-- Migration 001 — notification preferences on public.users
-- Safe to re-run.
-- ============================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS notification_hour SMALLINT NOT NULL DEFAULT 7
        CHECK (notification_hour BETWEEN 0 AND 23),
    ADD COLUMN IF NOT EXISTS notification_region_id INTEGER REFERENCES public.moroccan_regions(id),
    ADD COLUMN IF NOT EXISTS notification_crop_id INTEGER REFERENCES public.crops(id),
    ADD COLUMN IF NOT EXISTS notification_planting_date DATE;

-- Index for the cron sweep: "give me everyone who opted in for this hour"
CREATE INDEX IF NOT EXISTS idx_users_notif_hour
    ON public.users (notification_hour)
    WHERE notification_enabled = true;

-- RLS — users may read/update their own preferences (existing "Users can update own profile" already permits this).
