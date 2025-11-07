import nodemailer from 'nodemailer';

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.naver.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  requireTLS: true, // Enforce TLS for port 587
  auth: {
    user: process.env.EMAIL_USER, // Naver email address
    pass: process.env.EMAIL_PASS, // Naver email password
  },
});

interface RequestDetails {
  id: number;
  customer_name: string;
  user_name: string;
  content: string;
}

// Function to send a submission confirmation email
export const sendSubmissionConfirmation = async (recipientEmail: string, details: RequestDetails) => {
  if (!recipientEmail) return;

  const subject = `[컴투인] AS 접수가 정상적으로 완료되었습니다. (접수번호: ${details.id})`;
  const html = `
    <h2>안녕하세요, ${details.user_name}님. AS 접수가 정상적으로 완료되었습니다.</h2>
    <p>최대한 빠른 시일 내에 확인 후 처리해 드리겠습니다.</p>
    <hr>
    <h3>접수 정보</h3>
    <ul>
      <li><strong>접수번호:</strong> ${details.id}</li>
      <li><strong>고객사명:</strong> ${details.customer_name}</li>
      <li><strong>사용자명:</strong> ${details.user_name}</li>
      <li><strong>접수내용:</strong></li>
      <p>${details.content}</p>
    </ul>
    <hr>
    <p>감사합니다.<br>컴투인</p>
  `;

  try {
    await transporter.sendMail({
      from: `"컴투인" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      html: html,
    });
    console.log(`Submission confirmation email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending submission confirmation email:", error);
  }
};

// Function to send a status update email
export const sendStatusUpdate = async (recipientEmail: string, details: RequestDetails, newStatus: string) => {
  if (!recipientEmail) return;

  const subject = `[컴투인] AS 처리 상태가 '${newStatus}'(으)로 변경되었습니다. (접수번호: ${details.id})`;
  const html = `
    <h2>안녕하세요, ${details.user_name}님. 접수하신 AS 건의 처리 상태가 변경되었습니다.</h2>
    <hr>
    <h3>접수 정보</h3>
    <ul>
      <li><strong>접수번호:</strong> ${details.id}</li>
      <li><strong>고객사명:</strong> ${details.customer_name}</li>
      <li><strong>현재 상태:</strong> <strong>${newStatus}</strong></li>
    </ul>
    <p>내 접수내역 확인 페이지에서 자세한 내용을 확인하실 수 있습니다.</p>
    <hr>
    <p>감사합니다.<br>컴투인</p>
  `;

  try {
    await transporter.sendMail({
      from: `"컴투인" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      html: html,
    });
    console.log(`Status update email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending status update email:", error);
  }
};
