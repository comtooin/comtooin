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
    const { text, type } = await req.json().catch(() => ({}));
    const rawApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const GEMINI_API_KEY = rawApiKey.trim();
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    if (!text) throw new Error("텍스트 내용이 없습니다.");

    let prompt = "";
    if (type === 'processingContent') {
      // 처리내용용 프롬프트
      prompt = `당신은 IT 서비스 엔지니어입니다. 아래 현장 조치 메모를 바탕으로 '전문적인 처리 결과 보고서'를 작성하세요.

  [준수 규칙]
  1. 기호 통일: 모든 항목은 - 기호로 시작할 것.
  2. 문체 통일: '~완료', '~조치함', '~교체함' 등 명확한 엔지니어 문체를 사용할 것.
  3. 구조화:
     - 핵심 조치 내용 (예: 모니터 메인보드 교체 완료)
     - 상세 작업 단계 (예: 원인 파악, 부품 교체, 테스트 진행)
     - 최종 상태 확인 (예: 정상 작동 확인 완료)
  4. 금지 사항: 인사말 금지, 불필요한 서술 금지.
  5. 분량: 150자 이내.

  현장 메모:
  ${text}`;
    } else {
      // 접수내용용 프롬프트 (기존과 유사하게 유지하되 접수 중심)
      prompt = `당신은 IT 접수 담당자입니다. 아래 고객 요청 사항을 바탕으로 '정갈한 업무 접수서'를 작성하세요.

  [준수 규칙]
  1. 기호 통일: 모든 항목은 - 기호로 시작할 것.
  2. 문체 통일: '~요청함', '~문의함', '~불량임' 등 현상을 객관적으로 기록하는 문체를 사용할 것.
  3. 구조화:
     - 핵심 요청 요약
     - 증상 상세 내용
     - 방문 또는 조치 희망 사항
  4. 금지 사항: 인사말 금지, 부연 설명 금지.
  5. 분량: 150자 이내.

  요청 내용:
  ${text}`;
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
