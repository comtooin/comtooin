-- Fix RLS policies for comments table
-- Previously, policies might have used auth.uid() = user_id
-- Now user_id references public.staff(id), so we need to check through the staff table.

-- 1. Enable RLS (just in case)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to recreate them (names might vary, so we use a DO block)
DO $$
BEGIN
    -- Drop "Users can insert their own comments" if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can insert their own comments') THEN
        DROP POLICY "Users can insert their own comments" ON public.comments;
    END IF;
    
    -- Drop "Users can update their own comments" if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can update their own comments') THEN
        DROP POLICY "Users can update their own comments" ON public.comments;
    END IF;

    -- Drop "Anyone can view comments" if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Anyone can view comments') THEN
        DROP POLICY "Anyone can view comments" ON public.comments;
    END IF;
END $$;

-- 3. Create new policies
-- Allow insert if the user_id in comments matches the staff.id of the current authenticated user
CREATE POLICY "Users can insert their own comments" ON public.comments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE staff.id = comments.user_id 
              AND staff.auth_user_id = auth.uid()
        )
    );

-- Allow update if the user_id in comments matches the staff.id of the current authenticated user
CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE staff.id = comments.user_id 
              AND staff.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE staff.id = comments.user_id 
              AND staff.auth_user_id = auth.uid()
        )
    );

-- Allow everyone (authenticated) to view comments
CREATE POLICY "Anyone can view comments" ON public.comments
    FOR SELECT
    USING (auth.role() = 'authenticated');
