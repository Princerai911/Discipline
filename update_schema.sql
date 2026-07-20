-- We are converting 'tasks' into daily recurring routines.
-- Step 1: Add time field to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_time TIME;

-- Step 2: Remove the static is_completed and date fields since they are now tracked daily
-- We won't drop them to avoid data loss errors if they have data, but we won't use them.
-- Alternatively, we can just ignore them in the code.

-- Step 3: Create a completions table for the daily reset logic
CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT current_date NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(task_id, date) -- Ensure only one completion record per task per day
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for anon users on task_completions" ON public.task_completions
  FOR ALL USING (true) WITH CHECK (true);
