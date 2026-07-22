'use strict';

const twilio = require('twilio');

let client = null;

function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

function getClient() {
  if (!smsConfigured()) return null;
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return client;
}

function normalizeMalaysiaPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');

  if (digits.startsWith('0')) digits = `6${digits}`;
  if (digits.startsWith('1')) digits = `60${digits}`;
  if (!digits.startsWith('60')) return null;

  const normalized = `+${digits}`;
  return /^\+60\d{8,10}$/.test(normalized) ? normalized : null;
}

function formatDate(value) {
  if (!value) return '-';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return String(value);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function sendBookingConfirmation(booking) {
  const to = normalizeMalaysiaPhone(booking.phone);
  if (!to) {
    return { sent: false, reason: 'invalid_phone' };
  }

  const smsClient = getClient();
  if (!smsClient) {
    return { sent: false, reason: 'sms_not_configured' };
  }

  const reference = `KP-APT-${String(booking.id).padStart(5, '0')}`;
  const body = [
    'Klinik Putrijaya:',
    `${reference} confirmed.`,
    `${booking.branch_name || 'Selected branch'},`,
    `${formatDate(booking.preferred_date)} ${booking.preferred_time || ''}.`,
    `Service: ${booking.service_title || 'General consultation'}.`,
  ].join(' ');

  const message = await smsClient.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });

  return { sent: true, sid: message.sid };
}

module.exports = {
  normalizeMalaysiaPhone,
  sendBookingConfirmation,
  smsConfigured,
};
