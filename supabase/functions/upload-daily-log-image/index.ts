import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';
const TARGET_FOLDER_NAME = '4. 첨부이미지모음';

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

async function makeFilePublic(accessToken: string, fileId: string) {
  const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const response = await fetch(permissionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'viewer',
      type: 'anyone',
    }),
  });
  if (!response.ok) {
    const data = await response.json();
    console.error('Permission update failed:', data);
  }
}

async function uploadToDrive(accessToken: string, folderId: string, fileName: string, fileContent: Uint8Array, mimeType: string) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileContent], { type: mimeType }));

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`파일 업로드 실패: ${data.error?.message || '알 수 없는 오류'}`);
  return data;
}

function generateFileName(customerName: string, userName: string) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;
  
  // 파일명이 겹칠 수 있으므로 고유성을 위해 초 단위 시간과 랜덤 값을 살짝 추가하는 것이 좋지만,
  // 요청하신 형식에 맞춰 기본 생성하고 중복 방지를 위해 시간을 살짝 붙입니다.
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `${customerName}_${userName}_${dateStr}_${timeStr}.jpg`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Uint8Array;
    let mimeType = "image/jpeg";
    let customerName = "unknown";
    let userName = "unknown";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      customerName = formData.get("customerName")?.toString() || "unknown";
      userName = formData.get("userName")?.toString() || "unknown";

      if (!file || !(file instanceof File)) throw new Error("파일이 업로드되지 않았습니다.");
      if (file.size > 5 * 1024 * 1024) throw new Error("파일 용량이 5MB를 초과합니다.");
      fileBuffer = new Uint8Array(await file.arrayBuffer());
      mimeType = file.type || "image/jpeg";
    } else if (contentType.includes("application/json")) {
      const json = await req.json();
      const { file } = json;
      customerName = json.customerName || "unknown";
      userName = json.userName || "unknown";

      if (!file) throw new Error("이미지 데이터(base64)가 없습니다.");
      const base64Data = file.includes(",") ? file.split(",")[1] : file;
      const binaryString = atob(base64Data);
      fileBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileBuffer[i] = binaryString.charCodeAt(i);
      }
    } else {
      throw new Error("지원하지 않는 Content-Type입니다.");
    }

    const accessToken = await getGoogleAccessToken();
    const folderId = await getOrCreateFolder(accessToken, TARGET_FOLDER_NAME, ROOT_FOLDER_ID);
    const fileName = generateFileName(customerName, userName);
    
    const result = await uploadToDrive(accessToken, folderId, fileName, fileBuffer, mimeType);
    await makeFilePublic(accessToken, result.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.id, 
      webViewLink: result.webViewLink 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
