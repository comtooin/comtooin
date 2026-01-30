CREATE OR REPLACE FUNCTION public.get_status_summary()
RETURNS TABLE(
    status TEXT,
    count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.status,
        COUNT(r.id) AS count
    FROM
        public.requests r
    GROUP BY
        r.status
    ORDER BY
        r.status;
END;
$$;