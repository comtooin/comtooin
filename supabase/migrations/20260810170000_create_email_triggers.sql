-- 1. 기존 '업무기록 자동 알림 메일' 트리거의 보안 인증 토큰 값을 동적으로 안전 추출하여 2개의 신규 트리거에 이식
DO $$
DECLARE
    def TEXT;
    args TEXT;
BEGIN
    -- '업무기록 자동 알림 메일' 트리거의 SQL 정의 텍스트 추출
    SELECT pg_get_triggerdef(oid) INTO def
    FROM pg_trigger
    WHERE tgname = '업무기록 자동 알림 메일' AND tgrelid = 'public.requests'::regclass;

    IF def IS NOT NULL THEN
        -- http_request(...) 함수 내부의 URL, Method, Header 토큰 등의 인자부만 정규 적출
        args := substring(def from 'supabase_functions\.http_request\((.*)\)');

        IF args IS NOT NULL THEN
            -- A. 진행상태 변경 감지 트리거 생성 (기존 건 삭제 후 재생성)
            EXECUTE 'DROP TRIGGER IF EXISTS send_email_on_request_status_update ON public.requests';
            EXECUTE 'CREATE TRIGGER send_email_on_request_status_update ' ||
                    'AFTER UPDATE OF status ON public.requests ' ||
                    'FOR EACH ROW ' ||
                    'EXECUTE FUNCTION supabase_functions.http_request(' || args || ')';

            -- B. 코멘트(처리 내용) 추가 감지 트리거 생성
            EXECUTE 'DROP TRIGGER IF EXISTS send_email_on_comment_insert ON public.comments';
            EXECUTE 'CREATE TRIGGER send_email_on_comment_insert ' ||
                    'AFTER INSERT ON public.comments ' ||
                    'FOR EACH ROW ' ||
                    'EXECUTE FUNCTION supabase_functions.http_request(' || args || ')';
        END IF;
    END IF;
END $$;
