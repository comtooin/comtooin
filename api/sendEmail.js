import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://szwiejswmfivultxxywb.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY || 
  'sb_publishable_q2imOp6aORMPdq0tdGLhsw_e8aAXuTS';

const supabase = createClient(supabaseUrl, serviceKey);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { table, type, record } = body;

    if (!record) {
      return res.status(400).json({ error: 'No record provided' });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    // If GMAIL credentials exist on Vercel environment variables, send directly via Nodemailer
    if (gmailUser && gmailPass) {
      console.log('Backend sendEmail - Sending via Vercel Direct Nodemailer...');
      
      const { data: staffList } = await supabase
        .from('staff')
        .select('email')
        .not('email', 'is', null)
        .neq('role', 'admin');

      const emailAddresses = (staffList || []).map(s => s.email).filter(Boolean);
      const customerName = record.customer_name || record.name || "비회원 거래처";
      const guestName = record.guest_name || "비회원";
      const guestPhone = record.guest_phone || "미기입";
      const guestEmail = record.guest_email || "미기입";

      const allRecipients = Array.from(new Set([
        gmailUser,
        ...emailAddresses
      ].map(e => (e || '').trim()).filter(Boolean)));

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const mailOptions = {
        from: `"COMTOOIN 알림" <${gmailUser}>`,
        to: allRecipients.join(', '),
        subject: `[COMTOOIN] 1:1 기술지원 대화방 개설: ${customerName} (${guestName})`,
        html: `
          <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #059669; padding: 28px 24px; color: #ffffff;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #a7f3d0; display: block; margin-bottom: 4px;">COMTOOIN LIVE MESSENGER</span>
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">신규 1:1 기술지원 대화방 개설 알림</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">거래처 비회원 전용 1:1 기술지원 대화방이 새롭게 생성되었습니다.</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; width: 120px; font-weight: bold; color: #64748b;">거래처명</td><td style="padding: 12px 8px; color: #0f172a; font-weight: 600;">${customerName}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">접수자(이름)</td><td style="padding: 12px 8px; color: #0f172a;">${guestName}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">연락처</td><td style="padding: 12px 8px; color: #0f172a;">${guestPhone}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">이메일</td><td style="padding: 12px 8px; color: #0f172a;">${guestEmail}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 12px 8px; font-weight: bold; color: #64748b;">개설 일시</td><td style="padding: 12px 8px; color: #0f172a;">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
              </table>
              <div style="text-align: center; margin-top: 20px;">
                <a href="https://comtooin.vercel.app/admin/messenger" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">1:1 메신저 대화방 바로가기</a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">본 메일은 COMTOOIN ITSM 메신저 알림 시스템에서 자동 발송되었습니다.</div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Backend sendEmail - Vercel Direct Nodemailer sent successfully:', info.messageId);
      return res.status(200).json({ success: true, messageId: info.messageId, mode: 'vercel_direct' });
    }

    // Otherwise relay to Supabase Edge Function
    console.log('Backend sendEmail - Relaying email request to Supabase Edge Function (send-notification-email)...');
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({
        table,
        type,
        record
      })
    });

    const data = await response.json().catch(() => ({ message: 'Non-JSON response from Edge Function' }));
    console.log('Backend sendEmail - Supabase Edge Function response status:', response.status, 'data:', data);

    return res.status(200).json({ success: true, edgeFunctionStatus: response.status, data, mode: 'edge_function_relay' });
  } catch (error) {
    console.error('Backend sendEmail Fatal Error:', error);
    return res.status(500).json({ error: 'Failed to trigger email notification', details: error.message || String(error) });
  }
}
