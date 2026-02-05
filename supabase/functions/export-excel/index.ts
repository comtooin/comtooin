import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

/**
 * CSV 생성 및 데이터 가공 함수
 */
function generateCsv(data: any[]): string {
  if (!data || data.length === 0) return "No Data";

  const columnMapping: { [key: string]: string } = {
    "id": "접수번호",
    "created_at": "접수일시",
    "customer_name": "고객사명",
    "user_name": "요청자",
    "status": "처리상태",
    "content": "문의내용",
    "reply_content": "처리내용"
  };

  const statusMapping: { [key: string]: string } = {
    "pending": "접수완료",
    "processing": "처리중",
    "completed": "수리완료",
    "cancelled": "취소됨"
  };

  const keys = Object.keys(columnMapping);
  const headers = keys.map(k => columnMapping[k]).join(',');

  const rows = data.map(row => keys.map(k => {
    let val = row[k];

    // [가공 1] 상태값 한글 변환
    if (k === 'status' && val) {
      val = statusMapping[val] || val;
    }

    // [가공 2] HTML 태그 제거 및 공백 정리
    if ((k === 'content' || k === 'reply_content') && val) {
      val = String(val).replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    }

    // [가공 3] ⭐ 날짜 형식 한글화 (2026년 02월 05일)
    if (k === 'created_at' && val) {
      const date = new Date(val);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      val = `${yyyy}년 ${mm}월 ${dd}일`;
    }

    const str = String(val ?? "");
    return str.includes(',') || str.includes('"') || str.includes('\n') 
      ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(','));

  return [headers, ...rows].join('\n');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { customerName, month, status } = await req.json();

    const { data, error } = await supabaseAdmin.rpc('get_admin_report_data', {
      _customer_name: customerName || 'all',
      _month: month || 'all',
      _status: status || 'all'
    });

    if (error) throw error;

    const csv = "\uFEFF" + generateCsv(data);

    // 파일명 생성 로직
    const today = new Date().toISOString().split('T')[0];
    const safeCustomerName = (!customerName || customerName === 'all') ? '전체고객사' : customerName;
    const safeMonth = (!month || month === 'all') ? '전체기간' : month;
    const fileName = `컴투인_기술지원리포트_${safeCustomerName}_${safeMonth}.csv`;
    console.log("Generated fileName:", fileName);

    return new Response(csv, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/csv;charset=utf-8;", 
        "Content-Disposition": `attachment; filename=${encodeURIComponent(fileName)}`
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});