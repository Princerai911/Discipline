-- Step 1: Add end_time to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time TIME;

-- Step 2: Add status to task_completions
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' NOT NULL;
