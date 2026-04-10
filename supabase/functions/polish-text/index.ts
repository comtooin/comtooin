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
    const { text } = await req.json().catch(() => ({}));
    const rawApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const GEMINI_API_KEY = rawApiKey.trim();
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

    // [진단 단계] 사용 가능한 모델 목록 조회
    const listResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );
    const listData = await listResponse.json();
    
    let availableModels = "";
    if (listData.models) {
      availableModels = listData.models.map((m: any) => m.name.replace("models/", "")).join(", ");
    } else {
      availableModels = "조회 실패: " + (listData.error?.message || "알 수 없는 오류");
    }

    if (!text) throw new Error(`텍스트가 없습니다. (사용 가능 모델: ${availableModels})`);

    // 우선 순위 모델 시도
    const TRIALS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    let lastError = "";

    for (const model of TRIALS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: `다듬어줘: ${text}` }] }] }),
          }
        );
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return new Response(JSON.stringify({ polishedText: data.candidates[0].content.parts[0].text.trim() }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        lastError = data.error?.message || "응답 없음";
      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(`모든 모델 실패. (사용 가능 모델: ${availableModels})\n마지막 에러: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
