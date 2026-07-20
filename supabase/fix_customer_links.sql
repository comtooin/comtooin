-- ====================================================================
-- [설명]
-- 거래처 계정 등록 과정에서 Edge Function 연동 지연 혹은 매개변수 불일치 등의 이유로
-- Supabase Auth 사용자만 생성되고 public.customers 테이블의 auth_user_id 컬럼이
-- NULL로 누락된 현상을 자동으로 매핑하여 해결하는 데이터베이스 복구 스크립트입니다.
--
-- [실행 방법]
-- Supabase Dashboard -> SQL Editor에 복사하여 실행(Run)하십시오.
-- ====================================================================

-- 1. login_email이 존재하고 auth_user_id가 누락된 고객에 대해
--    auth.users 테이블의 email과 비교하여 auth_user_id를 자동으로 복구합니다.
UPDATE public.customers c
SET auth_user_id = u.id
FROM auth.users u
WHERE c.login_email = u.email 
  AND c.auth_user_id IS NULL;

-- 2. name 또는 login_id를 기반으로 한 추가 이메일 매칭 복구
--    (가상 이메일 jibistyle@comtooin-customer.local 등이 auth.users에 이미 생성된 경우)
UPDATE public.customers c
SET auth_user_id = u.id
FROM auth.users u
WHERE c.login_id IS NOT NULL 
  AND u.email = (c.login_id || '@comtooin-customer.local')
  AND c.auth_user_id IS NULL;

-- 3. (확인용) 복구가 정상적으로 되었는지 현재 거래처 정보와 linked 여부를 출력합니다.
SELECT id, name, login_id, login_email, auth_user_id,
       CASE WHEN auth_user_id IS NOT NULL THEN '연동 완료 (성공)' ELSE '연동 미완료 (계정 없음)' END as status
FROM public.customers
ORDER BY name;
