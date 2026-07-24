'use strict';

const API_BASE = String(window.KP_API_BASE || 'http://localhost:4000/api').replace(/\/$/, '');

window.addEventListener('DOMContentLoaded', verifyAccount);

async function verifyAccount() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const title = document.getElementById('verifyTitle');
  const intro = document.getElementById('verifyIntro');
  const message = document.getElementById('verifyMessage');

  if (!token) {
    title.textContent = 'Verification link missing';
    intro.textContent = 'Open the complete link from your verification email.';
    setMessage(message, 'The verification token was not found.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Unable to verify the account.');
    }

    title.textContent = 'Account verified';
    intro.textContent = 'Your Klinik Putrijaya admin account is ready.';
    setMessage(message, data.message, 'success');
  } catch (error) {
    title.textContent = 'Verification failed';
    intro.textContent = 'The link may be invalid or expired.';
    setMessage(message, error.message, 'error');
  }
}

function setMessage(target, text, type) {
  if (!target) return;
  target.textContent = text;
  target.className = `auth-message ${type}`;
}
