-- Create goals table
CREATE TABLE public.goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS) policies
-- Note: Since no auth is set up yet, we will enable anon access for demonstration.
-- In production, you'd want authenticated users only.
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for anon users on goals" ON public.goals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on tasks" ON public.tasks
  FOR ALL USING (true) WITH CHECK (true);
