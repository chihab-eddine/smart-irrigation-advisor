-- ============================================
-- Migration 002 — Fix recursive users RLS admin policies
-- Safe to re-run.
-- ============================================
--
-- Error fixed:
--   42P17: infinite recursion detected in policy for relation "users"
--
-- Cause:
--   Admin policies queried public.users directly while RLS was evaluating
--   public.users, causing Postgres to recurse.

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

-- Users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
    ON public.users FOR UPDATE
    USING (public.is_admin());

-- Predictions
DROP POLICY IF EXISTS "Admins can view all irrigation predictions" ON public.irrigation_predictions;
CREATE POLICY "Admins can view all irrigation predictions"
    ON public.irrigation_predictions FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all disease predictions" ON public.disease_predictions;
CREATE POLICY "Admins can view all disease predictions"
    ON public.disease_predictions FOR SELECT
    USING (public.is_admin());

-- Contact
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
CREATE POLICY "Admins can view contact messages"
    ON public.contact_messages FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages"
    ON public.contact_messages FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete contact messages" ON public.contact_messages;
CREATE POLICY "Admins can delete contact messages"
    ON public.contact_messages FOR DELETE
    USING (public.is_admin());

-- Newsletter
DROP POLICY IF EXISTS "Admins can view newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view newsletter subscribers"
    ON public.newsletter_subscribers FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can update newsletter subscribers"
    ON public.newsletter_subscribers FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can delete newsletter subscribers"
    ON public.newsletter_subscribers FOR DELETE
    USING (public.is_admin());

-- App config
DROP POLICY IF EXISTS "Admins can update app config" ON public.app_config;
CREATE POLICY "Admins can update app config"
    ON public.app_config FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert app config" ON public.app_config;
CREATE POLICY "Admins can insert app config"
    ON public.app_config FOR INSERT
    WITH CHECK (public.is_admin());

-- Storage admin image deletion, if the disease-images bucket/policies exist.
DROP POLICY IF EXISTS "disease_images_admin_delete" ON storage.objects;
CREATE POLICY "disease_images_admin_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'disease-images'
        AND public.is_admin()
    );
