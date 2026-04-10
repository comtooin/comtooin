import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 더 넓은 범위의 후보군 시도
const TRIALS = [
  { version: "v1", model: "gemini-1.5-flash" },
  { version: "v1beta", model: "gemini-1.5-flash" },
  { version: "v1", model: "gemini-1.5-pro" },
  { version: "v1", model: "gemini-pro" },
  { version: "v1beta", model: "gemini-pro" },
  { version: "v1", model: "gemini-1.0-pro" }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    // API 키 가져오기 및 공백 제거
    const rawApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const GEMINI_API_KEY = rawApiKey.trim();
    
    if (!GEMINI_API_KEY) {
      throw new Error("서버에 GEMINI_API_KEY가 설정되지 않았습니다. Supabase Dashboard의 Secrets를 확인해주세요.");
    }

    const prompt = `아래는 현장에서 거칠게 메모한 내용이야. 이를 거래처에 제출할 수 있는 격식 있고 전문적인 유지보수 보고서 문체로 다듬어줘. 핵심 정보는 누락하지 마.\n\n내용:\n${text}`;

    const errorReports: string[] = [];
    
    for (const trial of TRIALS) {
      try {
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
          const msg = `${trial.version}/${trial.model}: ${data.error.message}`;
          errorReports.push(msg);
          console.warn(`실패 보고: ${msg}`);
          continue; 
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const polishedText = data.candidates[0].content.parts[0].text.trim();
          return new Response(JSON.stringify({ polishedText, usedModel: trial.model }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        errorReports.push(`${trial.model} 통신오류: ${err.message}`);
      }
    }

    // 모든 시도 실패 시 상세 보고
    throw new Error(`모든 모델 호출 실패. 상세 내역:\n${errorReports.join("\n")}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // 프론트엔드에서 메시지를 바로 보여주기 위해 200 사용
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
