CREATE OR REPLACE FUNCTION public.get_status_summary()
RETURNS TABLE(
    status TEXT,
    count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY VALUES ('test_status', 10::bigint);
END;
$$;