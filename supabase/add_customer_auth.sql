-- 1. customers 테이블에 로그인용 컬럼 추가
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS login_id text UNIQUE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS login_email text UNIQUE;

-- 2. staff 판단용 public.is_staff() 보안정의 함수 생성/수정
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. customers 테이블 RLS 정책 설정
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for staff and own customer" ON public.customers;
DROP POLICY IF EXISTS "Enable update for staff and own customer" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for staff only" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for staff only" ON public.customers;

-- SELECT 정책: 직원 전체 혹은 해당 거래처 본인
CREATE POLICY "Enable read access for staff and own customer" ON public.customers
    FOR SELECT TO authenticated
    USING (public.is_staff() OR auth_user_id = auth.uid());

-- UPDATE 정책: 직원 전체 혹은 해당 거래처 본인 (단 거래처 본인은 매니저 정보 등 일부 연락처만 수정하도록 권장)
CREATE POLICY "Enable update for staff and own customer" ON public.customers
    FOR UPDATE TO authenticated
    USING (public.is_staff() OR auth_user_id = auth.uid())
    WITH CHECK (public.is_staff() OR auth_user_id = auth.uid());

-- INSERT/DELETE 정책: 직원(어드민)만 허용
CREATE POLICY "Enable insert for staff only" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff());

CREATE POLICY "Enable delete for staff only" ON public.customers
    FOR DELETE TO authenticated
    USING (public.is_staff());


-- 4. customer_hardware RLS 정책 개편
DROP POLICY IF EXISTS "Enable read access for authenticated users on customer_hardware" ON public.customer_hardware;
DROP POLICY IF EXISTS "Enable insert for authenticated users on customer_hardware" ON public.customer_hardware;
DROP POLICY IF EXISTS "Enable update for authenticated users on customer_hardware" ON public.customer_hardware;
DROP POLICY IF EXISTS "Enable delete for authenticated users on customer_hardware" ON public.customer_hardware;

CREATE POLICY "Enable read access for staff and own customer_hardware" ON public.customer_hardware
    FOR SELECT TO authenticated
    USING (public.is_staff() OR customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Enable insert for staff only on customer_hardware" ON public.customer_hardware
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff());

CREATE POLICY "Enable update for staff only on customer_hardware" ON public.customer_hardware
    FOR UPDATE TO authenticated
    USING (public.is_staff());

CREATE POLICY "Enable delete for staff only on customer_hardware" ON public.customer_hardware
    FOR DELETE TO authenticated
    USING (public.is_staff());


-- 5. customer_software RLS 정책 개편
DROP POLICY IF EXISTS "Enable read access for authenticated users on customer_software" ON public.customer_software;
DROP POLICY IF EXISTS "Enable insert for authenticated users on customer_software" ON public.customer_software;
DROP POLICY IF EXISTS "Enable update for authenticated users on customer_software" ON public.customer_software;
DROP POLICY IF EXISTS "Enable delete for authenticated users on customer_software" ON public.customer_software;

CREATE POLICY "Enable read access for staff and own customer_software" ON public.customer_software
    FOR SELECT TO authenticated
    USING (public.is_staff() OR customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Enable insert for staff only on customer_software" ON public.customer_software
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff());

CREATE POLICY "Enable update for staff only on customer_software" ON public.customer_software
    FOR UPDATE TO authenticated
    USING (public.is_staff());

CREATE POLICY "Enable delete for staff only on customer_software" ON public.customer_software
    FOR DELETE TO authenticated
    USING (public.is_staff());


-- 6. requests RLS 정책 개편
-- 만약 requests RLS가 걸려있지 않다면 걸어주고 정책 설정
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for staff and own requests" ON public.requests;
DROP POLICY IF EXISTS "Enable insert for staff only on requests" ON public.requests;
DROP POLICY IF EXISTS "Enable update for staff only on requests" ON public.requests;
DROP POLICY IF EXISTS "Enable delete for staff only on requests" ON public.requests;

CREATE POLICY "Enable read access for staff and own requests" ON public.requests
    FOR SELECT TO authenticated
    USING (public.is_staff() OR customer_name IN (SELECT name FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Enable insert for staff only on requests" ON public.requests
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff());

CREATE POLICY "Enable update for staff only on requests" ON public.requests
    FOR UPDATE TO authenticated
    USING (public.is_staff());

CREATE POLICY "Enable delete for staff only on requests" ON public.requests
    FOR DELETE TO authenticated
    USING (public.is_staff());
