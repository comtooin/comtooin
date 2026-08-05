import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
    if (!groqKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY 환경 변수가 설정되지 않았습니다." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Content-Type은 multipart/form-data여야 합니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const formData = await req.formData();
    const audioFile = formData.get("file") as File;
    const prompt = formData.get("prompt") as string || "컴투인, 유지보수, 접수내용, 처리내용, 요청자, 작성자, 컴퓨터, 프린터, 네트워크, 인터넷, 에러, 확인, 점검";

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "전송된 오디오 파일이 없습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Groq Whisper API 호출에 필요한 Form 준비
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile);
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("language", "ko");
    groqFormData.append("prompt", prompt);
    groqFormData.append("response_format", "json");

    const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
      },
      body: groqFormData,
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return new Response(JSON.stringify({ error: `Groq Whisper API 오류: ${errorText}` }), {
        status: groqResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await groqResponse.json();
    return new Response(JSON.stringify({ text: result.text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
