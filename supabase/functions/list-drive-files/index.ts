import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as djwt from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';

async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const privateKey = serviceAccount.private_key;
  // 더 견고한 PEM 파싱: 헤더/푸터 및 모든 공백(줄바꿈 포함) 제거
  const pemContents = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await djwt.create({ alg: "RS256", typ: "JWT" }, claim, key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Google 인증 실패 상세:', data);
    throw new Error(`Google 인증 실패: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

  try {
    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId') || ROOT_FOLDER_ID;

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) throw new Error('서버 환경 변수(GOOGLE_SERVICE_ACCOUNT_JSON)가 설정되지 않았습니다.');

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 파싱 실패: 형식이 올바른 JSON인지 확인하세요.');
    }

    const accessToken = await getAccessToken(serviceAccount);

    const driveParams = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
      orderBy: 'folder,name',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });

    const driveUrl = `https://www.googleapis.com/drive/v3/files?${driveParams.toString()}`;
    const driveResponse = await fetch(driveUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const driveData = await driveResponse.json();
    
    // API 응답 상태 확인 추가 (핵심 오류 감지 지점)
    if (!driveResponse.ok) {
      console.error('Google Drive API 오류:', driveData);
      throw new Error(`Drive API 오류 (${driveResponse.status}): ${driveData.error?.message || JSON.stringify(driveData)}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      files: driveData.files || [],
      debug: {
        folderId,
        account: serviceAccount.client_email,
        resultCount: driveData.files?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Function error:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message, 
      success: false,
      debug: { timestamp: new Date().toISOString() } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
