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
    resendClient =
      new Resend(
        process.env.RESEND_API_KEY
      );
  }

  return resendClient;
}

function getLoginUrl() {
  const frontendUrl =
    String(
      process.env.FRONTEND_URL ||
        'http://127.0.0.1:5500'
    ).replace(/\/+$/, '');

  return `${frontendUrl}/admin.html`;
}

async function sendAccountApproved({
  email,
  username,
}) {
  const resend =
    getResendClient();

  if (!resend) {
    return {
      sent: false,
      reason: 'email_not_configured',
    };
  }

  if (!email) {
    return {
      sent: false,
      reason: 'missing_email',
    };
  }

  const displayName =
    username || 'Admin';

  const loginUrl =
    getLoginUrl();

  const text = [
    `Hello ${displayName},`,
    '',
    'Your Klinik Putrijaya Admin Portal account has been approved.',
    '',
    'You may now log in using the link below:',
    loginUrl,
    '',
    'If you did not create this account, contact the system superadmin.',
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
      <div
        style="
          padding: 26px;
          border-radius: 18px 18px 0 0;
          background:
            linear-gradient(
              135deg,
              #ffe5f0,
              #fff7fb
            );
        "
      >
        <h1
          style="
            margin: 0;
            color: #e00d92;
            font-size: 24px;
          "
        >
          Account approved
        </h1>
      </div>

      <div
        style="
          padding: 26px;
          border: 1px solid #f4c8dc;
          border-top: 0;
          border-radius: 0 0 18px 18px;
        "
      >
        <p>
          Hello ${escapeHtml(displayName)},
        </p>

        <p>
          Your Klinik Putrijaya Admin Portal
          account has been approved.
        </p>

        <p>
          You may now log in and access the
          administrator dashboard.
        </p>

        <p>
          <a
            href="${escapeAttribute(loginUrl)}"
            style="
              display: inline-block;
              padding: 12px 20px;
              border-radius: 10px;
              background: #e00d92;
              color: #ffffff;
              font-weight: 700;
              text-decoration: none;
            "
          >
            Log in to Admin Portal
          </a>
        </p>

        <p
          style="
            color: #7a5b6b;
            font-size: 14px;
          "
        >
          If you did not create this account,
          contact the system superadmin.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    resend,
    email,
    subject:
      'Your Klinik Putrijaya Admin Account Has Been Approved',
    text,
    html,
  });
}

async function sendAccountRejected({
  email,
  username,
  reason,
}) {
  const resend =
    getResendClient();

  if (!resend) {
    return {
      sent: false,
      reason: 'email_not_configured',
    };
  }

  if (!email) {
    return {
      sent: false,
      reason: 'missing_email',
    };
  }

  const displayName =
    username || 'Admin';

  const rejectionReason =
    String(reason || '').trim();

  const textLines = [
    `Hello ${displayName},`,
    '',
    'Your request for access to the Klinik Putrijaya Admin Portal was not approved.',
  ];

  if (rejectionReason) {
    textLines.push(
      '',
      `Reason: ${rejectionReason}`
    );
  }

  textLines.push(
    '',
    'Contact the system superadmin if you need further clarification.'
  );

  const text =
    textLines.join('\n');

  const reasonHtml =
    rejectionReason
      ? `
        <div
          style="
            margin: 18px 0;
            padding: 14px 16px;
            border-radius: 10px;
            background: #fff5f7;
            border: 1px solid #f4c8dc;
          "
        >
          <strong>Reason:</strong><br>
          ${escapeHtml(rejectionReason)}
        </div>
      `
      : '';

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
      <div
        style="
          padding: 26px;
          border-radius: 18px 18px 0 0;
          background: #fff5f7;
        "
      >
        <h1
          style="
            margin: 0;
            color: #9f234d;
            font-size: 24px;
          "
        >
          Account request update
        </h1>
      </div>

      <div
        style="
          padding: 26px;
          border: 1px solid #f4c8dc;
          border-top: 0;
          border-radius: 0 0 18px 18px;
        "
      >
        <p>
          Hello ${escapeHtml(displayName)},
        </p>

        <p>
          Your request for access to the
          Klinik Putrijaya Admin Portal was
          not approved.
        </p>

        ${reasonHtml}

        <p>
          Contact the system superadmin if
          you need further clarification.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    resend,
    email,
    subject:
      'Klinik Putrijaya Admin Account Request Update',
    text,
    html,
  });
}

async function sendEmail({
  resend,
  email,
  subject,
  text,
  html,
}) {
  const {
    data,
    error,
  } = await resend.emails.send({
    from: getSenderAddress(),
    to: [email],
    subject,
    text,
    html,
  });

  if (error) {
    const resendError =
      new Error(
        error.message ||
          'Resend could not send the account email.'
      );

    resendError.name =
      'ResendEmailError';

    resendError.code =
      error.name ||
      'RESEND_SEND_FAILED';

    resendError.details =
      error;

    throw resendError;
  }

  return {
    sent: true,
    messageId:
      data?.id || null,
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
  sendAccountApproved,
  sendAccountRejected,
};