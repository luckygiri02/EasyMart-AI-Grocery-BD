// server/utils/emailService.js
const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications['api-key'];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sendPasswordResetEmail = async (name, toEmail, resetLink) => {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@easymart.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'EasyMart Support';

  sendSmtpEmail.subject = "EasyMart - Reset Your Password";
  sendSmtpEmail.sender = { email: senderEmail, name: senderName };
  sendSmtpEmail.to = [{ email: toEmail, name: name || "there" }];

  // ⭐⭐ Professional + Branded Email Template ⭐⭐
  sendSmtpEmail.htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; background-color:#f8f9fa; padding:20px;">
        <div style="max-width:580px; margin:auto; background:white; border-radius:10px; padding:25px; box-shadow:0 4px 10px rgba(0,0,0,0.08);">

          <h2 style="color:#333; text-align:center; margin-top:0;">🔐 Password Reset Request</h2>

          <p style="font-size:15px; color:#555;">
            Hi 
          </p>

          <p style="font-size:15px; color:#555;">
            We received a request to reset your password for your <strong>EasyMart</strong> account.
          </p>

          <p style="font-size:15px; color:#555;">
            Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.
          </p>

          <div style="text-align:center; margin:25px 0;">
            <a href="${resetLink}"
              style="background:#4CAF50; color:white; padding:12px 20px; border-radius:8px;
              text-decoration:none; font-size:16px; display:inline-block;">
              Reset Password
            </a>
          </div>

          <p style="font-size:14px; color:#777;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>

          <p style="font-size:13px; word-break:break-all; color:#4CAF50;">
            ${resetLink}
          </p>

          <hr style="border:none; border-top:1px solid #eee; margin:25px 0;">

          <p style="font-size:13px; color:#999; text-align:center;">
            If you did not request this, you can safely ignore this email.<br>
            — EasyMart Support Team
          </p>

        </div>
      </body>
    </html>
  `;

  try {
    const resp = await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);
    console.log("Brevo Response:", resp);
    return { success: true, resp };
  } catch (err) {
    const errorBody = err?.response?.body || err.message;
    console.error("Brevo Email Error:", errorBody);
    return { success: false, error: errorBody };
  }
};

module.exports = { sendPasswordResetEmail };
