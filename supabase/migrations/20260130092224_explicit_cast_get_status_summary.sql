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
        r.status::TEXT, -- Explicitly cast to TEXT
        COUNT(r.id)::BIGINT AS count -- Explicitly cast to BIGINT
    FROM
        public.requests r
    GROUP BY
        r.status
    ORDER BY
        r.status;
END;
$$;