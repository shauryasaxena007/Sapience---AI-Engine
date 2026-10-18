
import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail({
  email,
  displayName,
  token,
  clientUrl,
}) {
  const sender = process.env.MAIL_FROM || process.env.SMTP_USER;

  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !sender
  ) {
    throw new Error('SMTP email settings are missing in backend/.env');
  }

  const verificationUrl =
    `${clientUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: sender,
    to: email,
    subject: 'Verify your Sapience account',
    text: `Hi ${displayName},

Welcome to Sapience!

Please verify your email address by opening this link:
${verificationUrl}

This link expires in 24 hours. If you did not create this account, you can ignore this email.

Sapience Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#14202b">
        <h1 style="color:#0b7a75">Welcome to Sapience.</h1>
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>Thanks for creating your account. Verify your email address to get started.</p>
        <p style="margin:28px 0">
          <a href="${verificationUrl}"
             style="background:#0b7a75;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">
            Verify my email
          </a>
        </p>
        <p style="font-size:13px;color:#627280">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
        <p>— Sapience Team</p>
      </div>
    `,
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
