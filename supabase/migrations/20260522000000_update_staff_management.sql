-- Update staff table to support advanced member management
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member'));
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a default role if needed (though default is set)
UPDATE public.staff SET role = 'admin' WHERE role IS NULL;

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Policies for staff table
-- 1. Admins can do everything
CREATE POLICY "Admins can manage all staff" ON public.staff
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid() AND role = 'admin'
        )
    );

-- 2. Members can view other staff (for selection in schedules, etc.)
CREATE POLICY "Members can view staff" ON public.staff
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE auth_user_id = auth.uid()
        )
    );

-- 3. Users can update their own profile (limited)
CREATE POLICY "Users can update own profile" ON public.staff
    FOR UPDATE
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Function to handle new user creation sync (optional but good for consistency)
-- This might not be needed if we use Edge Function for everything, 
-- but it's a good safety net.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.staff (id, auth_user_id, name, email, role)
    VALUES (gen_random_uuid(), NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'member'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We won't enable the trigger yet to avoid conflicts with manual insertion 
-- unless requested, but the schema is ready.
