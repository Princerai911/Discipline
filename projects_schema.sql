-- ==============================================================================
-- DISCIPLINE APP - PROJECTS & KANBAN BOARD SCHEMA
-- ==============================================================================
-- How to apply:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to: SQL Editor (in the left sidebar) -> Click "New Query"
-- 3. Paste this entire code and click "Run" (or Ctrl + Enter)

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Project Tasks Table (Kanban Board)
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  column_id text DEFAULT 'todo' NOT NULL, -- 'todo', 'doing', 'done', 'trash'
  priority text DEFAULT 'medium' NOT NULL, -- 'high', 'medium', 'low'
  tag text DEFAULT 'General',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Set Open Access Policies for anon users (matching current development setup)
DROP POLICY IF EXISTS "Enable all access for anon users on projects" ON public.projects;
CREATE POLICY "Enable all access for anon users on projects" ON public.projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on project_tasks" ON public.project_tasks;
CREATE POLICY "Enable all access for anon users on project_tasks" ON public.project_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_column ON public.project_tasks(column_id);
