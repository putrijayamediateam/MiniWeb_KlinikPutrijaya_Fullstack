'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetPasswordForm');
  const button = document.getElementById('resetPasswordBtn');
  const message = document.getElementById('resetPasswordMessage');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    message.textContent = 'The reset token is missing.';
    message.className = 'auth-message error';
    button.disabled = true;
    return;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    message.className = 'auth-message';
    message.textContent = '';

    if (newPassword.length < 10) {
      message.textContent = 'Password must contain at least 10 characters.';
      message.className = 'auth-message error';
      return;
    }

    if (newPassword !== confirmPassword) {
      message.textContent = 'The passwords do not match.';
      message.className = 'auth-message error';
      return;
    }

    button.disabled = true;
    button.textContent = 'Changing…';

    try {
      const response = await KPApi.resetPassword(token, newPassword);
      message.textContent = response.message;
      message.className = 'auth-message success';
      form.reset();
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 1800);
    } catch (error) {
      message.textContent = error.message || 'Unable to reset the password.';
      message.className = 'auth-message error';
    } finally {
      button.disabled = false;
      button.textContent = 'Change password';
    }
  });
});
