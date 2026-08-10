-- 1. 기존 RLS 정책 선제 드롭 (타입 변경 전 의존성 해제)
DROP POLICY IF EXISTS "Enable read access for all staff" ON public.memos;
DROP POLICY IF EXISTS "Enable insert for staff" ON public.memos;
DROP POLICY IF EXISTS "Enable update for owners" ON public.memos;
DROP POLICY IF EXISTS "Enable delete for owners or admin" ON public.memos;

DROP POLICY IF EXISTS "Enable read access for all staff" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for staff" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable delete for creator or admin" ON public.chat_rooms;

-- 2. 기존 데이터의 author_id / created_by 값을 staff.id에서 auth.users.id(auth_user_id)로 안전 마이그레이션
UPDATE public.memos m
SET author_id = s.auth_user_id
FROM public.staff s
WHERE m.author_id = s.id AND s.auth_user_id IS NOT NULL;

UPDATE public.chat_rooms c
SET created_by = s.auth_user_id
FROM public.staff s
WHERE c.created_by = s.id AND s.auth_user_id IS NOT NULL;

-- 3. memos 테이블 외래키 제약 조건 변경
ALTER TABLE public.memos DROP CONSTRAINT IF EXISTS memos_author_id_fkey;
ALTER TABLE public.memos ALTER COLUMN author_id TYPE UUID;
ALTER TABLE public.memos ADD CONSTRAINT memos_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. chat_rooms 테이블 외래키 제약 조건 변경
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_created_by_fkey;
ALTER TABLE public.chat_rooms ALTER COLUMN created_by TYPE UUID;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. memos 테이블에 author_name 컬럼 추가 및 기존 데이터 매핑
ALTER TABLE public.memos ADD COLUMN IF NOT EXISTS author_name TEXT;

-- 기존 memos 레코드의 author_name을 매칭되는 staff.name 값으로 일제히 전환
UPDATE public.memos m
SET author_name = s.name
FROM public.staff s
WHERE m.author_id = s.id OR m.author_id = s.auth_user_id;

-- 만약 여전히 null인 기존 메모가 있다면 '알 수 없음'으로 처리
UPDATE public.memos SET author_name = '알 수 없음' WHERE author_name IS NULL;

-- 6. 개량된 memos RLS 정책 신설
CREATE POLICY "Enable read access for staff and customers" ON public.memos
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Enable insert for authenticated users" ON public.memos
    FOR INSERT
    WITH CHECK (
        auth.uid() = author_id AND (
            EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Enable update for owners" ON public.memos
    FOR UPDATE
    USING (
        auth.uid() = author_id
    );

CREATE POLICY "Enable delete for owners or admin" ON public.memos
    FOR DELETE
    USING (
        auth.uid() = author_id OR 
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid() AND role = 'admin')
    );

-- 7. 개량된 chat_rooms RLS 정책 신설
CREATE POLICY "Enable read access for staff and customers" ON public.chat_rooms
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Enable insert for authenticated users" ON public.chat_rooms
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by AND (
            EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Enable delete for creator or admin" ON public.chat_rooms
    FOR DELETE
    USING (
        auth.uid() = created_by OR
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid() AND role = 'admin')
    );
