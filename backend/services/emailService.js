'use strict';

const { Resend } = require('resend');

let resendClient = null;

/**
 * Check whether Resend settings are available.
 */
function getSenderAddress() {
  return (
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

function getBookingNotificationRecipients() {
  return [
    ...new Set(
      String(
        process.env.BOOKING_NOTIFICATION_EMAILS ||
          ''
      )
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
    ),
  ];
}

function getAdminDashboardUrl() {
  const fallbackUrl =
    'https://klinikputrijaya.com/admin';

  try {
    const frontendUrl = String(
      process.env.FRONTEND_URL ||
        'https://klinikputrijaya.com'
    ).trim();

    const adminUrl = new URL(
      '/admin',
      frontendUrl
    );

    if (
      adminUrl.protocol !== 'https:' &&
      adminUrl.protocol !== 'http:'
    ) {
      return fallbackUrl;
    }

    return adminUrl.toString();
  } catch {
    return fallbackUrl;
  }
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
    from: getSenderAddress(),
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

/**
 * Send a minimal internal notification after a booking is saved.
 */
async function sendBookingNotification({
  reference,
  branchName,
  serviceTitle,
  doctorName,
  preferredDate,
  preferredTime,
  status = 'pending',
}) {
  const recipients =
    getBookingNotificationRecipients();

  if (!recipients.length) {
    return {
      sent: false,
      reason:
        'booking_notification_recipients_not_configured',
    };
  }

  const resend = getResendClient();

  if (!resend) {
    return {
      sent: false,
      reason: 'email_not_configured',
    };
  }

  if (!reference) {
    return {
      sent: false,
      reason: 'missing_booking_reference',
    };
  }

  const safeReference = cleanDisplayLine(
    reference,
    'Not specified'
  );
  const safeBranchName = cleanDisplayLine(
    branchName,
    'Branch not specified'
  );
  const safeServiceTitle = cleanDisplayLine(
    serviceTitle,
    'General consultation / Not specified'
  );
  const safeDoctorName = cleanDisplayLine(
    doctorName,
    'No preference'
  );
  const safeStatus = cleanDisplayLine(
    status,
    'pending'
  ).toUpperCase();
  const displayDate = formatBookingDate(
    preferredDate
  );
  const displayTime = formatBookingTime(
    preferredTime
  );
  const dashboardUrl = getAdminDashboardUrl();
  const subjectBranch =
    safeBranchName.replace(
      /^Klinik Putrijaya\s+/i,
      ''
    ) || safeBranchName;
  const subject =
    `New Booking — ${subjectBranch} — ${safeReference}`;

  const text = [
    'NEW APPOINTMENT REQUEST',
    '',
    `Reference: ${safeReference}`,
    `Branch: ${safeBranchName}`,
    `Service: ${safeServiceTitle}`,
    `Preferred doctor: ${safeDoctorName}`,
    `Preferred date: ${displayDate}`,
    `Preferred time: ${displayTime}`,
    `Status: ${safeStatus}`,
    '',
    'A new booking has been received.',
    '',
    'Open the Klinik Putrijaya Admin Dashboard to review the patient details:',
    dashboardUrl,
  ].join('\n');

  const detailRows = [
    ['Reference', safeReference],
    ['Branch', safeBranchName],
    ['Service', safeServiceTitle],
    ['Preferred doctor', safeDoctorName],
    ['Preferred date', displayDate],
    ['Preferred time', displayTime],
    ['Status', safeStatus],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <th align="left" valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid #f8dce9;color:#7a5b6b;font-size:14px">
            ${escapeHtml(label)}
          </th>
          <td valign="top" style="padding:8px 0;border-bottom:1px solid #f8dce9;font-size:14px;overflow-wrap:anywhere">
            ${escapeHtml(value)}
          </td>
        </tr>
      `
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#30212a;line-height:1.6">
      <div style="padding:26px;border-radius:18px 18px 0 0;background:linear-gradient(135deg,#ffe5f0,#fff7fb)">
        <p style="margin:0 0 6px;color:#9f456f;font-size:13px;font-weight:700;letter-spacing:.08em">
          NEW APPOINTMENT REQUEST
        </p>
        <h1 style="margin:0;color:#e00d92;font-size:24px">
          ${escapeHtml(safeReference)}
        </h1>
      </div>

      <div style="padding:26px;border:1px solid #f4c8dc;border-top:0;border-radius:0 0 18px 18px">
        <p>A new booking has been received.</p>

        <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0">
          ${detailRows}
        </table>

        <p>
          <a
            href="${escapeAttribute(dashboardUrl)}"
            style="display:inline-block;padding:12px 20px;border-radius:10px;background:#e00d92;color:#fff;font-weight:700;text-decoration:none"
          >
            View Booking Dashboard
          </a>
        </p>

        <p style="color:#7a5b6b;font-size:14px">
          Sign in to the admin dashboard to review
          patient details securely.
        </p>
      </div>
    </div>
  `;

  const { data, error } =
    await resend.emails.send({
      from: getSenderAddress(),
      to: recipients,
      subject,
      text,
      html,
    });

  if (error) {
    const resendError = new Error(
      error.message ||
        'Resend could not send the booking notification.'
    );

    resendError.name = 'ResendEmailError';
    resendError.code =
      error.name || 'RESEND_SEND_FAILED';
    resendError.details = error;

    throw resendError;
  }

  return {
    sent: true,
    messageId: data?.id || null,
  };
}

function cleanDisplayLine(value, fallback) {
  const cleaned = String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function formatBookingDate(value) {
  const rawDate = String(value ?? '')
    .trim()
    .slice(0, 10);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      rawDate
    );

  if (!match) {
    return rawDate || 'Not specified';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return rawDate;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatBookingTime(value) {
  const rawTime = String(value ?? '').trim();
  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(
      rawTime
    );

  if (!match) {
    return rawTime || 'Not specified';
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours > 23 ||
    minutes > 59
  ) {
    return rawTime;
  }

  const hour12 = hours % 12 || 12;
  const period = hours < 12 ? 'AM' : 'PM';

  return `${hour12}:${String(minutes).padStart(
    2,
    '0'
  )} ${period}`;
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
  sendBookingNotification,
  sendPasswordReset,
};
