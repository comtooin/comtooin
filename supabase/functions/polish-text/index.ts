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

    const prompt = `당신은 유지보수 전문가입니다. 아래 메모를 바탕으로 고객용 보고서를 작성하세요. 
    단, 다음 규칙을 엄격히 준수하세요:
    1. 미사여구는 모두 빼고 '개조식(* 또는 - 사용)'으로 작성할 것.
    2. 문장은 '~함', '~임'으로 끝나는 명사형 종결 어미를 사용할 것.
    3. 전체 분량은 3~5줄 내외로 아주 간결하게 정리할 것.
    4. 불필요한 서론(예: '요청하신 내용을 정리했습니다')은 절대 넣지 말 것.

    내용:
    ${text}`;

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
