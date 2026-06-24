import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 확인된 사용 가능 모델 목록 반영
const TRIALS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

try {
    const { text, type } = await req.json().catch(() => ({}));
    const rawApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const GEMINI_API_KEY = rawApiKey.trim();
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    let prompt = "";

    // [수정된 로직]: type에 따라 명확하게 프롬프트를 분기합니다.
    if (type === 'processingContent') {
      // 처리내용용 (엔지니어 문체)
      prompt = `명령: 아래 메모를 IT 엔지니어의 처리 결과 형식으로 요약하라.
      - 소제목(라벨)은 절대 쓰지 말 것.
      - 문장 앞에 아무런 기호를 넣지 말 것.
      - '~완료함', '~조치함', '~확인함'으로 끝낼 것.
      - 인사말이나 불필요한 설명은 금지함.
      메모: ${text}`;
    } else {
      // 접수내용용 (객관적 접수 문체)
      prompt = `명령: 아래 메모를 IT 장애 접수 요약 형식으로 정리하라.
      - 소제목(라벨)은 절대 쓰지 말 것.
      - 문장 앞에 아무런 기호를 넣지 말 것.
      - '~요청함', '~불량임', '~문의함'으로 끝낼 것.
      - 인사말이나 불필요한 설명은 금지함.
      메모: ${text}`;
    }

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
