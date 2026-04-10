import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 시도할 모델 목록 (최신 순서)
const FALLBACK_MODELS = [
  Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 없습니다.");

    const prompt = `아래는 현장에서 거칠게 메모한 내용이야. 이를 거래처에 제출할 수 있는 격식 있고 전문적인 유지보수 보고서 문체로 다듬어줘. 핵심 정보는 누락하지 마.\n\n내용:\n${text}`;

    let lastError = "";
    
    // 사용 가능한 모델을 찾을 때까지 루프
    for (const modelName of FALLBACK_MODELS) {
      if (!modelName) continue;
      
      try {
        console.log(`Trying model: ${modelName}...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        const data = await response.json();

        // 모델이 없거나 지원되지 않는 경우 다음 모델로 넘어감
        if (data.error) {
          const msg = data.error.message;
          if (msg.includes("not found") || msg.includes("not supported") || msg.includes("404")) {
            console.warn(`Model ${modelName} failed, trying next... Error: ${msg}`);
            lastError = msg;
            continue; 
          }
          throw new Error(msg);
        }

        // 성공적으로 결과를 가져온 경우
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const polishedText = data.candidates[0].content.parts[0].text.trim();
          return new Response(JSON.stringify({ polishedText, usedModel: modelName }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        console.error(`Error with ${modelName}:`, err.message);
        lastError = err.message;
      }
    }

    throw new Error(`모든 AI 모델 시도 실패: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // 프론트엔드에서 메시지를 읽을 수 있도록 200으로 전송
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
