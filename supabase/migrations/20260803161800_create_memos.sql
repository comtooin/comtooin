-- Create public.memos table
CREATE TABLE IF NOT EXISTS public.memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    content TEXT NOT NULL,
    color TEXT DEFAULT '#fffbeb',
    author_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all staff" ON public.memos;
DROP POLICY IF EXISTS "Enable insert for staff" ON public.memos;
DROP POLICY IF EXISTS "Enable update for owners" ON public.memos;
DROP POLICY IF EXISTS "Enable delete for owners or admin" ON public.memos;

-- Policies for public.memos
-- 1. All authenticated staff can select memos
CREATE POLICY "Enable read access for all staff" ON public.memos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid()
        )
    );

-- 2. Staff can insert memos for their own staff ID
CREATE POLICY "Enable insert for staff" ON public.memos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND id = author_id
        )
    );

-- 3. Staff can update their own memos
CREATE POLICY "Enable update for owners" ON public.memos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND id = author_id
        )
    );

-- 4. Staff can delete their own memos or admins can delete any
CREATE POLICY "Enable delete for owners or admin" ON public.memos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND (id = author_id OR role = 'admin')
        )
    );

-- Enable Realtime for public.memos
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memos;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    NULL;
  END;
END $$;
