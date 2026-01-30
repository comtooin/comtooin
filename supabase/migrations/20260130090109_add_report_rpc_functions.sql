-- get_monthly_summary function
CREATE OR REPLACE FUNCTION public.get_monthly_summary(target_year INT)
RETURNS TABLE(
    month TEXT,
    total_requests BIGINT,
    pending_requests BIGINT,
    completed_requests BIGINT,
    cancelled_requests BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(id) AS total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 ELSE NULL END) AS pending_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 ELSE NULL END) AS completed_requests,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 ELSE NULL END) AS cancelled_requests
    FROM
        public.requests
    WHERE
        EXTRACT(YEAR FROM created_at) = target_year
    GROUP BY
        date_trunc('month', created_at)
    ORDER BY
        month;
END;
$$;

-- get_status_summary function
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

-- get_admin_report_data function
CREATE OR REPLACE FUNCTION public.get_admin_report_data(
    _customer_name TEXT DEFAULT NULL,
    _month INT DEFAULT NULL,
    _status TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    customer_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    title TEXT,
    description TEXT,
    status TEXT,
    response TEXT,
    password TEXT,
    images TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.created_at,
        r.updated_at,
        r.customer_name,
        r.user_email,
        r.user_phone,
        r.title,
        r.description,
        r.status,
        r.response,
        r.password,
        r.images
    FROM
        public.requests r
    WHERE
        (_customer_name IS NULL OR r.customer_name ILIKE ('%' || _customer_name || '%'))
        AND (_month IS NULL OR EXTRACT(MONTH FROM r.created_at) = _month)
        AND (_status IS NULL OR r.status ILIKE _status)
    ORDER BY
        r.created_at DESC;
END;
$$;
