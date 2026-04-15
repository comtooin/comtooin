import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as djwt from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';

// 메모리 캐싱
let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiry) {
    return cachedAccessToken;
  }

  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const privateKey = serviceAccount.private_key;
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
  if (!response.ok) throw new Error(`Google 인증 실패: ${data.error_description || data.error}`);
  
  cachedAccessToken = data.access_token;
  tokenExpiry = now + 3500; // 3600초 중 100초 여유
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

  try {
    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId') || ROOT_FOLDER_ID;

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) throw new Error('서버 환경 변수가 설정되지 않았습니다.');

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    // 필드 최소화 및 쿼리 최적화 (modifiedTime 추가)
    const driveParams = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, webViewLink, modifiedTime)',
      orderBy: 'folder,name',
      pageSize: '500', 
    });

    const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${driveParams.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const driveData = await driveResponse.json();
    if (!driveResponse.ok) throw new Error(`Drive API 오류: ${driveData.error?.message}`);

    return new Response(JSON.stringify({ 
      success: true, 
      files: driveData.files || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
