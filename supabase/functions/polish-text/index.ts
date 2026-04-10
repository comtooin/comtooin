import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 확인된 사용 가능 모델 목록 반영
const TRIALS = [
  "gemini-2.0-flash", 
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-pro-latest"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const { text } = await req.json().catch(() => ({}));
    const rawApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const GEMINI_API_KEY = rawApiKey.trim();
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    const prompt = `아래는 현장에서 거칠게 메모한 내용이야. 이를 거래처에 제출할 수 있는 격식 있고 전문적인 유지보수 보고서 문체로 다듬어줘. 핵심 정보는 누락하지 마.\n\n내용:\n${text}`;

    let lastError = "";

    for (const model of TRIALS) {
      try {
        console.log(`시도 중인 모델: ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        const data = await response.json();
        
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const polishedText = data.candidates[0].content.parts[0].text.trim();
          console.log(`성공! 모델: ${model}`);
          return new Response(JSON.stringify({ polishedText }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        lastError = data.error?.message || "응답 형식이 올바르지 않습니다.";
      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(`모든 최신 모델 시도 실패. 마지막 에러: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
