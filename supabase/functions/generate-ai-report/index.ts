import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';
const TARGET_FOLDER_NAME = '3. 거래처별 AI분석 리포트';

const TRIALS = [
  "gemini-2.0-flash", 
  "gemini-flash-latest",
  "gemini-pro-latest"
];

async function getGoogleAccessToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth 환경 변수가 설정되지 않았습니다.');
  }

  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams();
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);
  body.append('refresh_token', refreshToken);
  body.append('grant_type', 'refresh_token');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`구글 인증 실패: ${data.error_description || data.error}`);
  return data.access_token;
}

async function getOrCreateFolder(accessToken: string, folderName: string, parentId: string) {
  const query = `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchResponse.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const createData = await createResponse.json();
  return createData.id;
}

async function uploadToDrive(accessToken: string, folderId: string, fileName: string, content: string) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/vnd.google-apps.document',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`파일 업로드 실패: ${data.error?.message || '알 수 없는 오류'}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { customerName, month, status, action, content: reportContent } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();

    if (action === 'save') {
      if (!reportContent) throw new Error("저장할 리포트 내용이 없습니다.");
      const accessToken = await getGoogleAccessToken();
      const folderId = await getOrCreateFolder(accessToken, TARGET_FOLDER_NAME, ROOT_FOLDER_ID);
      const fileName = `AI_분석_리포트_${customerName}_${month || '전체'}_${new Date().toISOString().split('T')[0]}`;
      const result = await uploadToDrive(accessToken, folderId, fileName, reportContent);
      
      return new Response(JSON.stringify({ success: true, fileId: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

    const { data: reportData, error: dbError } = await supabaseAdmin.rpc('get_admin_report_data', {
      _customer_name: customerName || 'all',
      _month: month || 'all',
      _status: status || 'all'
    });

    if (dbError) throw dbError;
    if (!reportData || reportData.length === 0) throw new Error("분석할 업무 데이터가 없습니다.");

    // 데이터 요약 구성 (요청자 requester_name 강조)
    const dataSummary = reportData.map((row: any) => {
      const date = new Date(row.created_at).toLocaleDateString('ko-KR');
      const content = String(row.content || "").replace(/<[^>]*>?/gm, '').trim();
      const reply = String(row.reply_content || "").replace(/<[^>]*>?/gm, '').trim();
      const requester = row.requester_name || "담당자";
      return `[${date}] 거래처:${row.customer_name} / 요청자:${requester} / 접수:${content} / 처리:${reply}`;
    }).join('\n');

    const prompt = `# 역할: 전문 IT 인프라 유지보수 컨설턴트 및 PC 정비 전문가

# 배경: 
제공된 [업무 기록 데이터]는 특정 거래처에서 발생한 PC 유지보수 및 네트워크 장애 처리 기록이다. 
이 데이터를 분석하여 해당 거래처 담당자에게 전달할 '월간 IT 인프라 점검 및 장애 예방 리포트'를 작성하라.

# 리포트 상단 정보 (반드시 포함):
- **수신:** [거래처명] [데이터에서 확인된 가장 빈번한 요청자명] 담당자님
- **발신:** 컴투인 IT 인프라 유지보수 서비스팀

# 리포트 구성 항목:
1. 주요 장애 현황 요약: 한 달간 발생한 주요 장애 유형(하드웨어, 소프트웨어, 네트워크 등)을 분류하고 빈도수를 분석한다.
2. 하드웨어 노후화 및 교체 제언: 특정 부품(파워서플라이, SSD, RAM 등)의 반복적인 고장이 발견될 경우, 장비 노후화 진단 및 선제적 교체 필요성을 언급한다.
3. 보안 취약점 진단: OS 업데이트 미비, 백신 미작동, 악성코드 감염 기록 등을 바탕으로 현재 보안 상태를 경고한다.
4. 장애 예방을 위한 가이드: 거래처 직원들이 현장에서 실천할 수 있는 PC 관리 팁(예: 멀티탭 과부하 방지, 비인가 프로그램 설치 자제 등)을 제공한다.

# 작성 원칙:
- 톤앤매너: 정중하고 신뢰감 있는 비즈니스 문체 (예: "확인되었습니다", "제언드립니다").
- 보안 주의: 개인정보나 민감한 내부 명칭은 노출하지 않고 현상 중심으로 서술한다.
- 가독성: 불렛 포인트와 명확한 소제목을 사용하여 한눈에 들어오게 작성한다.

# [업무 기록 데이터]
${dataSummary}`;

    let lastError = "";
    for (const model of TRIALS) {
      try {
        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        const aiData = await aiResponse.json();
        const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          return new Response(JSON.stringify({ report: generatedText }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        lastError = aiData.error?.message || "알 수 없는 오류";
      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(`모든 AI 모델 시도 실패. 마지막 에러: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
