-- Fix get_admin_report_data function return type mismatch by casting all columns to match the output table schema
CREATE OR REPLACE FUNCTION public.get_admin_report_data(
    _customer_name TEXT DEFAULT 'all',
    _month TEXT DEFAULT 'all',
    _status TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id BIGINT,
    created_at TIMESTAMPTZ,
    customer_name TEXT,
    user_name TEXT,
    requester_name TEXT,
    content TEXT,
    reply_content TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id::BIGINT,
        r.created_at,
        r.customer_name::TEXT,
        r.user_name::TEXT,
        r.requester_name::TEXT,
        r.content::TEXT,
        (SELECT c.comment FROM public.comments c 
         WHERE c.request_id = r.id 
         ORDER BY c.created_at DESC 
         LIMIT 1)::TEXT as reply_content,
        r.status::TEXT
    FROM
        public.requests r
    WHERE
        (_customer_name = 'all' OR r.customer_name = _customer_name)
        AND (_month = 'all' OR to_char(r.created_at, 'YYYY-MM') = _month)
        AND (_status = 'all' OR (
            CASE 
                WHEN _status = '처리중' THEN r.status IN ('processing', 'pending')
                WHEN _status = '처리완료' THEN r.status = 'completed'
                ELSE r.status = _status
            END
        ))
    ORDER BY
        r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_report_data(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_report_data(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_report_data(TEXT, TEXT, TEXT) TO anon;
