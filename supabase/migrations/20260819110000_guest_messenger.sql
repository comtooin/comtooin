-- 1. customers 테이블 확장 (client_code 추가)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS client_code TEXT UNIQUE;

-- 2. chat_rooms 테이블 확장
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS guest_email TEXT;

-- 3. requests 테이블 확장 (chat_room_id 추가)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL;

-- 4. RLS 정책 드롭 및 재생성 (비회원/익명 사용자 허용)
DROP POLICY IF EXISTS "Enable read access for staff and customers" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.chat_rooms;

-- chat_rooms SELECT 정책: 직원/고객사 또는 비공개 격리방(is_private = true)인 경우 조회 허용
CREATE POLICY "Enable read access for staff, customers and guest rooms" ON public.chat_rooms
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid()) OR
        is_private = true
    );

-- chat_rooms INSERT 정책: 직원/고객사 또는 비공개 격리방(is_private = true)인 경우 생성 허용
CREATE POLICY "Enable insert for authenticated users and guest rooms" ON public.chat_rooms
    FOR INSERT
    WITH CHECK (
        (auth.uid() = created_by AND (
            EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
        )) OR
        is_private = true
    );

-- memos RLS 정책 드롭 및 재생성
DROP POLICY IF EXISTS "Enable read access for staff and customers" ON public.memos;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.memos;

-- memos SELECT 정책: 직원/고객사 또는 속한 방이 비공개 격리방(is_private = true)인 경우 조회 허용
CREATE POLICY "Enable read access for staff, customers and guest memos" ON public.memos
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.is_private = true)
    );

-- memos INSERT 정책: 직원/고객사 또는 속한 방이 비공개 격리방(is_private = true)인 경우 생성 허용
CREATE POLICY "Enable insert for staff, customers and guest memos" ON public.memos
    FOR INSERT
    WITH CHECK (
        (auth.uid() = author_id AND (
            EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = auth.uid())
        )) OR
        (author_id IS NULL AND EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.is_private = true))
    );

-- 5. requests 상태(status) 변경 시 chat_rooms에 자동 실시간 시스템 메시지를 남기는 트리거 함수 정의
CREATE OR REPLACE FUNCTION public.fn_sync_request_status_to_chat()
RETURNS TRIGGER AS $$
DECLARE
    status_label TEXT;
BEGIN
    -- status 필드가 변경되었고, 연결된 chat_room_id가 존재하는 경우에만 동작
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.chat_room_id IS NOT NULL) THEN
        -- 한국어 가독성 라벨 처리
        status_label := CASE NEW.status
            WHEN 'pending' THEN '접수대기'
            WHEN 'processing' THEN '처리중'
            WHEN 'completed' THEN '처리완료'
            ELSE NEW.status
        END;

        -- 시스템 메시지 인서트 (author_name은 '컴투인 헬퍼 (시스템)', author_id는 NULL)
        INSERT INTO public.memos (content, author_name, room_id, color)
        VALUES (
            '[시스템] 📢 기술지원 요청 건의 진행 현황이 <b>[' || status_label || ']</b> 상태로 변경되었습니다.',
            '컴투인 헬퍼 (시스템)',
            NEW.chat_room_id,
            '#fffbeb' -- Soft yellow background for system notification
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 바인딩
DROP TRIGGER IF EXISTS tr_sync_request_status_to_chat ON public.requests;
CREATE TRIGGER tr_sync_request_status_to_chat
    AFTER UPDATE OF status ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_request_status_to_chat();
