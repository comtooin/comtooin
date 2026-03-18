import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * 1. 슬랙 메시지 발송 함수 (유지보수 업무용)
 */
async function sendSlackMessage(webhookUrl: string, data: any) {
  const message = {
    text: `📝 *신규 유지보수 업무 기록 알림 (컴투인)*`,
    attachments: [{
      color: data.status === 'completed' ? "#2EB67D" : "#ECB22E", // 완료는 초록, 진행중은 노랑
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*새로운 유지보수 업무가 기록되었습니다.*\n*거래처:* ${data.customer_name}\n*요청자:* ${data.requester_name || '미기입'}\n*작성자:* ${data.user_name}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*업무 내용:*\n${data.content.replace(/<[^>]*>?/gm, '').substring(0, 500)}` 
          }
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `기록 일시: ${new Date(data.created_at).toLocaleString('ko-KR')}` }]
        }
      ]
    }]
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  
  if (!res.ok) console.error("슬랙 발송 실패:", await res.text());
}

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
    const SLACK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    
    const tasks = [];

    if (SLACK_URL) {
      tasks.push(sendSlackMessage(SLACK_URL, record));
    }

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
