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

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

async function sendBookingConfirmation(booking) {
  if (!booking.email) {
    return { sent: false, reason: 'no_email' };
  }

  const mailer = getTransporter();
  if (!mailer) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const reference = `KP-APT-${String(booking.id).padStart(5, '0')}`;
  const branch = booking.branch_name || 'Klinik Putrijaya';
  const doctor = booking.doctor_name || 'Any available doctor';
  const service = booking.service_title || 'General consultation';
  const date = formatDate(booking.preferred_date);
  const time = booking.preferred_time || '-';

  const text = [
    `Hello ${booking.patient_name},`,
    '',
    'Your Klinik Putrijaya appointment has been confirmed.',
    '',
    `Reference: ${reference}`,
    `Branch: ${branch}`,
    `Doctor: ${doctor}`,
    `Service: ${service}`,
    `Date: ${date}`,
    `Time: ${time}`,
    '',
    'Please arrive around 10 minutes before your appointment.',
    '',
    'Thank you,',
    'Klinik Putrijaya',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#30212a;line-height:1.6">
      <div style="background:linear-gradient(135deg,#ffe5f0,#fff7fb);padding:26px;border-radius:18px 18px 0 0">
        <h1 style="margin:0;color:#e00d92;font-size:24px">Appointment Confirmed</h1>
        <p style="margin:8px 0 0">Hello ${escapeHtml(booking.patient_name)}, your appointment is confirmed.</p>
      </div>
      <div style="padding:26px;border:1px solid #f4c8dc;border-top:0;border-radius:0 0 18px 18px">
        <table style="width:100%;border-collapse:collapse">
          ${row('Reference', reference)}
          ${row('Branch', branch)}
          ${row('Doctor', doctor)}
          ${row('Service', service)}
          ${row('Date', date)}
          ${row('Time', time)}
        </table>
        <p style="margin-top:22px">Please arrive around 10 minutes before your appointment.</p>
        <p style="margin-bottom:0;color:#7a5b6b">Thank you,<br>Klinik Putrijaya</p>
      </div>
    </div>
  `;

  const info = await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: booking.email,
    subject: `Klinik Putrijaya Appointment Confirmed - ${reference}`,
    text,
    html,
  });

  return { sent: true, messageId: info.messageId };
}

async function sendPasswordReset({ email, username, resetUrl }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const text = [
    `Hello ${username || 'Admin'},`,
    '',
    'A password reset was requested for your Klinik Putrijaya admin account.',
    'Use the link below within 30 minutes:',
    '',
    resetUrl,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#30212a;line-height:1.6">
      <h2 style="color:#e00d92">Reset your admin password</h2>
      <p>Hello ${escapeHtml(username || 'Admin')},</p>
      <p>A password reset was requested for your Klinik Putrijaya admin account.</p>
      <p>
        <a href="${escapeAttribute(resetUrl)}" style="display:inline-block;background:#e00d92;color:white;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
          Reset password
        </a>
      </p>
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p style="color:#7a5b6b">If you did not request this, ignore this email.</p>
    </div>
  `;

  const info = await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Klinik Putrijaya Admin Password Reset',
    text,
    html,
  });

  return { sent: true, messageId: info.messageId };
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;color:#7a5b6b;width:130px">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-weight:700">${escapeHtml(value)}</td>
    </tr>
  `;
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
  sendBookingConfirmation,
  sendPasswordReset,
};
