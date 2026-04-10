import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "정돈할 텍스트 내용이 없습니다." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다. Supabase Dashboard에서 Secret을 확인하세요." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const prompt = `아래는 현장에서 거칠게 메모한 내용이야. 이를 거래처에 제출할 수 있는 격식 있고 전문적인 유지보수 보고서 문체로 다듬어줘. 핵심 정보는 누락하지 마.\n\n내용:\n${text}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return new Response(JSON.stringify({ error: `Gemini API 오류: ${data.error.message}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts?.[0]?.text) {
      return new Response(JSON.stringify({ error: "AI가 적절한 답변을 생성하지 못했습니다. (내용 부족 혹은 필터링)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const polishedText = data.candidates[0].content.parts[0].text.trim();

    return new Response(JSON.stringify({ polishedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `예외 발생: ${error.message}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
