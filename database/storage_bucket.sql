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
