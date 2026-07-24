'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Check whether SMTP settings are available.
 */
function emailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

/**
 * Create and reuse the Nodemailer transporter.
 */
function getTransporter() {
  if (!emailConfigured()) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure:
      String(process.env.SMTP_SECURE).toLowerCase() ===
      'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Send password reset email for admin accounts.
 */
async function sendPasswordReset({
  email,
  username,
  resetUrl,
}) {
  const mailer = getTransporter();

  if (!mailer) {
    return {
      sent: false,
      reason: 'email_not_configured',
    };
  }

  if (!email || !resetUrl) {
    return {
      sent: false,
      reason: 'missing_email_or_reset_url',
    };
  }

  const displayName = username || 'Admin';

  const text = [
    `Hello ${displayName},`,
    '',
    'A password reset was requested for your Klinik Putrijaya admin account.',
    'Use the link below within 30 minutes:',
    '',
    resetUrl,
    '',
    'This link can only be used once.',
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');

  const html = `
    <div
      style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        color: #30212a;
        line-height: 1.6;
      "
    >
      <h2 style="color: #e00d92;">
        Reset your admin password
      </h2>

      <p>
        Hello ${escapeHtml(displayName)},
      </p>

      <p>
        A password reset was requested for your
        Klinik Putrijaya admin account.
      </p>

      <p>
        <a
          href="${escapeAttribute(resetUrl)}"
          style="
            display: inline-block;
            background: #e00d92;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
          "
        >
          Reset password
        </a>
      </p>

      <p>
        This link expires in 30 minutes and can only
        be used once.
      </p>

      <p style="color: #7a5b6b;">
        If you did not request this, ignore this email.
      </p>
    </div>
  `;

  const info = await mailer.sendMail({
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,
    to: email,
    subject:
      'Klinik Putrijaya Admin Password Reset',
    text,
    html,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

module.exports = {
  emailConfigured,
  sendPasswordReset,
};