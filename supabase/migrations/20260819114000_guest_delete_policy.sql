-- chat_rooms DELETE RLS 정책을 비회원(is_private = true)에게도 허용하도록 보완
DROP POLICY IF EXISTS "Enable delete for creator or admin" ON public.chat_rooms;

CREATE POLICY "Enable delete for creator, admin or guest rooms" ON public.chat_rooms
    FOR DELETE
    USING (
        auth.uid() = created_by OR
        EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = auth.uid() AND role = 'admin') OR
        is_private = true
    );
