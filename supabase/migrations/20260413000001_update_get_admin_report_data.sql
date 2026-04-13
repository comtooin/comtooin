-- AI 리포트 전용 데이터 추출 함수 업데이트 (요청자 이름 포함)
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
    requester_name TEXT, -- 요청자 컬럼 추가
    content TEXT,
    reply_content TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.created_at,
        r.customer_name,
        r.user_name,
        r.requester_name, -- 요청자 데이터 가져오기
        r.content,
        (SELECT c.comment FROM public.comments c 
         WHERE c.request_id = r.id 
         ORDER BY c.created_at DESC 
         LIMIT 1) as reply_content,
        r.status
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
