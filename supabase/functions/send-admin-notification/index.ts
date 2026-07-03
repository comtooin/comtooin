import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";



/**
 * 2. 이메일 발송 함수
 */
async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "maintenance@resend.dev", 
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "이메일 발송 실패");
  return data;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    
    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ message: "Skip: Not an insert event" }), { status: 200 });
    }

    const record = payload.record;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    
    const tasks = [];



    if (RESEND_KEY && ADMIN_EMAIL) {
      const statusLabel = record.status === 'completed' ? '[처리완료]' : '[처리중]';
      const adminSubject = `${statusLabel} 유지보수 기록: ${record.customer_name || '미확인'}`;
      const adminHtml = `
        <div style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; max-width: 600px; border: 1px solid #ddd; padding: 25px; border-radius: 8px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">🛠 유지보수 업무 기록 알림</h2>
          <p>데이터베이스에 새로운 업무 내역이 등록되었습니다.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="width: 100px; font-weight: bold; padding: 8px; border-bottom: 1px solid #eee;">거래처</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.customer_name || '미확인'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 8px; border-bottom: 1px solid #eee;">요청자</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.requester_name || '미기입'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 8px; border-bottom: 1px solid #eee;">작성자</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.user_name || '미확인'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 8px; border-bottom: 1px solid #eee;">상태</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.status === 'completed' ? '처리완료' : '처리중'}</td>
            </tr>
          </table>
          <div style="margin-top: 20px;">
            <p style="font-weight: bold; color: #2c3e50;">[접수 내용]</p>
            <div style="background: #fdfdfd; border: 1px solid #eee; padding: 15px; border-radius: 5px; min-height: 100px;">
              ${record.content || '내용 없음'}
            </div>
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="https://comtooin.vercel.app/admin/dashboard" 
               style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               대시보드에서 상세 확인
            </a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">본 메일은 시스템에 의해 자동 발송되었습니다.</p>
        </div>
      `;
      tasks.push(sendEmail(RESEND_KEY, ADMIN_EMAIL, adminSubject, adminHtml));
    }

    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("오류 발생:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});
