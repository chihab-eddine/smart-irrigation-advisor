-- ============================================
-- Migration 004 — add notification_minute column
-- Safe to re-run.
-- ============================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS notification_minute SMALLINT NOT NULL DEFAULT 0
        CHECK (notification_minute BETWEEN 0 AND 59);

-- Replace the hour-only index with a composite (hour, minute) index, since
-- the daily-reminders cron now filters on both columns.
DROP INDEX IF EXISTS public.idx_users_notif_hour;
CREATE INDEX IF NOT EXISTS idx_users_notif_hour_min
    ON public.users (notification_hour, notification_minute)
    WHERE notification_enabled = true;
