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
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
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

    let prompt = "";

    // 🌟 추가된 로직: 프론트엔드에서 보낸 인벤토리 분석 프롬프트를 그대로 사용
    if (action === 'inventory_preview') {
      if (!reportContent) throw new Error("자산 현황 데이터가 전달되지 않았습니다.");
      prompt = reportContent;
    } 
    // 기존 유지보수 리포트 분석 로직
    else {
      const { data: reportData, error: dbError } = await supabaseAdmin.rpc('get_admin_report_data', {
        _customer_name: customerName || 'all',
        _month: month || 'all',
        _status: status || 'all'
      });

      if (dbError) throw dbError;
      if (!reportData || reportData.length === 0) throw new Error("분석할 업무 데이터가 없습니다.");

      const dataSummary = reportData.map((row: any) => {
        const date = new Date(row.created_at).toLocaleDateString('ko-KR');
        const content = String(row.content || "").replace(/<[^>]*>?/gm, '').trim();
        const reply = String(row.reply_content || "").replace(/<[^>]*>?/gm, '').trim();
        const requester = row.requester_name || "담당자";
        return `[${date}] 거래처:${row.customer_name} / 요청자:${requester} / 접수:${content} / 처리:${reply}`;
      }).join('\n');

      prompt = `# 역할: 전문 IT 인프라 유지보수 컨설턴트 및 PC 정비 전문가

# 배경: 
제공된 [업무 기록 데이터]는 특정 거래처에서 발생한 PC 유지보수 및 네트워크 장애 처리 기록이다. 
이 데이터를 분석하여 해당 거래처 담당자에게 전달할 '월간 IT 인프라 점검 및 장애 예방 리포트'를 작성하라.

# 리포트 상단 정보 (반드시 포함):
- **수신:** [거래처명] IT담당자님
- **발신:** 컴투인 IT 인프라 유지보수 서비스팀

# 리포트 구성 및 시인성 강화 지침:
1. 출력은 마크다운이 아닌 반드시 **HTML 형식**으로만 작성해주세요. <html> 이나 <body> 태그는 포함하지 말고 <h1>, <h2>, <p>, <ul>, <li>, <table>, <tr>, <th>, <td>, <span> 등 내용 태그만 사용하세요.
2. 각 세션 사이에 구분선(<hr style="border:0;border-top:1px solid #eee;margin:20px 0;"/>) 또는 스타일링을 지정하여 세련되게 분리하세요. 주 컬러는 보라색(#673ab7)을 사용하세요.
3. 데이터 시각화 (막대그래프):
   장애 유형 분포 및 발생 빈도는 반드시 아래와 같은 가로 막대 그래프 형식의 HTML/CSS 코드를 출력에 활용하여 시각화해주세요:
   <div style="margin-bottom:10px;"><span style="display:inline-block;width:150px;font-size:13px;">[장애유형] ([비율]%)</span><span style="display:inline-block;vertical-align:middle;width:200px;height:12px;background:#e0e0e0;border-radius:6px;margin-right:8px;overflow:hidden;"><span style="display:block;width:[비율]%;height:100%;background:#673ab7;border-radius:6px;"></span></span> <strong>[건수]건</strong></div>
4. 하드웨어 상태 등급 및 처리 조치 표:
   장비 현황이나 장애 조치 목록은 반드시 깔끔한 테두리와 배경색이 적용된 HTML <table> 구조를 사용하여 작성하십시오.
   예: <table style="width:100%;border-collapse:collapse;margin:15px 0;"><tr style="background:#673ab7;color:white;"><th style="border:1px solid #ddd;padding:8px;text-align:center;">항목</th>...</tr>...</table>
5. **주제별 A4 1페이지 분량 풍성화 규칙**:
   리포트의 4가지 주요 카테고리(1, 2, 3, 4)는 각각 인쇄 시 A4 용지 1페이지에 배치되므로, 각 항목 아래의 텍스트와 표 내용을 매우 상세하게 서술식 단락과 목록으로 풍부하게 채워주십시오. 요약형 문장은 지양하고, 구체적인 분석 의견, 관련 부서 분석, 장비 목록 표, 향후 대책 등을 대량으로 추가하여 각 페이지가 시각적으로 빈 공간 없이 알차게 가득 차도록(최소 10~15줄 이상의 텍스트 및 상세 표) 작성해 주십시오.
6. **페이지 구분**: 2번 카테고리부터 각 대분류(h2)가 시작되기 직전에 반드시 <div class="page-break"></div> 태그를 삽입해 주십시오. (1번 카테고리 시작 직전에는 절대 삽입하지 마십시오.)
7. **고객 연락처 문구 절대 제외**:
   리포트 가장 끝단에 '기술지원문의: 15XX-XXXX', '전화번호', '서비스 데스크 연락처', 또는 '컴투인 IT 인프라 유지보수 서비스팀 ☎ (문의: 1544-XXXX)' 같은 문구는 **절대 포함하지 마십시오**. 리포트는 4번 항목의 보안 가이드 분석 내용으로만 끝맺어야 합니다.

# 리포트 상세 항목:
1. 금월 핵심 요약 (Key Summary): 이번 달 발생한 중요 조치 사항들에 대한 심층 요약 분석 (1페이지를 가득 채울 수 있도록 점검 실적, 개별 개선 사항 및 인프라 전반의 총평을 단락 형태로 상세히 서술)
2. 주요 장애 현황 요약: 발생 빈도 그래프 시각화 및 세부 장애 원인 분석 (어떤 부서에서 어떤 유형의 장애가 다발했는지, 그로 인한 기회비용 및 재발 방지책을 아주 상세하게 분석)
3. 하드웨어 노후화 및 교체 제언: 반복 고장 장비 선별, 교체 권고 사항 및 장비 목록 테이블 (노후화된 PC나 부품을 구체적으로 지목하고, 향후 예산 편성을 위한 교체 로드맵 제언)
4. 보안 취약점 진단 및 예방 가이드: 보안 등급 평가, 구체적인 위협 요인 진단 및 원내 임직원 행동 가이드 (백신 실시간 검사 활성화, 비밀번호 복잡도 설정, 비인가 공유기 단속 등 구체적인 실천 수칙 명시)

# 작성 원칙:
- 톤앤매너: 정중하고 절제된 비즈니스 문체 사용 (~확인되었습니다, ~제언드립니다).
- 가독성: 인라인 CSS 스타일을 활용해 굵은 글씨, 폰트 색상을 지정해 가시성을 극대화할 것.

# [업무 기록 데이터]
${dataSummary}`;
    }

    let errors: string[] = [];
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
        
        errors.push(`[${model}] ${aiData.error?.message || "응답 내용 없음"}`);
      } catch (err: any) {
        errors.push(`[${model}] ${err.message}`);
      }
    }

    throw new Error(`AI 생성 실패 원인 파악 내역:\n${errors.join('\n')}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
