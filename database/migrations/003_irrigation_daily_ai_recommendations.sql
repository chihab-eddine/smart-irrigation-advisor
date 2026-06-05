-- Store one Gemini irrigation recommendation per saved calculation per day.

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = uid
          AND role = 'admin'
          AND is_active = true
    );
$$;

CREATE TABLE IF NOT EXISTS public.irrigation_ai_recommendations (
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

CREATE INDEX IF NOT EXISTS idx_irrigation_ai_user_date
    ON public.irrigation_ai_recommendations(user_id, recommendation_date DESC);

ALTER TABLE public.irrigation_ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations;
CREATE POLICY "Users can view own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations;
CREATE POLICY "Users can insert own irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all irrigation AI recommendations"
    ON public.irrigation_ai_recommendations;
CREATE POLICY "Admins can view all irrigation AI recommendations"
    ON public.irrigation_ai_recommendations FOR SELECT
    USING (public.is_admin());
