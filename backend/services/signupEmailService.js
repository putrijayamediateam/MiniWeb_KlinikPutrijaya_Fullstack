'use strict';

const { Resend } = require('resend');

let resendClient = null;

function getSenderAddress() {
  return String(
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM ||
    ''
  ).trim();
}

function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    getSenderAddress()
  );
}

function getResendClient() {
  if (!emailConfigured()) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

async function sendSignupVerification({ email, verificationUrl }) {
  const resend = getResendClient();

  if (!resend) {
    return {
      sent: false,
      reason: 'email_not_configured',
    };
  }

  if (!email || !verificationUrl) {
    return {
      sent: false,
      reason: 'missing_email_or_verification_url',
    };
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
        <h1 style="margin:0;color:#e00d92;font-size:24px">
          Complete your account
        </h1>
      </div>

      <div style="padding:26px;border:1px solid #f4c8dc;border-top:0;border-radius:0 0 18px 18px">
        <p>Welcome to Klinik Putrijaya Admin Portal.</p>

        <p>
          Confirm your email address to finish creating your account.
        </p>

        <p>
          <a
            href="${escapeAttribute(verificationUrl)}"
            style="display:inline-block;background:#e00d92;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700"
          >
            Verify email and continue
          </a>
        </p>

        <p>
          This link expires in 30 minutes and can only be used once.
        </p>

        <p style="color:#7a5b6b">
          If you did not create this account, ignore this email.
        </p>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: getSenderAddress(),
    to: [email],
    subject: 'Complete Your Klinik Putrijaya Admin Account',
    text,
    html,
  });

  if (error) {
    const resendError = new Error(
      error.message || 'Resend could not send the verification email.'
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