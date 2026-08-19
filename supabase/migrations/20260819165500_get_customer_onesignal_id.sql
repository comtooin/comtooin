-- Create a SECURITY DEFINER function to fetch customer onesignal_id bypassing RLS policies securely
CREATE OR REPLACE FUNCTION public.get_customer_onesignal_id(target_cust_id UUID)
RETURNS TABLE (onesignal_id TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY 
    SELECT c.onesignal_id 
    FROM public.customers c 
    WHERE c.id = target_cust_id AND c.onesignal_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_customer_onesignal_id(UUID) TO authenticated, anon;
