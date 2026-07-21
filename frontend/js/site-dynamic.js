// ============================================================
// Klinik Putrijaya - dynamic content, booking, feedback, search
// Depends on js/api.js (KPApi) being loaded first.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initDoctors();
  initBookingForm();
  initFeedback();
});

// ------------------------------------------------------------
// DOCTORS: dynamic render + search + branch filter
// ------------------------------------------------------------
function renderDoctors(doctors) {
  const container = document.getElementById('doctorsContainer');
  if (!container) return;

  if (!doctors.length) {
    container.innerHTML = '<p class="doctor-empty">No doctors match your search.</p>';
    return;
  }

  // Group by branch so the layout matches the original design
  const groups = {};
  doctors.forEach((doc) => {
    if (!groups[doc.branch_name]) groups[doc.branch_name] = [];
    groups[doc.branch_name].push(doc);
  });

  container.innerHTML = Object.entries(groups).map(([branchName, docs]) => `
    <div class="doctor-branch-group">
      <div class="doctor-branch-header">
        <div>
          <span class="doctor-branch-label">${branchName}</span>
          <h3>${branchName.replace('Klinik Putrijaya —', '').replace('Klinik Putrijaya', '').trim() || branchName} Resident Doctors</h3>
        </div>
      </div>
      <div class="doctor-detail-grid">
        ${docs.map((doc) => `
          <article class="doctor-detail">
            <div class="doctor-photo">
              <img src="${escapeHtml(doc.photo_url || 'images/logoklinik.png')}" alt="${escapeHtml(doc.name)}">
            </div>
            <div class="doctor-info">
              <h5>${escapeHtml(doc.name)}</h5>
              <p>${escapeHtml(doc.qualification)}</p>
              <p class="reg">${escapeHtml(doc.reg_no)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

let doctorFetchTimer = null;
function loadDoctors() {
  const container = document.getElementById('doctorsContainer');
  const q = document.getElementById('doctorSearchInput')?.value.trim() || '';
  const branch = document.getElementById('doctorBranchFilter')?.value || '';

  if (container) container.innerHTML = '<p class="doctor-loading">Loading doctors…</p>';

  KPApi.getDoctors({ ...(q ? { q } : {}), ...(branch ? { branch } : {}) })
    .then(renderDoctors)
    .catch((err) => {
      if (container) container.innerHTML = `<p class="doctor-error">Could not load doctors: ${escapeHtml(err.message)}</p>`;
    });
}

function initDoctors() {
  if (!document.getElementById('doctorsContainer')) return;
  loadDoctors();

  const searchInput = document.getElementById('doctorSearchInput');
  const branchFilter = document.getElementById('doctorBranchFilter');

  searchInput?.addEventListener('input', () => {
    clearTimeout(doctorFetchTimer);
    doctorFetchTimer = setTimeout(loadDoctors, 300); // debounce while typing
  });
  branchFilter?.addEventListener('change', loadDoctors);
}

// ------------------------------------------------------------
// BOOKING FORM
// ------------------------------------------------------------
function initBookingForm() {
  const form = document.getElementById('bookingForm');
  if (!form) return;

  const branchSelect = document.getElementById('bk-branch');
  const doctorSelect = document.getElementById('bk-doctor');
  const serviceSelect = document.getElementById('bk-service');
  const messageBox = document.getElementById('bookingMessage');
  const submitBtn = document.getElementById('bookingSubmitBtn');

  // Doctor dropdown starts disabled until branch is selected
  doctorSelect.disabled = true;
  doctorSelect.innerHTML = '<option value="">Please select branch first</option>';

  // Populate branch dropdown
  KPApi.getBranches()
    .then((branches) => {
      branchSelect.innerHTML =
        '<option value="">Select a branch</option>' +
        branches
          .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
          .join('');
    })
    .catch(() => {
      branchSelect.innerHTML = '<option value="">Could not load branches</option>';
    });

  // Function: load doctors based on selected branch
  async function loadDoctorsByBranch() {
  const branchId = branchSelect.value;
  const selectedBranchName = branchSelect.options[branchSelect.selectedIndex]?.textContent.trim();

  if (!branchId) {
    doctorSelect.disabled = true;
    doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
    return;
  }

  doctorSelect.disabled = true;
  doctorSelect.innerHTML = '<option value="">Loading doctors...</option>';

  try {
    // Get all doctors first
    const allDoctors = await KPApi.getDoctors();

    // Filter doctors based on selected branch
    const filteredDoctors = allDoctors.filter((doctor) => {
      return (
        String(doctor.branch_id) === String(branchId) ||
        doctor.branch_name === selectedBranchName
      );
    });

    if (!filteredDoctors.length) {
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">No doctor available for this branch</option>';
      return;
    }

    doctorSelect.innerHTML =
      '<option value="">Any available doctor</option>' +
      filteredDoctors
        .map((doctor) => `<option value="${doctor.id}">${escapeHtml(doctor.name)}</option>`)
        .join('');

    doctorSelect.disabled = false;

  } catch (err) {
    console.error('Failed to load doctors by branch:', err);
    doctorSelect.disabled = true;
    doctorSelect.innerHTML = '<option value="">Could not load doctors</option>';
  }
}

  // When branch changes, doctor dropdown changes too
  branchSelect.addEventListener('change', loadDoctorsByBranch);

  // Populate service dropdown
  KPApi.getServices()
    .then((services) => {
      serviceSelect.innerHTML =
        '<option value="">Not sure / general consultation</option>' +
        services
          .map((s) => `<option value="${s.id}">${escapeHtml(s.title)}</option>`)
          .join('');
    })
    .catch(() => {
      // keep default option
    });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageBox.className = 'kp-form-message';
    messageBox.textContent = '';

    const payload = {
      branch_id: Number(form.branch_id.value) || null,
      doctor_id: form.doctor_id.value ? Number(form.doctor_id.value) : null,
      service_id: form.service_id.value ? Number(form.service_id.value) : null,
      patient_name: form.patient_name.value.trim(),
      phone: form.phone.value.trim(),
      ic_number: form.ic_number.value.trim() || null,
      preferred_date: form.preferred_date.value,
      preferred_time: form.preferred_time.value,
      reason: form.reason.value.trim() || null,
    };

    if (
      !payload.branch_id ||
      !payload.patient_name ||
      !payload.phone ||
      !payload.preferred_date ||
      !payload.preferred_time
    ) {
      messageBox.textContent = 'Please fill in all required fields (*).';
      messageBox.className = 'kp-form-message error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await KPApi.createBooking(payload);
      messageBox.textContent = res.message || 'Appointment request sent!';
      messageBox.className = 'kp-form-message success';

      form.reset();

      // Reset doctor dropdown after form reset
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
    } catch (err) {
      messageBox.textContent = err.message || 'Something went wrong. Please try again.';
      messageBox.className = 'kp-form-message error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request appointment';
    }
  });
}
// ------------------------------------------------------------
// FEEDBACK: display approved reviews + submission form
// ------------------------------------------------------------
function initFeedback() {
  const grid = document.getElementById('feedbackGrid');
  const form = document.getElementById('feedbackForm');

  if (grid) {
    KPApi.getApprovedFeedback()
      .then((items) => {
        if (!items.length) {
          grid.innerHTML = '<p class="doctor-empty">No reviews yet. Be the first to share your experience!</p>';
          return;
        }

        grid.innerHTML = items.map((f) => `
          <div class="feedback-card">
            <div class="stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</div>
            <p class="msg">"${escapeHtml(f.message)}"</p>
            <div class="who">${escapeHtml(f.patient_name)}</div>
            ${f.branch_name ? `<div class="branch">${escapeHtml(f.branch_name)}</div>` : ''}
          </div>
        `).join('');
      })
      .catch((err) => {
        grid.innerHTML = `<p class="doctor-error">Could not load feedback: ${escapeHtml(err.message)}</p>`;
      });
  }

  if (!form) return;

  const branchSelect = document.getElementById('fb-branch');
  const messageBox = document.getElementById('feedbackFormMessage');
  const submitBtn = document.getElementById('feedbackSubmitBtn');

  // Load branch list into feedback form
  if (branchSelect) {
    KPApi.getBranches()
      .then((branches) => {
        branchSelect.innerHTML =
          '<option value="">Select branch</option>' +
          branches
            .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
            .join('');
      })
      .catch(() => {
        branchSelect.innerHTML = '<option value="">Could not load branches</option>';
      });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const res = await KPApi.createFeedback(payload);

      messageBox.textContent = res.message || 'Thank you for your feedback!';
      messageBox.className = 'kp-form-message success';

      form.reset();

      if (branchSelect) {
        branchSelect.value = '';
      }
    } catch (err) {
      messageBox.textContent = err.message || 'Something went wrong. Please try again.';
      messageBox.className = 'kp-form-message error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit feedback';
    }
  });
}
