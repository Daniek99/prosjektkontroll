-- Custom task categories for the personal to-do list (max 2 per user)

CREATE TABLE IF NOT EXISTS public.user_task_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_task_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own task categories" ON public.user_task_categories;
CREATE POLICY "Users manage own task categories"
    ON public.user_task_categories
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enforce the maximum of two custom categories per user
CREATE OR REPLACE FUNCTION public.enforce_max_task_categories()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT count(*) FROM public.user_task_categories WHERE user_id = NEW.user_id) >= 2 THEN
        RAISE EXCEPTION 'Maximum of 2 custom task categories per user';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_max_task_categories ON public.user_task_categories;
CREATE TRIGGER trg_max_task_categories
    BEFORE INSERT ON public.user_task_categories
    FOR EACH ROW EXECUTE FUNCTION public.enforce_max_task_categories();

-- Link tasks to a custom category (NULL = built-in date-based tabs)
ALTER TABLE public.user_tasks
    ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.user_task_categories(id) ON DELETE SET NULL;
