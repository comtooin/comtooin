import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROOT_FOLDER_ID = '1YV2vEIhNU0rPSiyHUgyDV0pSuBcuOKfJ';
const TARGET_FOLDER_NAME = '4. 첨부이미지모음';

let cachedFolderId: string | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

async function getGoogleAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiry) return cachedAccessToken;

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000;
  return data.access_token;
}

async function getOrCreateFolder(accessToken: string) {
  if (cachedFolderId) return cachedFolderId;

  const query = `name = '${TARGET_FOLDER_NAME}' and '${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchResponse.json();
  
  if (searchData.files?.length > 0) {
    cachedFolderId = searchData.files[0].id;
    return cachedFolderId;
  }

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: TARGET_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [ROOT_FOLDER_ID] }),
  });
  const createData = await createResponse.json();
  
  await fetch(`https://www.googleapis.com/drive/v3/files/${createData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'viewer', type: 'anyone' }),
  });

  cachedFolderId = createData.id;
  return cachedFolderId;
}

async function uploadSingleFile(accessToken: string, folderId: string, file: File, customerName: string, userName: string) {
  const now = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const dateStr = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}${String(now.getUTCMilliseconds()).padStart(3, '0')}`;
  const fileName = `${customerName}_${userName}_${dateStr}_${timeStr}.jpg`;

  const metadata = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const data = await response.json();
  return data.webViewLink;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const customerName = formData.get("customerName")?.toString() || "unknown";
    const userName = formData.get("userName")?.toString() || "unknown";

    if (!files.length) throw new Error("파일이 없습니다.");

    const accessToken = await getGoogleAccessToken();
    const folderId = await getOrCreateFolder(accessToken);

    // 구글 드라이브로 병렬 업로드 실행
    const uploadPromises = files.map(file => uploadSingleFile(accessToken, folderId, file, customerName, userName));
    const urls = await Promise.all(uploadPromises);

    return new Response(JSON.stringify({ success: true, urls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
