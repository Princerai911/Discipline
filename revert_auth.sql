-- Drop the strict user policies
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can manage tasks of their goals" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage completions of their tasks" ON public.task_completions;

-- Restore public anonymous access
CREATE POLICY "Enable all access for anon users on goals" ON public.goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon users on notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon users on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon users on task_completions" ON public.task_completions FOR ALL USING (true) WITH CHECK (true);
