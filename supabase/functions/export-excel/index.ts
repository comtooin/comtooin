import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function generateCsv(data: any[]): string {
  if (!data || data.length === 0) return "데이터가 없습니다.";

  const columnMapping: { [key: string]: string } = {
    "id": "ID",
    "created_at": "업무일시",
    "customer_name": "거래처명",
    "requester_name": "요청자", // [추가] 요청자 컬럼 매핑
    "user_name": "작성자",
    "status": "상태",
    "content": "접수내용",
    "reply_content": "처리내용"
  };

  const statusMapping: { [key: string]: string } = {
    "pending": "처리중",
    "processing": "처리중",
    "completed": "처리완료",
    "cancelled": "취소"
  };

  const keys = Object.keys(columnMapping);
  const headers = keys.map(k => columnMapping[k]).join(',');

  const rows = data.map(row => keys.map(k => {
    let val = row[k];
    if (k === 'status' && val) val = statusMapping[val] || val;
    if ((k === 'content' || k === 'reply_content') && val) val = String(val).replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    if (k === 'created_at' && val) {
      const date = new Date(val);
      val = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    const str = String(val ?? "");
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
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
    const safeCustomerName = (!customerName || customerName === 'all') ? '전체거래처' : customerName;
    const safeMonth = (!month || month === 'all') ? '전체기간' : month;
    const fileName = `컴투인_유지보수_리포트_${safeCustomerName}_${safeMonth}.csv`;
    return new Response(csv, {
      headers: { ...corsHeaders, "Content-Type": "text/csv;charset=utf-8;", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
