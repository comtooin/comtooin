-- memos RLS 정책을 더 안전하고 직관적인 방향으로 개편
DROP POLICY IF EXISTS "Enable read access for staff, customers and guest memos" ON public.memos;
DROP POLICY IF EXISTS "Enable insert for staff, customers and guest memos" ON public.memos;

-- memos SELECT 정책: 사용자가 읽을 수 있는 chat_rooms에 속한 메모는 모두 읽기 허용
CREATE POLICY "Enable read access based on chat room visibility" ON public.memos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            WHERE r.id = room_id
        )
    );

-- memos INSERT 정책: 사용자가 읽을 수 있는 chat_rooms에 속한 메모는 모두 작성 허용
CREATE POLICY "Enable insert based on chat room visibility" ON public.memos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            WHERE r.id = room_id
        )
    );
