import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { customerName, month, status } = await req.json();

    const { data: reportData, error: rpcError } = await supabaseAdmin.rpc('get_admin_report_data', {
      _customer_name: customerName,
      _month: month,
      _status: status
    });

    if (rpcError) throw rpcError;

    // CSV 생성 및 한글 깨짐 방지 BOM 추가
    const headers = Object.keys(reportData[0] || {}).join(',');
    const rows = reportData.map((row: any) => Object.values(row).join(',')).join('\n');
    const csvContent = "\uFEFF" + [headers, rows].join('\n');

    return new Response(csvContent, {
      headers: { ...corsHeaders, 'Content-Type': 'text/csv;charset=utf-8' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});