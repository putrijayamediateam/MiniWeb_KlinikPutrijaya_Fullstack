'use strict';

const API_BASE = String(
  window.KP_API_BASE ||
  (
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:4000/api'
      : 'https://backend-production-d730.up.railway.app/api'
  )
).replace(/\/$/, '');
const TOKEN_KEY = 'kp_admin_token';
const USERNAME_KEY = 'kp_admin_username';

let authConfig = null;

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('signupForm')?.addEventListener('submit', handleEmailSignup);

  try {
    authConfig = await request('/auth/signup-config');

    if (!authConfig.signupEnabled) {
      setMessage('Account registration is currently disabled.', 'error');
      document.getElementById('signupBtn').disabled = true;
    }

    await renderGoogleButton(authConfig.googleClientId);
  } catch (error) {
    setMessage(error.message || 'Unable to load signup settings.', 'error');
    showGoogleUnavailable('Google signup is currently unavailable.');
  }
});

async function handleEmailSignup(event) {
  event.preventDefault();

  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const button = document.getElementById('signupBtn');

  setMessage('');
  setButtonLoading(button, true, 'Creating account…');

  try {
    const response = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setMessage(response.message, 'success');
    document.getElementById('signupForm').reset();
  } catch (error) {
    setMessage(error.message || 'Unable to create the account.', 'error');
  } finally {
    setButtonLoading(button, false, 'Create account');
  }
}

async function renderGoogleButton(clientId) {
  const target = document.getElementById('googleButton');
  if (!target) return;

  if (!clientId) {
    showGoogleUnavailable('Google signup has not been configured yet.');
    return;
  }

  const timeoutAt = Date.now() + 8000;
  while (!window.google?.accounts?.id && Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (!window.google?.accounts?.id) {
    showGoogleUnavailable('Google signup could not be loaded.');
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  target.innerHTML = '';
  window.google.accounts.id.renderButton(target, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signup_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: Math.min(target.clientWidth || 380, 380),
  });
}

async function handleGoogleCredential(response) {
  setMessage('Completing Google signup…');

  try {
    const result = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential }),
    });

    sessionStorage.setItem(TOKEN_KEY, result.token);
    sessionStorage.setItem(USERNAME_KEY, result.username || result.email || 'admin');
    window.location.href = 'admin.html';
  } catch (error) {
    setMessage(error.message || 'Google signup failed.', 'error');
  }
}

function showGoogleUnavailable(message) {
  const target = document.getElementById('googleButton');
  if (target) {
    target.innerHTML = `<div class="google-unavailable">${escapeHtml(message)}</div>`;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }
  return data;
}

function setMessage(message, type = '') {
  const target = document.getElementById('signupMessage');
  if (!target) return;
  target.textContent = message;
  target.className = `auth-message${type ? ` ${type}` : ''}`;
}

function setButtonLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = label;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
