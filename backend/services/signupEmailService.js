'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function emailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!emailConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendSignupVerification({ email, verificationUrl }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const text = [
    'Welcome to Klinik Putrijaya Admin Portal.',
    '',
    'Complete your account registration using the link below:',
    verificationUrl,
    '',
    'This link expires in 30 minutes and can only be used once.',
    'If you did not create this account, ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#30212a;line-height:1.6">
      <div style="background:linear-gradient(135deg,#ffe5f0,#fff7fb);padding:26px;border-radius:18px 18px 0 0">
        <h1 style="margin:0;color:#e00d92;font-size:24px">Complete your account</h1>
      </div>
      <div style="padding:26px;border:1px solid #f4c8dc;border-top:0;border-radius:0 0 18px 18px">
        <p>Welcome to Klinik Putrijaya Admin Portal.</p>
        <p>Confirm your email address to finish creating your account.</p>
        <p>
          <a href="${escapeAttribute(verificationUrl)}" style="display:inline-block;background:#e00d92;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
            Verify email and continue
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p style="color:#7a5b6b">If you did not create this account, ignore this email.</p>
      </div>
    </div>
  `;

  const info = await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Complete Your Klinik Putrijaya Admin Account',
    text,
    html,
  });

  return { sent: true, messageId: info.messageId };
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = {
  sendSignupVerification,
};
