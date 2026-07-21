document.addEventListener('DOMContentLoaded', initFeedback);

function initFeedback() {
  const grid = document.getElementById('feedbackGrid');
  const form = document.getElementById('feedbackForm');

  if (grid) {
    KPApi.getApprovedFeedback()
      .then((items) => {
        if (!Array.isArray(items) || !items.length) {
          grid.innerHTML = '<p class="status-message">No approved reviews yet. Be the first to share your experience.</p>';
          return;
        }

        grid.innerHTML = items.map((feedback) => `
          <article class="feedback-card">
            <div class="stars" aria-label="${feedback.rating} out of 5 stars">${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}</div>
            <p class="msg">“${KPUtils.escapeHtml(feedback.message)}”</p>
            <div class="who">${KPUtils.escapeHtml(feedback.patient_name)}</div>
            ${feedback.branch_name ? `<div class="branch">${KPUtils.escapeHtml(feedback.branch_name)}</div>` : ''}
          </article>
        `).join('');
      })
      .catch((error) => {
        grid.innerHTML = `<p class="doctor-error">Could not load feedback: ${KPUtils.escapeHtml(error.message)}</p>`;
      });
  }

  if (!form) return;

  const branchSelect = document.getElementById('fb-branch');
  const messageBox = document.getElementById('feedbackFormMessage');
  const submitButton = document.getElementById('feedbackSubmitBtn');

  KPApi.getBranches()
    .then((branches) => {
      branchSelect.innerHTML = '<option value="">Select branch</option>' + branches
        .map((branch) => `<option value="${branch.id}">${KPUtils.escapeHtml(branch.name)}</option>`)
        .join('');
    })
    .catch(() => {
      branchSelect.innerHTML = '<option value="">Could not load branches</option>';
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageBox.className = 'kp-form-message';
    messageBox.textContent = '';

    const payload = {
      patient_name: form.patient_name.value.trim(),
      branch_id: Number(form.branch_id.value) || null,
      rating: Number(form.rating.value),
      message: form.message.value.trim(),
    };

    if (!payload.patient_name || !payload.branch_id || !payload.message) {
      messageBox.textContent = 'Please fill in your name, branch and feedback message.';
      messageBox.className = 'kp-form-message error';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';

    try {
      const response = await KPApi.createFeedback(payload);
      messageBox.textContent = response?.message || 'Thank you. Your feedback has been submitted for review.';
      messageBox.className = 'kp-form-message success';
      form.reset();
    } catch (error) {
      messageBox.textContent = error.message || 'Something went wrong. Please try again.';
      messageBox.className = 'kp-form-message error';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit feedback';
    }
  });
}
