'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const button = document.getElementById('forgotPasswordBtn');
  const message = document.getElementById('forgotPasswordMessage');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.className = 'auth-message';
    message.textContent = '';
    button.disabled = true;
    button.textContent = 'Sending…';

    try {
      const response = await KPApi.forgotPassword(form.email.value.trim());
      message.textContent = response.message;
      message.className = 'auth-message success';
      form.reset();
    } catch (error) {
      message.textContent = error.message || 'Unable to send the reset link.';
      message.className = 'auth-message error';
    } finally {
      button.disabled = false;
      button.textContent = 'Send reset link';
    }
  });
});
