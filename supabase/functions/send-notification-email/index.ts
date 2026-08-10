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

    // staff 테이블에서 관리자(admin)를 제외한 이메일 목록 가져오기
    const { data: staffList, error: fetchError } = await supabase
      .from('staff')
      .select('email')
      .not('email', 'is', null)
      .neq('role', 'admin');
    
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

    const appUrl = Deno.env.get("APP_URL") || "https://comtooin.vercel.app";
    const dashboardLink = `${appUrl}/admin/dashboard`;

    // 메일 내용(HTML) 구성
    const htmlContent = `
      <div style="font-family: 'Malgun Gothic', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #1e293b; padding: 28px 24px; color: #ffffff;">
          <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; display: block; margin-bottom: 4px;">COMTOOIN ITSM ALERTS</span>
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">신규 유지보수 내역 접수 알림</h2>
        </div>
        
        <!-- Content Body -->
        <div style="padding: 32px 24px;">
          <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">ITSM 플랫폼에 새로운 유지보수 접수 내역이 등록되었습니다. 담당자분들께서는 아래 상세 조치 사항을 확인 후 후속 업무를 진행해 주시기 바랍니다.</p>
          
          <!-- Info Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 8px; width: 100px; font-weight: bold; color: #64748b;">거래처명</td>
              <td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${record.customer_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 8px; font-weight: bold; color: #64748b;">작성 직원</td>
              <td style="padding: 12px 8px; color: #0f172a;">${record.user_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 8px; font-weight: bold; color: #64748b;">고객 요청자</td>
              <td style="padding: 12px 8px; color: #0f172a;">${record.requester_name || '미상'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 8px; font-weight: bold; color: #64748b;">등록 일시</td>
              <td style="padding: 12px 8px; color: #0f172a;">${new Date(record.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 8px; font-weight: bold; color: #64748b;">진행 상태</td>
              <td style="padding: 12px 8px;">
                <span style="display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: bold; border-radius: 4px; background-color: ${record.status === 'completed' ? '#ecfdf5' : '#fff7ed'}; color: ${record.status === 'completed' ? '#059669' : '#d97706'};">
                  ${record.status === 'completed' ? '처리완료' : '처리대기'}
                </span>
              </td>
            </tr>
          </table>
          
          <!-- Work Content Box -->
          <div style="margin-bottom: 32px;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0f172a;">접수 내용</h4>
            <div style="white-space: pre-wrap; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; font-size: 13.5px; color: #334155; line-height: 1.6; min-height: 80px;">${record.content}</div>
          </div>
          
          <!-- Action Button -->
          <div style="text-align: center; margin-top: 10px;">
            <a href="${dashboardLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2); transition: background-color 0.2s;">
              대시보드 바로가기
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">
          본 메일은 COMTOOIN ITSM 자동 알림 시스템에서 발송되었습니다.<br>
          이메일 수신 관련 설정은 관리 서비스 내 직원 정보 관리 탭에서 변경할 수 있습니다.
        </div>
      </div>
    `;

    // 접수자 이메일(record.user_email)이 기재된 경우 수신인(to)에 추가하여 접수 확인 이메일 자동 발송
    const toRecipients = [gmailUser];
    if (record.user_email && record.user_email.trim() !== '') {
      toRecipients.push(record.user_email.trim());
    }

    const mailOptions = {
      from: `"COMTOOIN 알림" <${gmailUser}>`,
      to: toRecipients.join(', '),
      bcc: emailAddresses.join(', '), // Bcc(숨은참조)에 직원 전체를 넣어 개인정보 보호
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
