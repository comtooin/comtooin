-- Create a SECURITY DEFINER function to fetch staff onesignal_ids bypassing RLS policies securely
CREATE OR REPLACE FUNCTION public.get_staff_onesignal_ids(target_role TEXT DEFAULT NULL)
RETURNS TABLE (onesignal_id TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF target_role = 'member_only' THEN
        RETURN QUERY 
        SELECT s.onesignal_id 
        FROM public.staff s 
        WHERE s.role IN ('member', 'admin') AND s.onesignal_id IS NOT NULL;
    ELSE
        RETURN QUERY 
        SELECT s.onesignal_id 
        FROM public.staff s 
        WHERE s.onesignal_id IS NOT NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_staff_onesignal_ids(TEXT) TO authenticated, anon;
