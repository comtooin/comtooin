CREATE TABLE IF NOT EXISTS public.quote_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    customer_name TEXT,
    global_margin NUMERIC DEFAULT 15,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_final NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 설정
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자 조회 및 쓰기 허용
CREATE POLICY "Allow authenticated access for quote_templates" ON public.quote_templates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
