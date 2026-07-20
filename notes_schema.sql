CREATE TABLE IF NOT EXISTS public.notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for anon users on notes" ON public.notes
  FOR ALL USING (true) WITH CHECK (true);
