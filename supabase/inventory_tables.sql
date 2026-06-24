-- 1. 하드웨어 인벤토리 테이블 생성
CREATE TABLE IF NOT EXISTS public.customer_hardware (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  computer_name text,
  ip_address text,
  os text,
  processor text,
  motherboard text,
  memory text,
  graphic_card text,
  storage text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_hardware_pkey PRIMARY KEY (id)
);

-- 2. 소프트웨어 인벤토리 테이블 생성
CREATE TABLE IF NOT EXISTS public.customer_software (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  computer_name text,
  program_name text,
  program_version text,
  publisher text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_software_pkey PRIMARY KEY (id)
);

-- 3. RLS(Row Level Security) 설정
ALTER TABLE public.customer_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_software ENABLE ROW LEVEL SECURITY;

-- 4. 정책 생성 (인증된 사용자만 접근 가능하도록 설정)
-- Hardware 정책
CREATE POLICY "Enable read access for authenticated users on customer_hardware" ON public.customer_hardware FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on customer_hardware" ON public.customer_hardware FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on customer_hardware" ON public.customer_hardware FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on customer_hardware" ON public.customer_hardware FOR DELETE TO authenticated USING (true);

-- Software 정책
CREATE POLICY "Enable read access for authenticated users on customer_software" ON public.customer_software FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on customer_software" ON public.customer_software FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on customer_software" ON public.customer_software FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on customer_software" ON public.customer_software FOR DELETE TO authenticated USING (true);

-- 5. Updated_at 트리거 생성 (기존에 정의된 트리거 함수 사용)
CREATE TRIGGER handle_updated_at_customer_hardware
  BEFORE UPDATE ON public.customer_hardware
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime (updated_at);

CREATE TRIGGER handle_updated_at_customer_software
  BEFORE UPDATE ON public.customer_software
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime (updated_at);
