'use strict';

require('dotenv').config();

const {
  sendSignupVerification,
} = require('./services/signupEmailService');

async function testSmtp() {
  console.log('SMTP configuration check:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SMTP_USER,
    passwordPresent: Boolean(process.env.SMTP_PASS),
    mailFrom: process.env.MAIL_FROM,
  });

const result = await sendSignupVerification({
  email: 'putrijayamediateam@gmail.com',
  verificationUrl:
    'http://127.0.0.1:5500/verify-account.html?token=test-smtp',
});

  console.log('Email result:', result);
}

testSmtp().catch((error) => {
  console.error('SMTP test failed:');
  console.error(error);
  process.exitCode = 1;
});