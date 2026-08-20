import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-api-version, *',
  };

  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const type = payload.type; // "INSERT", "UPDATE" 등
    const table = payload.table; // "requests", "comments"
    const record = payload.record;
    const oldRecord = payload.old_record;
    
    if (!record) {
      return new Response(JSON.stringify({ error: "No record found in payload" }), { status: 400 });
    }

    // Supabase 클라이언트 초기화 (Service Role Key 사용)
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

    const getStatusLabel = (status: string) => {
      if (status === 'completed') return '처리완료';
      if (status === 'processing') return '처리중';
      if (status === 'pending') return '처리대기';
      if (status === 'cancelled') return '취소';
      return status;
    };

    let mailSubject = "";
    let htmlContent = "";
    let targetRecipientEmail = "";

    // A. requests 테이블 웹훅 처리
    if (table === "requests") {
      targetRecipientEmail = record.user_email || "";

      if (type === "INSERT") {
        mailSubject = `[COMTOOIN] 신규 업무 접수: ${record.customer_name}`;
        htmlContent = `
          <div style="font-family: 'Malgun Gothic', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
            <div style="background-color: #1e293b; padding: 28px 24px; color: #ffffff;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; display: block; margin-bottom: 4px;">COMTOOIN ITSM ALERTS</span>
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">신규 유지보수 내역 접수 알림</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">ITSM 플랫폼에 새로운 유지보수 접수 내역이 등록되었습니다.</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; width: 100px; font-weight: bold; color: #64748b;">거래처명</td><td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${record.customer_name}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">작성 직원</td><td style="padding: 12px 8px; color: #0f172a;">${record.user_name}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">고객 요청자</td><td style="padding: 12px 8px; color: #0f172a;">${record.requester_name || '미상'}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">등록 일시</td><td style="padding: 12px 8px; color: #0f172a;">${new Date(record.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">진행 상태</td><td style="padding: 12px 8px;"><span style="display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: bold; border-radius: 4px; background-color: #fff7ed; color: #d97706;">${getStatusLabel(record.status)}</span></td></tr>
              </table>
              <div style="margin-bottom: 32px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0f172a;">접수 내용</h4>
                <div style="white-space: pre-wrap; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; font-size: 13.5px; color: #334155; line-height: 1.6; min-height: 80px;">${record.content}</div>
              </div>
              <div style="text-align: center; margin-top: 10px;">
                <a href="${dashboardLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">대시보드 바로가기</a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">본 메일은 COMTOOIN ITSM 자동 알림 시스템에서 발송되었습니다.</div>
          </div>
        `;
      } 
      else if (type === "UPDATE") {
        // 상태가 변경되었을 때만 발송
        if (oldRecord && oldRecord.status === record.status) {
          return new Response(JSON.stringify({ message: "Status not changed, skipping email" }), { status: 200 });
        }

        mailSubject = `[COMTOOIN] 유지보수 진행상태 변경 안내: ${record.customer_name}`;
        htmlContent = `
          <div style="font-family: 'Malgun Gothic', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
            <div style="background-color: #0284c7; padding: 28px 24px; color: #ffffff;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #e0f2fe; display: block; margin-bottom: 4px;">COMTOOIN STATUS UPDATES</span>
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">유지보수 진행 상태 변경 알림</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">요청하신 기술지원 및 유지보수 건의 처리 진행 상태가 다음과 같이 변동되었습니다.</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; width: 120px; font-weight: bold; color: #64748b;">거래처명</td><td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${record.customer_name}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">고객 요청자</td><td style="padding: 12px 8px; color: #0f172a;">${record.requester_name || '미상'}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: bold; color: #64748b;">진행상태 변경</td>
                  <td style="padding: 12px 8px; color: #0f172a; font-weight: bold; font-size: 14px;">
                    <span style="color: #64748b; text-decoration: line-through; font-weight: normal;">${getStatusLabel(oldRecord?.status || "pending")}</span> 
                    <span style="color: #0284c7; margin: 0 8px;">➔</span> 
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: ${record.status === 'completed' ? '#ecfdf5' : '#fff7ed'}; color: ${record.status === 'completed' ? '#059669' : '#d97706'};">${getStatusLabel(record.status)}</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">업데이트 시간</td><td style="padding: 12px 8px; color: #0f172a;">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
              </table>
              <div style="margin-bottom: 32px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0f172a;">접수 내용 요약</h4>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; font-size: 13.5px; color: #475569; line-height: 1.6;">${record.content}</div>
              </div>
              <div style="text-align: center; margin-top: 10px;">
                <a href="${dashboardLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">진행상황 실시간 조회</a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">본 메일은 COMTOOIN ITSM 자동 알림 시스템에서 발송되었습니다.</div>
          </div>
        `;
      } else {
        return new Response(JSON.stringify({ message: "Unsupported requests action, skipping" }), { status: 200 });
      }
    } 
    // B. comments 테이블 웹훅 처리
    else if (table === "comments") {
      if (type !== "INSERT") {
        return new Response(JSON.stringify({ message: "Unsupported comments action, skipping" }), { status: 200 });
      }

      // 부모 requests 레코드 조회하여 접수자 이메일 파악
      const { data: parentRequest, error: parentError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', record.request_id)
        .single();

      if (parentError || !parentRequest) {
        console.error("Failed to fetch parent request:", parentError);
        return new Response(JSON.stringify({ error: "Failed to fetch parent request details" }), { status: 400 });
      }

      targetRecipientEmail = parentRequest.user_email || "";
      mailSubject = `[COMTOOIN] 유지보수 처리내용(코멘트) 등록 안내: ${parentRequest.customer_name}`;
      htmlContent = `
        <div style="font-family: 'Malgun Gothic', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
          <div style="background-color: #8b5cf6; padding: 28px 24px; color: #ffffff;">
            <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #f5f3ff; display: block; margin-bottom: 4px;">COMTOOIN COMMENTS</span>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">유지보수 처리 코멘트 등록 알림</h2>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">ITSM 담당 직원이 해당 기술지원 요청 건에 새로운 코멘트(조치 사항)를 등록하였습니다.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; width: 120px; font-weight: bold; color: #64748b;">거래처명</td><td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${parentRequest.customer_name}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">고객 요청자</td><td style="padding: 12px 8px; color: #0f172a;">${parentRequest.requester_name || '미상'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">등록 일시</td><td style="padding: 12px 8px; color: #0f172a;">${new Date(record.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
            </table>
            
            <div style="margin-bottom: 32px;">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #8b5cf6;">새로 등록된 처리 내용 (코멘트)</h4>
              <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; padding: 18px; border-radius: 8px; font-size: 13.5px; color: #581c87; line-height: 1.6; min-height: 60px;">${record.comment}</div>
            </div>
            
            <div style="text-align: center; margin-top: 10px;">
              <a href="${dashboardLink}" target="_blank" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.2);">상세 코멘트 답변 및 조회</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">본 메일은 COMTOOIN ITSM 자동 알림 시스템에서 발송되었습니다.</div>
        </div>
      `;
    }
    // C. chat_rooms 테이블 (비회원 1:1 대화방 개설 알림)
    else if (table === "chat_rooms") {
      const customerName = record.customer_name || record.name || "비회원 거래처";
      const guestName = record.guest_name || "비회원";
      const guestPhone = record.guest_phone || "미기입";
      const guestEmail = record.guest_email || "미기입";

      mailSubject = `[COMTOOIN] 1:1 기술지원 대화방 개설: ${customerName} (${guestName})`;
      const messengerLink = `${appUrl}/admin/messenger`;

      htmlContent = `
        <div style="font-family: 'Malgun Gothic', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
          <div style="background-color: #059669; padding: 28px 24px; color: #ffffff;">
            <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #a7f3d0; display: block; margin-bottom: 4px;">COMTOOIN LIVE MESSENGER</span>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">신규 1:1 기술지원 대화방 개설 알림</h2>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.5;">거래처 비회원 전용 1:1 기술지원 대화방이 새롭게 생성되었습니다.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; width: 120px; font-weight: bold; color: #64748b;">거래처명</td><td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${customerName}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">접수자(이름)</td><td style="padding: 12px 8px; color: #0f172a;">${guestName}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">연락처</td><td style="padding: 12px 8px; color: #0f172a;">${guestPhone}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">이메일</td><td style="padding: 12px 8px; color: #0f172a;">${guestEmail}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">개설 일시</td><td style="padding: 12px 8px; color: #0f172a;">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
            </table>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${messengerLink}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">1:1 메신저 대화방 바로가기</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">본 메일은 COMTOOIN ITSM 메신저 알림 시스템에서 자동 발송되었습니다.</div>
        </div>
      `;
    } else {
      return new Response(JSON.stringify({ message: "Unsupported table webhook, skipping" }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 메일 발송 수신처 리스트 구성 (BCC 대신 TO 직접 수신자로 통합하여 네이버/구글 스팸 차단 완치)
    const allRecipients = Array.from(new Set([
      gmailUser,
      targetRecipientEmail,
      ...emailAddresses
    ].map(e => (e || '').trim()).filter(Boolean)));

    const mailOptions = {
      from: `"COMTOOIN 알림" <${gmailUser}>`,
      to: allRecipients.join(', '),
      subject: mailSubject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
