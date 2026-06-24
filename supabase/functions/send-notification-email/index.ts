import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      } 
    });
  }

  try {
    const payload = await req.json();
    
    // Webhook에서 전달되는 payload 형태: { type: "INSERT", table: "requests", record: { ... } }
    const record = payload.record;
    
    if (!record) {
      return new Response(JSON.stringify({ error: "No record found in payload" }), { status: 400 });
    }

    // 직원 이메일 목록 조회를 위한 Supabase 클라이언트 초기화 (Service Role Key 사용)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // staff 테이블에서 이메일 목록 가져오기
    const { data: staffList, error: fetchError } = await supabase
      .from('staff')
      .select('email')
      .not('email', 'is', null);
    
    if (fetchError) {
      console.error("Failed to fetch staff:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch staff list" }), { status: 500 });
    }

    const emailAddresses = staffList.map((s: any) => s.email).filter(Boolean);

    if (emailAddresses.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients found" }), { status: 200 });
    }

    // Gmail SMTP 연결 설정
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_PASS");

    if (!gmailUser || !gmailPass) {
       console.error("Gmail credentials missing");
       return new Response(JSON.stringify({ error: "Gmail credentials missing" }), { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // 메일 내용(HTML) 구성
    const htmlContent = `
      <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #607d8b; padding: 20px; color: white;">
          <h2 style="margin: 0; font-size: 20px;">새로운 업무기록이 등록되었습니다.</h2>
        </div>
        <div style="padding: 24px;">
          <p><strong>거래처:</strong> ${record.customer_name}</p>
          <p><strong>작성자:</strong> ${record.user_name}</p>
          <p><strong>요청자:</strong> ${record.requester_name || '미상'}</p>
          <p><strong>등록일:</strong> ${new Date(record.created_at).toLocaleString('ko-KR')}</p>
          <p><strong>상태:</strong> <span style="color: ${record.status === 'completed' ? '#2e7d32' : '#f57c00'}; font-weight: bold;">${record.status === 'completed' ? '처리완료' : '처리중'}</span></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p><strong>접수 내용:</strong></p>
          <div style="white-space: pre-wrap; background-color: #f5f5f5; padding: 15px; border-radius: 4px; line-height: 1.6;">${record.content}</div>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; color: #888; font-size: 12px;">
          이 메일은 COMTOOIN 관리 시스템에서 자동 발송되었습니다.
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"COMTOOIN 알림" <${gmailUser}>`,
      to: gmailUser, // To에는 발신자 본인을 넣고,
      bcc: emailAddresses.join(', '), // Bcc(숨은참조)에 직원 전체를 넣어서 개인정보 보호
      subject: `[COMTOOIN] 신규 업무 접수: ${record.customer_name}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
