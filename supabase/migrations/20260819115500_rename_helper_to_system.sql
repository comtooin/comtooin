-- 상태 변경 실시간 동기화 트리거 함수에서 시스템 발신자 명칭을 '컴투인 헬퍼'에서 '컴투인'으로 변경
CREATE OR REPLACE FUNCTION public.fn_sync_request_status_to_chat()
RETURNS TRIGGER AS $$
DECLARE
    status_label TEXT;
BEGIN
    -- status 상태 라벨링 매핑
    IF NEW.status = 'processing' OR NEW.status = 'pending' OR NEW.status = '처리중' THEN
        status_label := '처리중';
    ELSIF NEW.status = 'completed' OR NEW.status = '처리완료' THEN
        status_label := '처리완료';
    ELSE
        status_label := NEW.status;
    END IF;

    -- chat_room_id가 연결되어 있고 상태값이 올바르게 변경되었을 때 실시간 동기화
    IF NEW.chat_room_id IS NOT NULL AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        INSERT INTO public.memos (content, author_name, room_id, color)
        VALUES (
            '[시스템] 📢 기술지원 요청 건의 진행 현황이 <b>[' || status_label || ']</b> 상태로 변경되었습니다.',
            '컴투인 (시스템)',
            NEW.chat_room_id,
            '#fffbeb' -- Soft yellow background for system notification
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
