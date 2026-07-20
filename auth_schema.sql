-- Step 1: Add user_id to goals and notes
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- If you have existing data, this will link it to the first user who signs up (since user_id will default to their uid when they insert). 
-- For existing rows, user_id will be NULL right now. We will update them below temporarily if needed, but since it's just for you, 
-- you can just create fresh data or manually update it in the Supabase dashboard.

-- Step 2: Lock down the policies (Remove anonymous access)
DROP POLICY IF EXISTS "Enable all access for anon users on goals" ON public.goals;
DROP POLICY IF EXISTS "Enable all access for anon users on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable all access for anon users on notes" ON public.notes;

-- Step 3: Create Authenticated Policies
-- Goals
CREATE POLICY "Users can manage their own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notes
CREATE POLICY "Users can manage their own notes" ON public.notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
-- Tasks are linked to goals. We can just rely on the goal_id for security, but for simplicity we can allow auth users to manage tasks where the goal belongs to them.
CREATE POLICY "Users can manage tasks of their goals" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.goals WHERE goals.id = tasks.goal_id AND goals.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals WHERE goals.id = tasks.goal_id AND goals.user_id = auth.uid()
    )
  );

-- Task Completions
-- Similarly, completions belong to tasks which belong to goals.
CREATE POLICY "Users can manage completions of their tasks" ON public.task_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      JOIN public.goals ON tasks.goal_id = goals.id 
      WHERE task_completions.task_id = tasks.id AND goals.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      JOIN public.goals ON tasks.goal_id = goals.id 
      WHERE task_completions.task_id = tasks.id AND goals.user_id = auth.uid()
    )
  );

-- Enable RLS on completions if not already
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
