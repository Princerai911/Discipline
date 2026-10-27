-- Step 1: Create the notebook_folders table
CREATE TABLE IF NOT EXISTS public.notebook_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Add folder_id and title to notes table
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.notebook_folders(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS title text;

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE public.notebook_folders ENABLE ROW LEVEL SECURITY;

-- Step 4: Allow anonymous access (matching current app dev configuration)
DROP POLICY IF EXISTS "Enable all access for anon users on notebook_folders" ON public.notebook_folders;
CREATE POLICY "Enable all access for anon users on notebook_folders" ON public.notebook_folders
  FOR ALL USING (true) WITH CHECK (true);
