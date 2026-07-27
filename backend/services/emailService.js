'use strict';

const { Resend } = require('resend');

let resendClient = null;

/**
 * Check whether Resend settings are available.
 */
function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM
  );
}

/**
 * Create and reuse the Resend client.
 */
function getResendClient() {
  if (!emailConfigured()) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

/**
 * Send password reset email for admin accounts.
 */
async function sendPasswordReset({
  email,
  username,
  resetUrl,
}) {
  const resend = getResendClient();

  if (!resend) {
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

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: [email],
    subject: 'Klinik Putrijaya Admin Password Reset',
    text,
    html,
  });

  if (error) {
    const resendError = new Error(
      error.message || 'Resend could not send the password reset email.'
    );

    resendError.name = 'ResendEmailError';
    resendError.code = error.name || 'RESEND_SEND_FAILED';
    resendError.details = error;

    throw resendError;
  }

  return {
    sent: true,
    messageId: data?.id || null,
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