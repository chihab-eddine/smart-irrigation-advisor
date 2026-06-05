-- ============================================
-- Migration 006 — blog (posts, comments, ratings)
-- Safe to re-run.
-- ============================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    title_fr text NOT NULL,
    title_ar text NOT NULL,
    excerpt_fr text,
    excerpt_ar text,
    content_fr text NOT NULL,
    content_ar text NOT NULL,
    cover_image_url text,
    category text DEFAULT 'irrigation',
    reading_time_minutes integer DEFAULT 5,
    author_name text DEFAULT 'Smart Irrigation Team',
    published_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at
    ON public.blog_posts (published_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_post_created
    ON public.blog_comments (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_ratings (
    post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

-- RLS
ALTER TABLE public.blog_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_ratings  ENABLE ROW LEVEL SECURITY;

-- Public reads (anyone, even logged out, can browse posts and the
-- aggregate comment/rating data — actual writes still require auth)
DROP POLICY IF EXISTS "Blog posts are publicly readable"     ON public.blog_posts;
DROP POLICY IF EXISTS "Blog comments are publicly readable"  ON public.blog_comments;
DROP POLICY IF EXISTS "Blog ratings are publicly readable"   ON public.blog_ratings;

CREATE POLICY "Blog posts are publicly readable"
    ON public.blog_posts FOR SELECT USING (true);

CREATE POLICY "Blog comments are publicly readable"
    ON public.blog_comments FOR SELECT USING (true);

CREATE POLICY "Blog ratings are publicly readable"
    ON public.blog_ratings FOR SELECT USING (true);

-- Authenticated users: insert/update/delete their own rows
DROP POLICY IF EXISTS "Users insert own comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Users delete own comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Users upsert own ratings"  ON public.blog_ratings;
DROP POLICY IF EXISTS "Users update own ratings"  ON public.blog_ratings;
DROP POLICY IF EXISTS "Users delete own ratings"  ON public.blog_ratings;

CREATE POLICY "Users insert own comments"
    ON public.blog_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own comments"
    ON public.blog_comments FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own ratings"
    ON public.blog_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own ratings"
    ON public.blog_ratings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own ratings"
    ON public.blog_ratings FOR DELETE
    USING (auth.uid() = user_id);
