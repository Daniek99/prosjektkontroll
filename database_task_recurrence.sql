-- Recurrence for personal to-do tasks (daily, weekly, monthly)

ALTER TABLE public.user_tasks
    ADD COLUMN IF NOT EXISTS recurrence text
    CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly'));
