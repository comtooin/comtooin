-- customer_hardware 테이블에 부서(department) 및 사용자 이름(user_name) 컬럼 추가
ALTER TABLE public.customer_hardware ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.customer_hardware ADD COLUMN IF NOT EXISTS user_name text;

-- RPC 함수 생성: 하드웨어 및 소프트웨어 일괄 동기화 (트랜잭션 보장 및 SECURITY DEFINER 적용)
CREATE OR REPLACE FUNCTION public.sync_pc_asset(
  p_customer_id uuid,
  p_computer_name text,
  p_department text,
  p_user_name text,
  p_ip_address text,
  p_os text,
  p_processor text,
  p_motherboard text,
  p_memory text,
  p_graphic_card text,
  p_storage text,
  p_software jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. 기존 하드웨어 및 소프트웨어 기록 제거
  DELETE FROM public.customer_hardware 
  WHERE customer_id = p_customer_id AND computer_name = p_computer_name;
  
  DELETE FROM public.customer_software 
  WHERE customer_id = p_customer_id AND computer_name = p_computer_name;

  -- 2. 새 하드웨어 기록 추가
  INSERT INTO public.customer_hardware (
    customer_id,
    computer_name,
    department,
    user_name,
    ip_address,
    os,
    processor,
    motherboard,
    memory,
    graphic_card,
    storage
  ) VALUES (
    p_customer_id,
    p_computer_name,
    p_department,
    p_user_name,
    p_ip_address,
    p_os,
    p_processor,
    p_motherboard,
    p_memory,
    p_graphic_card,
    p_storage
  );

  -- 3. 새 소프트웨어 기록 추가 (존재하는 경우)
  IF p_software IS NOT NULL AND jsonb_array_length(p_software) > 0 THEN
    INSERT INTO public.customer_software (
      customer_id,
      computer_name,
      program_name,
      program_version,
      publisher
    )
    SELECT 
      p_customer_id,
      p_computer_name,
      (elem->>'program_name')::text,
      (elem->>'program_version')::text,
      (elem->>'publisher')::text
    FROM jsonb_array_elements(p_software) AS elem;
  END IF;
END;
$$;

-- Anon 및 Authenticated 역할에 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.sync_pc_asset TO anon, authenticated;
