-- customer_hardware 및 customer_software 테이블에 Supabase Realtime 활성화
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_hardware;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    -- 이미 추가되었거나 publication이 없는 경우 예외 처리
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_software;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    -- 이미 추가되었거나 publication이 없는 경우 예외 처리
    NULL;
  END;
END $$;
