-- Fix infinite recursion on staff table policies

DROP POLICY IF EXISTS "Admins can manage all staff" ON public.staff;
DROP POLICY IF EXISTS "Members can view staff" ON public.staff;
DROP POLICY IF EXISTS "Users can update own profile" ON public.staff;

-- 1. All authenticated users can view staff
CREATE POLICY "Enable read access for all authenticated users"
    ON public.staff
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.staff
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- 3. Admins can do everything (Using a workaround to avoid recursion)
-- We use current_setting to avoid querying the table directly, but a simpler way 
-- is to just create a security definer function if needed. 
-- For now, if admins need to insert/delete, they should use service role, 
-- or we can provide a basic policy:
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admins can insert" ON public.staff FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update" ON public.staff FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete" ON public.staff FOR DELETE TO authenticated USING (public.is_admin());
