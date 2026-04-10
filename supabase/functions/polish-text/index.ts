import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 시도할 조합 목록 (버전과 모델명)
const TRIALS = [
  { version: "v1", model: "gemini-1.5-flash" },
  { version: "v1beta", model: "gemini-1.5-flash" },
  { version: "v1", model: "gemini-1.5-pro" },
  { version: "v1", model: "gemini-1.0-pro" },
  { version: "v1beta", model: "gemini-pro" }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("서버에 GEMINI_API_KEY가 설정되지 않았습니다.");

    const prompt = `아래는 현장에서 거칠게 메모한 내용이야. 이를 거래처에 제출할 수 있는 격식 있고 전문적인 유지보수 보고서 문체로 다듬어줘. 핵심 정보는 누락하지 마.\n\n내용:\n${text}`;

    let lastError = "";
    
    for (const trial of TRIALS) {
      try {
        console.log(`시도 중: API ${trial.version}, 모델 ${trial.model}`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${trial.version}/models/${trial.model}:generateContent?key=${GEMINI_API_KEY}`,
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
          lastError = `${trial.version}/${trial.model}: ${data.error.message}`;
          console.warn(`실패: ${lastError}`);
          continue; 
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const polishedText = data.candidates[0].content.parts[0].text.trim();
          console.log(`성공! 사용된 모델: ${trial.model} (${trial.version})`);
          return new Response(JSON.stringify({ polishedText, usedModel: trial.model }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        lastError = err.message;
        console.error(`통신 오류 (${trial.model}):`, err.message);
      }
    }

    throw new Error(`모든 AI 모델 호출에 실패했습니다. 마지막 오류: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
