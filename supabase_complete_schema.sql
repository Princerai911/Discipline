-- ==============================================================================
-- DISCIPLINE APP - COMPLETE SUPABASE DATABASE SETUP
-- ==============================================================================
-- Copy and paste this script directly into your Supabase Dashboard:
-- SQL Editor -> New Query -> Run

-- 1. Create Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Tasks (Habits / Routines) Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  scheduled_time time,
  end_time time,
  is_completed boolean DEFAULT false NOT NULL,
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Task Completions Table (for daily routines and streak tracking)
CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT current_date NOT NULL,
  status text DEFAULT 'completed' NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(task_id, date)
);

-- 4. Create Notebook Folders Table
CREATE TABLE IF NOT EXISTS public.notebook_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid REFERENCES public.notebook_folders(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Project Tasks Table (Kanban Board)
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  column_id text DEFAULT 'todo' NOT NULL, -- 'todo', 'doing', 'done', 'trash'
  priority text DEFAULT 'medium' NOT NULL, -- 'high', 'medium', 'low'
  tag text DEFAULT 'General',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ==============================================================================

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for anon users on goals" ON public.goals;
CREATE POLICY "Enable all access for anon users on goals" ON public.goals
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on tasks" ON public.tasks;
CREATE POLICY "Enable all access for anon users on tasks" ON public.tasks
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on task_completions" ON public.task_completions;
CREATE POLICY "Enable all access for anon users on task_completions" ON public.task_completions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on notebook_folders" ON public.notebook_folders;
CREATE POLICY "Enable all access for anon users on notebook_folders" ON public.notebook_folders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on notes" ON public.notes;
CREATE POLICY "Enable all access for anon users on notes" ON public.notes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on projects" ON public.projects;
CREATE POLICY "Enable all access for anon users on projects" ON public.projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on project_tasks" ON public.project_tasks;
CREATE POLICY "Enable all access for anon users on project_tasks" ON public.project_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_column ON public.project_tasks(column_id);
