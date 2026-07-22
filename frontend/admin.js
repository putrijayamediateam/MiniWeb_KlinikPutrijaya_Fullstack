'use strict';

// Full replacement for the existing frontend/admin.js.
// Requires frontend/js/api.js to load first.

const TOKEN_KEY = 'kp_admin_token';
const USERNAME_KEY = 'kp_admin_username';

let authedApi = null;
let branchesCache = [];
let doctorsCache = [];
let servicesCache = [];
let promotionsCache = [];

const bookingState = {
  page: 1,
  limit: 20,
};

const feedbackState = {
  page: 1,
  limit: 20,
};

document.addEventListener('DOMContentLoaded', () => {
  bindCoreEvents();
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    enterDashboard(token, sessionStorage.getItem(USERNAME_KEY) || 'admin');
  }
});

function bindCoreEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  document.getElementById('bookingStatusFilter')?.addEventListener('change', () => {
    bookingState.page = 1;
    loadBookings();
  });

  document.getElementById('bookingBranchFilter')?.addEventListener('change', () => {
    bookingState.page = 1;
    loadBookings();
  });

  document.getElementById('bookingSearchInput')?.addEventListener('input', debounce(() => {
    bookingState.page = 1;
    loadBookings();
  }, 350));

  document.getElementById('feedbackStatusFilter')?.addEventListener('change', () => {
    feedbackState.page = 1;
    loadFeedback();
  });

  document.getElementById('feedbackSearchInput')?.addEventListener('input', debounce(() => {
    feedbackState.page = 1;
    loadFeedback();
  }, 350));

  document.getElementById('exportBookingsBtn')?.addEventListener('click', exportBookingsToCSV);
  document.getElementById('addDoctorBtn')?.addEventListener('click', () => openDoctorModal());
  document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceModal());
  document.getElementById('addPromotionBtn')?.addEventListener('click', () => openPromotionModal());
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);

  document.getElementById('modalBackdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'modalBackdrop') closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}


async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('loginUsername')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';
  const messageBox = document.getElementById('loginMessage');
  const button = document.getElementById('loginBtn');

  setMessage(messageBox, '');
  setButtonLoading(button, true, 'Logging in…');

  try {
    const response = await KPApi.login(username, password);
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(USERNAME_KEY, response.username);
    enterDashboard(response.token, response.username);
  } catch (error) {
    setMessage(messageBox, error.message || 'Login failed.', 'error');
  } finally {
    setButtonLoading(button, false, 'Log in');
  }
}

function handleLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  authedApi = null;
  setApprovalsAccess(false);
  document.getElementById('dashboard')?.classList.add('hidden');
  document.getElementById('loginScreen')?.classList.remove('hidden');
}

async function enterDashboard(token, username) {
  authedApi = KPApi.withAuth(token);
  const usernameTarget = document.getElementById('adminUsername');
  if (usernameTarget) usernameTarget.textContent = username;

  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('dashboard')?.classList.remove('hidden');

  try {
    const profile = await authedApi.getMyAdminProfile();
    setApprovalsAccess(String(profile.role || '').toLowerCase() === 'superadmin');
  } catch (error) {
    console.warn('Could not load admin profile:', error);
    setApprovalsAccess(false);
  }

  try {
    branchesCache = await KPApi.getBranches();
    populateBookingBranchFilter();
  } catch (error) {
    console.warn('Could not load branches:', error);
  }

  await Promise.allSettled([
    loadBookings(),
    loadFeedback(),
    loadDoctors(),
    loadServices(),
    loadPromotions(),
  ]);
}

function setApprovalsAccess(isSuperadmin) {
  const approvalsLink = document.getElementById('approvalsLink');
  if (!approvalsLink) return;
  approvalsLink.classList.toggle('hidden', !isSuperadmin);
  approvalsLink.hidden = !isSuperadmin;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
}

function handleAuthError(error) {
  if (error?.status === 401 || /token|expired|authentication/i.test(error?.message || '')) {
    alert('Your session has expired. Please log in again.');
    handleLogout();
    return true;
  }
  return false;
}

function populateBookingBranchFilter() {
  const select = document.getElementById('bookingBranchFilter');
  if (!select) return;

  select.innerHTML = [
    '<option value="">All branches</option>',
    ...branchesCache.map((branch) => (
      `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`
    )),
  ].join('');
}

// -----------------------------------------------------------------------------
// BOOKINGS: server-side pagination, filtering and notifications
// -----------------------------------------------------------------------------

async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody || !authedApi) return;

  tbody.innerHTML = '<tr><td colspan="11" class="loading-row">Loading…</td></tr>';

  const params = {
    page: bookingState.page,
    limit: bookingState.limit,
    status: document.getElementById('bookingStatusFilter')?.value || '',
    branch: document.getElementById('bookingBranchFilter')?.value || '',
    q: document.getElementById('bookingSearchInput')?.value.trim() || '',
  };

  try {
    const response = await authedApi.getBookings(params);
    renderBookingSummary(response.summary || {});
    renderBookings(response.data || []);
    renderPager(
      document.getElementById('bookingsPager'),
      response.pagination,
      (page) => {
        bookingState.page = page;
        loadBookings();
      }
    );
  } catch (error) {
    if (!handleAuthError(error)) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderBookingSummary(summary) {
  setText('summaryTotal', summary.total || 0);
  setText('summaryPending', summary.pending || 0);
  setText('summaryConfirmed', summary.confirmed || 0);
  setText('summaryCompleted', summary.completed || 0);
  setText('summaryCancelled', summary.cancelled || 0);
}

function renderBookings(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-row">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map((booking) => {
    const whatsappLink = buildWhatsappLink(booking);
    const emailStatus = booking.confirmation_email_sent_at ? 'Email sent' : 'Email pending';
    const smsStatus = booking.confirmation_sms_sent_at ? 'SMS sent' : 'SMS pending';

    return `
      <tr data-id="${booking.id}">
        <td><span class="booking-ref">${formatBookingRef(booking.id)}</span></td>
        <td>
          <strong>${escapeHtml(booking.patient_name)}</strong>
          ${booking.email ? `<div class="cell-subtext">${escapeHtml(booking.email)}</div>` : ''}
        </td>
        <td>${escapeHtml(booking.phone)}</td>
        <td>${escapeHtml(booking.branch_name || '—')}</td>
        <td>${escapeHtml(booking.doctor_name || '—')}</td>
        <td>${escapeHtml(booking.service_title || '—')}</td>
        <td>${formatDate(booking.preferred_date)}</td>
        <td>${escapeHtml(booking.preferred_time || '—')}</td>
        <td class="reason-col">
          <div class="reason-text">${escapeHtml(booking.reason || '—')}</div>
          <div class="notification-mini" title="${escapeAttribute(booking.notification_error || '')}">
            ${escapeHtml(emailStatus)} · ${escapeHtml(smsStatus)}
          </div>
        </td>
        <td>
          <select class="status-select status-${escapeAttribute(booking.status)}" data-id="${booking.id}">
            ${statusOption('pending', booking.status, 'Pending Review')}
            ${statusOption('confirmed', booking.status, 'Confirmed')}
            ${statusOption('completed', booking.status, 'Completed')}
            ${statusOption('cancelled', booking.status, 'Cancelled')}
          </select>
        </td>
        <td>
          <div class="booking-actions">
            ${whatsappLink ? `<a class="btn-small" href="${escapeAttribute(whatsappLink)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            <button class="btn-small danger" type="button" data-action="delete-booking" data-id="${booking.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const previous = select.dataset.previous || '';
      select.disabled = true;

      try {
        const response = await authedApi.updateBookingStatus(select.dataset.id, select.value);
        select.dataset.previous = select.value;
        select.className = `status-select status-${select.value}`;

        if (select.value === 'confirmed') {
          const notices = [];
          if (response.notification?.email?.sent) notices.push('email sent');
          if (response.notification?.sms?.sent) notices.push('SMS sent');
          if (notices.length) alert(`Booking confirmed: ${notices.join(' and ')}.`);
        }

        await loadBookings();
      } catch (error) {
        if (!handleAuthError(error)) alert(`Failed to update status: ${error.message}`);
        if (previous) select.value = previous;
      } finally {
        select.disabled = false;
      }
    });
    select.dataset.previous = select.value;
  });

  tbody.querySelectorAll('[data-action="delete-booking"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this booking permanently?')) return;
      try {
        await authedApi.deleteBooking(button.dataset.id);
        await loadBookings();
      } catch (error) {
        if (!handleAuthError(error)) alert(`Failed to delete booking: ${error.message}`);
      }
    });
  });
}

async function exportBookingsToCSV() {
  if (!authedApi) return;

  try {
    const response = await authedApi.getBookings({
      page: 1,
      limit: 500,
      status: document.getElementById('bookingStatusFilter')?.value || '',
      branch: document.getElementById('bookingBranchFilter')?.value || '',
      q: document.getElementById('bookingSearchInput')?.value.trim() || '',
    });

    const bookings = response.data || [];
    if (!bookings.length) {
      alert('No booking data to export.');
      return;
    }

    const headers = [
      'Reference', 'Patient Name', 'Phone', 'Email', 'Branch', 'Doctor',
      'Service', 'Preferred Date', 'Preferred Time', 'Reason', 'Status',
    ];

    const rows = bookings.map((booking) => [
      formatBookingRef(booking.id),
      booking.patient_name || '',
      booking.phone || '',
      booking.email || '',
      booking.branch_name || '',
      booking.doctor_name || '',
      booking.service_title || '',
      formatDate(booking.preferred_date),
      booking.preferred_time || '',
      booking.reason || '',
      booking.status || '',
    ]);

    downloadCsv(`klinik-putrijaya-bookings-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
  } catch (error) {
    if (!handleAuthError(error)) alert(`Unable to export bookings: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// FEEDBACK: server-side pagination
// -----------------------------------------------------------------------------

async function loadFeedback() {
  const tbody = document.getElementById('feedbackTableBody');
  if (!tbody || !authedApi) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    const response = await authedApi.getAllFeedback({
      page: feedbackState.page,
      limit: feedbackState.limit,
      status: document.getElementById('feedbackStatusFilter')?.value || '',
      q: document.getElementById('feedbackSearchInput')?.value.trim() || '',
    });

    const items = response.data || [];

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No feedback found.</td></tr>';
    } else {
      tbody.innerHTML = items.map((feedback) => `
        <tr data-id="${feedback.id}">
          <td>${escapeHtml(feedback.patient_name)}</td>
          <td>${escapeHtml(feedback.branch_name || '—')}</td>
          <td>${'★'.repeat(Number(feedback.rating))}${'☆'.repeat(5 - Number(feedback.rating))}</td>
          <td class="wrap-text">${escapeHtml(feedback.message)}</td>
          <td><span class="status-pill ${Number(feedback.is_approved) ? 'status-confirmed' : 'status-pending'}">${Number(feedback.is_approved) ? 'Approved' : 'Pending'}</span></td>
          <td>
            ${!Number(feedback.is_approved) ? `<button class="btn-small" type="button" data-action="approve-feedback" data-id="${feedback.id}">Approve</button>` : ''}
            <button class="btn-small danger" type="button" data-action="delete-feedback" data-id="${feedback.id}">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    renderPager(
      document.getElementById('feedbackPager'),
      response.pagination,
      (page) => {
        feedbackState.page = page;
        loadFeedback();
      }
    );

    tbody.querySelectorAll('[data-action="approve-feedback"]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await authedApi.approveFeedback(button.dataset.id);
          await loadFeedback();
        } catch (error) {
          if (!handleAuthError(error)) alert(`Failed to approve feedback: ${error.message}`);
        }
      });
    });

    tbody.querySelectorAll('[data-action="delete-feedback"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this feedback?')) return;
        try {
          await authedApi.deleteFeedback(button.dataset.id);
          await loadFeedback();
        } catch (error) {
          if (!handleAuthError(error)) alert(`Failed to delete feedback: ${error.message}`);
        }
      });
    });
  } catch (error) {
    if (!handleAuthError(error)) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

// -----------------------------------------------------------------------------
// DOCTORS: real photo upload with preview
// -----------------------------------------------------------------------------

async function loadDoctors() {
  const tbody = document.getElementById('doctorsTableBody');
  if (!tbody || !authedApi) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    doctorsCache = await authedApi.getAdminDoctors();

    if (!doctorsCache.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No doctors found.</td></tr>';
      return;
    }

    tbody.innerHTML = doctorsCache.map((doctor) => `
      <tr data-id="${doctor.id}">
        <td>
          <div class="doctor-admin-cell">
            ${doctor.photo_url ? `<img src="${escapeAttribute(resolveImageUrl(doctor.photo_url))}" alt="">` : '<span class="doctor-admin-placeholder">DR</span>'}
            <strong>${escapeHtml(doctor.name)}</strong>
          </div>
        </td>
        <td>${escapeHtml(doctor.branch_name)}</td>
        <td class="wrap-text">${escapeHtml(doctor.qualification)}</td>
        <td>${escapeHtml(doctor.reg_no)}</td>
        <td>${Number(doctor.is_active) ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn-small" type="button" data-action="edit-doctor" data-id="${doctor.id}">Edit</button>
          <button class="btn-small danger" type="button" data-action="delete-doctor" data-id="${doctor.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-doctor"]').forEach((button) => {
      button.addEventListener('click', () => {
        openDoctorModal(doctorsCache.find((doctor) => String(doctor.id) === button.dataset.id));
      });
    });

    tbody.querySelectorAll('[data-action="delete-doctor"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this doctor? Use inactive status if the doctor has previous bookings.')) return;
        try {
          await authedApi.deleteDoctor(button.dataset.id);
          await loadDoctors();
        } catch (error) {
          if (!handleAuthError(error)) alert(`Failed to delete doctor: ${error.message}`);
        }
      });
    });
  } catch (error) {
    if (!handleAuthError(error)) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function openDoctorModal(doctor = null) {
  const isEdit = Boolean(doctor);

  showModal(isEdit ? 'Edit doctor' : 'Add doctor', `
    <div class="admin-form-grid two-column">
      <label>
        <span>Branch</span>
        <select id="m-doctor-branch" required>
          ${branchesCache.map((branch) => `<option value="${branch.id}" ${doctor && Number(doctor.branch_id) === Number(branch.id) ? 'selected' : ''}>${escapeHtml(branch.name)}</option>`).join('')}
        </select>
      </label>

      <label>
        <span>Registration number</span>
        <input id="m-doctor-reg" type="text" value="${escapeAttribute(doctor?.reg_no || '')}" required>
      </label>
    </div>

    <label>
      <span>Doctor name</span>
      <input id="m-doctor-name" type="text" value="${escapeAttribute(doctor?.name || '')}" required>
    </label>

    <label>
      <span>Qualification</span>
      <textarea id="m-doctor-qualification" rows="4" required>${escapeHtml(doctor?.qualification || '')}</textarea>
    </label>

    <div class="admin-upload-field">
      <label for="m-doctor-photo">Doctor photo</label>
      <input id="m-doctor-photo" type="file" accept="image/jpeg,image/png,image/webp">
      <input id="m-doctor-photo-url" type="hidden" value="${escapeAttribute(doctor?.photo_url || '')}">
      <div class="upload-help">JPEG, PNG or WebP. Maximum 5 MB. Portrait images work best.</div>
      <img id="m-doctor-preview" class="admin-image-preview portrait ${doctor?.photo_url ? '' : 'hidden'}" src="${doctor?.photo_url ? escapeAttribute(resolveImageUrl(doctor.photo_url)) : ''}" alt="Doctor photo preview">
    </div>

    <label>
      <span>Active</span>
      <select id="m-doctor-active">
        <option value="1" ${!doctor || Number(doctor.is_active) ? 'selected' : ''}>Yes</option>
        <option value="0" ${doctor && !Number(doctor.is_active) ? 'selected' : ''}>No</option>
      </select>
    </label>

    <div id="modalFormMessage" class="form-message"></div>
    <div class="modal-actions">
      <button class="btn-primary" type="submit">${isEdit ? 'Save changes' : 'Add doctor'}</button>
    </div>
  `, async (event) => {
    event.preventDefault();
    const message = document.getElementById('modalFormMessage');
    const fileInput = document.getElementById('m-doctor-photo');
    let photoUrl = document.getElementById('m-doctor-photo-url').value.trim() || null;

    try {
      if (fileInput.files[0]) {
        const upload = await authedApi.uploadImage(fileInput.files[0], 'doctors');
        photoUrl = upload.url;
      }

      const payload = {
        branch_id: Number(document.getElementById('m-doctor-branch').value),
        name: document.getElementById('m-doctor-name').value.trim(),
        qualification: document.getElementById('m-doctor-qualification').value.trim(),
        reg_no: document.getElementById('m-doctor-reg').value.trim(),
        photo_url: photoUrl,
        is_active: Number(document.getElementById('m-doctor-active').value),
      };

      if (isEdit) {
        await authedApi.updateDoctor(doctor.id, payload);
      } else {
        await authedApi.createDoctor(payload);
      }

      closeModal();
      await loadDoctors();
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-doctor-photo', 'm-doctor-preview');
}

// -----------------------------------------------------------------------------
// SERVICES: detail page content, hero image, prices and gallery
// -----------------------------------------------------------------------------

async function loadServices() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody || !authedApi) return;

  tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Loading…</td></tr>';

  try {
    servicesCache = await authedApi.getAdminServices();

    if (!servicesCache.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No services found.</td></tr>';
      return;
    }

    tbody.innerHTML = servicesCache.map((service) => `
      <tr data-id="${service.id}">
        <td>
          <strong>${escapeHtml(formatCategory(service.category_key))}</strong>
          <div class="cell-subtext">Order ${Number(service.sort_order || 0)}</div>
        </td>
        <td>
          <strong>${escapeHtml(service.title)}</strong>
          <div class="cell-subtext">/${escapeHtml(service.slug)}</div>
        </td>
        <td class="wrap-text">
          ${escapeHtml(service.description || '—')}
          <div class="cell-subtext">${Number(service.price_count || 0)} price item(s) · ${Number(service.gallery_count || 0)} image(s)</div>
        </td>
        <td>${Number(service.is_active) ? 'Yes' : 'No'}</td>
        <td>
          <div class="table-action-stack">
            <button class="btn-small" type="button" data-action="edit-service" data-id="${service.id}">Edit details</button>
            <button class="btn-small" type="button" data-action="manage-prices" data-id="${service.id}">Prices</button>
            <button class="btn-small" type="button" data-action="manage-gallery" data-id="${service.id}">Gallery</button>
            <a class="btn-small" href="service-detail.html?slug=${encodeURIComponent(service.slug)}" target="_blank" rel="noopener">Preview</a>
            <button class="btn-small danger" type="button" data-action="delete-service" data-id="${service.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-service"]').forEach((button) => {
      button.addEventListener('click', () => {
        openServiceModal(servicesCache.find((service) => String(service.id) === button.dataset.id));
      });
    });

    tbody.querySelectorAll('[data-action="manage-prices"]').forEach((button) => {
      button.addEventListener('click', () => openPriceManager(Number(button.dataset.id)));
    });

    tbody.querySelectorAll('[data-action="manage-gallery"]').forEach((button) => {
      button.addEventListener('click', () => openGalleryManager(Number(button.dataset.id)));
    });

    tbody.querySelectorAll('[data-action="delete-service"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this service, its price list and gallery?')) return;
        try {
          await authedApi.deleteService(button.dataset.id);
          await loadServices();
        } catch (error) {
          if (!handleAuthError(error)) alert(`Failed to delete service: ${error.message}`);
        }
      });
    });
  } catch (error) {
    if (!handleAuthError(error)) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function openServiceModal(service = null) {
  const isEdit = Boolean(service);

  showModal(isEdit ? 'Edit service details' : 'Add service', `
    <div class="admin-form-grid two-column">
      <label>
        <span>Category key</span>
        <input id="m-service-category" type="text" value="${escapeAttribute(service?.category_key || '')}" placeholder="women, general, treatment…" required>
      </label>
      <label>
        <span>Display order</span>
        <input id="m-service-order" type="number" value="${Number(service?.sort_order || 0)}">
      </label>
    </div>

    <div class="admin-form-grid two-column">
      <label>
        <span>Service title</span>
        <input id="m-service-title" type="text" value="${escapeAttribute(service?.title || '')}" required>
      </label>
      <label>
        <span>URL slug</span>
        <input id="m-service-slug" type="text" value="${escapeAttribute(service?.slug || '')}" placeholder="anomaly-scan">
      </label>
    </div>

    <label>
      <span>Kicker / short label</span>
      <input id="m-service-kicker" type="text" value="${escapeAttribute(service?.kicker || '')}">
    </label>

    <label>
      <span>Short card description</span>
      <textarea id="m-service-description" rows="3">${escapeHtml(service?.description || '')}</textarea>
    </label>

    <label>
      <span>Full service description</span>
      <textarea id="m-service-full" rows="7">${escapeHtml(service?.full_description || '')}</textarea>
    </label>

    <div class="admin-form-grid two-column">
      <label>
        <span>Suitable for — one item per line</span>
        <textarea id="m-service-suitable" rows="6">${escapeHtml(service?.suitable_for || '')}</textarea>
      </label>
      <label>
        <span>What is included — one item per line</span>
        <textarea id="m-service-included" rows="6">${escapeHtml(service?.included_items || '')}</textarea>
      </label>
    </div>

    <div class="admin-form-grid two-column">
      <label>
        <span>Preparation — one item per line</span>
        <textarea id="m-service-preparation" rows="6">${escapeHtml(service?.preparation || '')}</textarea>
      </label>
      <label>
        <span>Aftercare — one item per line</span>
        <textarea id="m-service-aftercare" rows="6">${escapeHtml(service?.aftercare || '')}</textarea>
      </label>
    </div>

    <div class="admin-upload-field">
      <label for="m-service-hero">Hero image</label>
      <input id="m-service-hero" type="file" accept="image/jpeg,image/png,image/webp">
      <input id="m-service-hero-url" type="hidden" value="${escapeAttribute(service?.hero_image_url || '')}">
      <div class="upload-help">The image is used on the service card and detail page.</div>
      <img id="m-service-hero-preview" class="admin-image-preview landscape ${service?.hero_image_url ? '' : 'hidden'}" src="${service?.hero_image_url ? escapeAttribute(resolveImageUrl(service.hero_image_url)) : ''}" alt="Service hero preview">
    </div>

    <label>
      <span>Active</span>
      <select id="m-service-active">
        <option value="1" ${!service || Number(service.is_active) ? 'selected' : ''}>Yes</option>
        <option value="0" ${service && !Number(service.is_active) ? 'selected' : ''}>No</option>
      </select>
    </label>

    <div id="modalFormMessage" class="form-message"></div>
    <div class="modal-actions">
      <button class="btn-primary" type="submit">${isEdit ? 'Save service' : 'Create service'}</button>
    </div>
  `, async (event) => {
    event.preventDefault();
    const message = document.getElementById('modalFormMessage');
    const heroInput = document.getElementById('m-service-hero');
    let heroUrl = document.getElementById('m-service-hero-url').value.trim() || null;

    try {
      if (heroInput.files[0]) {
        const upload = await authedApi.uploadImage(heroInput.files[0], 'services');
        heroUrl = upload.url;
      }

      const payload = {
        category_key: document.getElementById('m-service-category').value.trim(),
        title: document.getElementById('m-service-title').value.trim(),
        slug: document.getElementById('m-service-slug').value.trim(),
        kicker: document.getElementById('m-service-kicker').value.trim() || null,
        description: document.getElementById('m-service-description').value.trim() || null,
        full_description: document.getElementById('m-service-full').value.trim() || null,
        suitable_for: document.getElementById('m-service-suitable').value.trim() || null,
        included_items: document.getElementById('m-service-included').value.trim() || null,
        preparation: document.getElementById('m-service-preparation').value.trim() || null,
        aftercare: document.getElementById('m-service-aftercare').value.trim() || null,
        hero_image_url: heroUrl,
        sort_order: Number(document.getElementById('m-service-order').value || 0),
        is_active: Number(document.getElementById('m-service-active').value),
      };

      let savedId = service?.id;
      if (isEdit) {
        await authedApi.updateService(service.id, payload);
      } else {
        const response = await authedApi.createService(payload);
        savedId = response.id;
      }

      closeModal();
      await loadServices();

      if (!isEdit && savedId) {
        const addPriceNow = confirm('Service created. Add its price list now?');
        if (addPriceNow) openPriceManager(savedId);
      }
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-service-hero', 'm-service-hero-preview');
  bindSlugGenerator('m-service-title', 'm-service-slug', !isEdit);
}

async function openPriceManager(serviceId) {
  try {
    const service = await authedApi.getAdminService(serviceId);
    renderPriceManager(service);
  } catch (error) {
    if (!handleAuthError(error)) alert(`Unable to load prices: ${error.message}`);
  }
}

function renderPriceManager(service) {
  showModal(`Price list · ${service.title}`, `
    <div class="manager-list" id="priceManagerList">
      ${(service.prices || []).length ? service.prices.map((price) => `
        <article class="manager-row">
          <div>
            <strong>${escapeHtml(price.package_name)}</strong>
            <p>${escapeHtml(price.package_description || 'No description')}</p>
            <small>${Number(price.is_active) ? 'Active' : 'Inactive'} · Order ${Number(price.sort_order || 0)}</small>
          </div>
          <div class="manager-row-end">
            <strong>${formatMoney(price.price)}</strong>
            ${price.original_price ? `<del>${formatMoney(price.original_price)}</del>` : ''}
            <button class="btn-small" type="button" data-edit-price="${price.id}">Edit</button>
            <button class="btn-small danger" type="button" data-delete-price="${price.id}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="manager-empty">No prices added yet.</div>'}
    </div>

    <hr class="modal-divider">
    <h3 id="priceFormHeading">Add price item</h3>
    <input id="m-price-id" type="hidden">

    <label><span>Package name</span><input id="m-price-name" type="text" required></label>
    <label><span>Description</span><textarea id="m-price-description" rows="3"></textarea></label>

    <div class="admin-form-grid three-column">
      <label><span>Current price (RM)</span><input id="m-price-value" type="number" min="0" step="0.01" required></label>
      <label><span>Original price (RM)</span><input id="m-price-original" type="number" min="0" step="0.01"></label>
      <label><span>Order</span><input id="m-price-order" type="number" value="0"></label>
    </div>

    <label>
      <span>Active</span>
      <select id="m-price-active"><option value="1">Yes</option><option value="0">No</option></select>
    </label>

    <div id="modalFormMessage" class="form-message"></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="priceFormCancel" type="button">Clear form</button>
      <button class="btn-primary" type="submit">Save price</button>
    </div>
  `, async (event) => {
    event.preventDefault();
    const message = document.getElementById('modalFormMessage');
    const priceId = document.getElementById('m-price-id').value;
    const payload = {
      package_name: document.getElementById('m-price-name').value.trim(),
      package_description: document.getElementById('m-price-description').value.trim() || null,
      price: Number(document.getElementById('m-price-value').value),
      original_price: document.getElementById('m-price-original').value === '' ? null : Number(document.getElementById('m-price-original').value),
      sort_order: Number(document.getElementById('m-price-order').value || 0),
      is_active: Number(document.getElementById('m-price-active').value),
    };

    try {
      if (priceId) {
        await authedApi.updateServicePrice(priceId, payload);
      } else {
        await authedApi.createServicePrice(service.id, payload);
      }
      await openPriceManager(service.id);
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  document.getElementById('priceFormCancel')?.addEventListener('click', clearPriceForm);

  document.querySelectorAll('[data-edit-price]').forEach((button) => {
    button.addEventListener('click', () => {
      const price = service.prices.find((item) => String(item.id) === button.dataset.editPrice);
      if (!price) return;
      document.getElementById('priceFormHeading').textContent = 'Edit price item';
      document.getElementById('m-price-id').value = price.id;
      document.getElementById('m-price-name').value = price.package_name || '';
      document.getElementById('m-price-description').value = price.package_description || '';
      document.getElementById('m-price-value').value = price.price;
      document.getElementById('m-price-original').value = price.original_price ?? '';
      document.getElementById('m-price-order').value = price.sort_order || 0;
      document.getElementById('m-price-active').value = Number(price.is_active) ? '1' : '0';
      document.getElementById('m-price-name').focus();
    });
  });

  document.querySelectorAll('[data-delete-price]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this price item?')) return;
      try {
        await authedApi.deleteServicePrice(button.dataset.deletePrice);
        await openPriceManager(service.id);
      } catch (error) {
        if (!handleAuthError(error)) alert(`Unable to delete price: ${error.message}`);
      }
    });
  });
}

function clearPriceForm() {
  setText('priceFormHeading', 'Add price item');
  ['m-price-id', 'm-price-name', 'm-price-description', 'm-price-value', 'm-price-original'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  const order = document.getElementById('m-price-order');
  if (order) order.value = '0';
  const active = document.getElementById('m-price-active');
  if (active) active.value = '1';
}

async function openGalleryManager(serviceId) {
  try {
    const service = await authedApi.getAdminService(serviceId);
    renderGalleryManager(service);
  } catch (error) {
    if (!handleAuthError(error)) alert(`Unable to load gallery: ${error.message}`);
  }
}

function renderGalleryManager(service) {
  showModal(`Gallery · ${service.title}`, `
    <div class="gallery-manager-grid">
      ${(service.gallery || []).length ? service.gallery.map((image) => `
        <article class="gallery-manager-card">
          <img src="${escapeAttribute(resolveImageUrl(image.image_url))}" alt="${escapeAttribute(image.alt_text || '')}">
          <div>
            <strong>${escapeHtml(image.caption || 'No caption')}</strong>
            <small>${Number(image.is_active) ? 'Active' : 'Inactive'} · Order ${Number(image.sort_order || 0)}</small>
            <button class="btn-small danger" type="button" data-delete-gallery="${image.id}">Delete</button>
          </div>
        </article>
      `).join('') : '<div class="manager-empty">No gallery images added yet.</div>'}
    </div>

    <hr class="modal-divider">
    <h3>Add gallery image</h3>

    <div class="admin-upload-field">
      <label for="m-gallery-file">Image</label>
      <input id="m-gallery-file" type="file" accept="image/jpeg,image/png,image/webp" required>
      <img id="m-gallery-preview" class="admin-image-preview landscape hidden" src="" alt="Gallery preview">
    </div>

    <label><span>Caption</span><input id="m-gallery-caption" type="text"></label>
    <label><span>Alternative text</span><input id="m-gallery-alt" type="text" placeholder="Describe the image for accessibility"></label>

    <div class="admin-form-grid two-column">
      <label><span>Order</span><input id="m-gallery-order" type="number" value="0"></label>
      <label><span>Active</span><select id="m-gallery-active"><option value="1">Yes</option><option value="0">No</option></select></label>
    </div>

    <div id="modalFormMessage" class="form-message"></div>
    <div class="modal-actions"><button class="btn-primary" type="submit">Upload image</button></div>
  `, async (event) => {
    event.preventDefault();
    const message = document.getElementById('modalFormMessage');
    const file = document.getElementById('m-gallery-file').files[0];

    if (!file) {
      setMessage(message, 'Please select an image.', 'error');
      return;
    }

    try {
      const upload = await authedApi.uploadImage(file, 'services');
      await authedApi.createGalleryItem(service.id, {
        image_url: upload.url,
        caption: document.getElementById('m-gallery-caption').value.trim() || null,
        alt_text: document.getElementById('m-gallery-alt').value.trim() || null,
        sort_order: Number(document.getElementById('m-gallery-order').value || 0),
        is_active: Number(document.getElementById('m-gallery-active').value),
      });
      await openGalleryManager(service.id);
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-gallery-file', 'm-gallery-preview');

  document.querySelectorAll('[data-delete-gallery]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this gallery image?')) return;
      try {
        await authedApi.deleteGalleryItem(button.dataset.deleteGallery);
        await openGalleryManager(service.id);
      } catch (error) {
        if (!handleAuthError(error)) alert(`Unable to delete gallery image: ${error.message}`);
      }
    });
  });
}

// -----------------------------------------------------------------------------
// PROMOTIONS: preserved from the existing dashboard
// -----------------------------------------------------------------------------

async function loadPromotions() {
  const tbody = document.getElementById('promotionsTableBody');
  if (!tbody || !authedApi?.getAdminPromotions) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    promotionsCache = await authedApi.getAdminPromotions();

    if (!promotionsCache.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No promotions found.</td></tr>';
      return;
    }

    tbody.innerHTML = promotionsCache.map((promotion) => `
      <tr>
        <td>${Number(promotion.display_order || 0)}</td>
        <td>${escapeHtml(promotion.badge || '—')}</td>
        <td>${escapeHtml(promotion.title)}</td>
        <td class="wrap-text">${escapeHtml(promotion.description || '—')}</td>
        <td>${Number(promotion.is_active) ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn-small" type="button" data-edit-promotion="${promotion.id}">Edit</button>
          <button class="btn-small danger" type="button" data-delete-promotion="${promotion.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-promotion]').forEach((button) => {
      button.addEventListener('click', () => {
        openPromotionModal(promotionsCache.find((promotion) => String(promotion.id) === button.dataset.editPromotion));
      });
    });

    tbody.querySelectorAll('[data-delete-promotion]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this promotion?')) return;
        try {
          await authedApi.deletePromotion(button.dataset.deletePromotion);
          await loadPromotions();
        } catch (error) {
          if (!handleAuthError(error)) alert(`Failed to delete promotion: ${error.message}`);
        }
      });
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
  }
}

function openPromotionModal(promotion = null) {
  const isEdit = Boolean(promotion);

  showModal(isEdit ? 'Edit promotion' : 'Add promotion', `
    <div class="admin-form-grid two-column">
      <label><span>Badge</span><input id="m-promo-badge" type="text" value="${escapeAttribute(promotion?.badge || '')}"></label>
      <label><span>Display order</span><input id="m-promo-order" type="number" value="${Number(promotion?.display_order || 0)}"></label>
    </div>
    <label><span>Title</span><input id="m-promo-title" type="text" value="${escapeAttribute(promotion?.title || '')}" required></label>
    <label><span>Description</span><textarea id="m-promo-description" rows="4">${escapeHtml(promotion?.description || '')}</textarea></label>
    <label><span>Details — one item per line</span><textarea id="m-promo-details" rows="6">${escapeHtml(promotion?.details || '')}</textarea></label>
    <div class="admin-form-grid two-column">
      <label><span>CTA label</span><input id="m-promo-cta-label" type="text" value="${escapeAttribute(promotion?.cta_label || '')}"></label>
      <label><span>CTA link</span><input id="m-promo-cta-link" type="url" value="${escapeAttribute(promotion?.cta_link || '')}"></label>
    </div>
    <div class="admin-upload-field">
      <label for="m-promo-image">Poster image</label>
      <input id="m-promo-image" type="file" accept="image/jpeg,image/png,image/webp">
      <input id="m-promo-image-url" type="hidden" value="${escapeAttribute(promotion?.image_url || '')}">
      <img id="m-promo-preview" class="admin-image-preview portrait ${promotion?.image_url ? '' : 'hidden'}" src="${promotion?.image_url ? escapeAttribute(resolveImageUrl(promotion.image_url)) : ''}" alt="Promotion preview">
    </div>
    <label><span>Active</span><select id="m-promo-active"><option value="1" ${!promotion || Number(promotion.is_active) ? 'selected' : ''}>Yes</option><option value="0" ${promotion && !Number(promotion.is_active) ? 'selected' : ''}>No</option></select></label>
    <div id="modalFormMessage" class="form-message"></div>
    <div class="modal-actions"><button class="btn-primary" type="submit">${isEdit ? 'Save promotion' : 'Add promotion'}</button></div>
  `, async (event) => {
    event.preventDefault();
    const message = document.getElementById('modalFormMessage');
    const file = document.getElementById('m-promo-image').files[0];
    let imageUrl = document.getElementById('m-promo-image-url').value.trim() || null;

    try {
      if (file) {
        const upload = await authedApi.uploadImage(file, 'promotions');
        imageUrl = upload.url;
      }

      const payload = {
        badge: document.getElementById('m-promo-badge').value.trim() || null,
        title: document.getElementById('m-promo-title').value.trim(),
        description: document.getElementById('m-promo-description').value.trim() || null,
        details: document.getElementById('m-promo-details').value.trim() || null,
        cta_label: document.getElementById('m-promo-cta-label').value.trim() || null,
        cta_link: document.getElementById('m-promo-cta-link').value.trim() || null,
        image_url: imageUrl,
        display_order: Number(document.getElementById('m-promo-order').value || 0),
        is_active: Number(document.getElementById('m-promo-active').value),
      };

      if (isEdit) await authedApi.updatePromotion(promotion.id, payload);
      else await authedApi.createPromotion(payload);

      closeModal();
      await loadPromotions();
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-promo-image', 'm-promo-preview');
}

// -----------------------------------------------------------------------------
// MODAL + SHARED HELPERS
// -----------------------------------------------------------------------------

function showModal(title, formHtml, onSubmit) {
  const backdrop = document.getElementById('modalBackdrop');
  const titleElement = document.getElementById('modalTitle');
  const form = document.getElementById('modalForm');

  if (!backdrop || !titleElement || !form) {
    throw new Error('Admin modal HTML is missing from admin.html.');
  }

  titleElement.textContent = title;
  form.innerHTML = formHtml;
  form.onsubmit = onSubmit;
  backdrop.classList.remove('hidden');
  document.body.classList.add('admin-modal-open');
}

function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (!backdrop || backdrop.classList.contains('hidden')) return;
  backdrop.classList.add('hidden');
  document.body.classList.remove('admin-modal-open');
  const form = document.getElementById('modalForm');
  if (form) {
    form.innerHTML = '';
    form.onsubmit = null;
  }
}

function renderPager(container, pagination, onPage) {
  if (!container || !pagination) return;

  const page = Math.max(1, Number(pagination.page || 1));
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const total = Math.max(0, Number(pagination.total || 0));
  const limit = Math.max(1, Number(pagination.limit || 20));

  const start = total ? ((page - 1) * limit) + 1 : 0;
  const end = total ? Math.min(page * limit, total) : 0;

  container.innerHTML = `
    <span class="booking-showing-info">
      Showing ${start}–${end} of ${total}
    </span>

    <div class="pager-actions">
      <button
        type="button"
        data-page="${page - 1}"
        ${page <= 1 ? 'disabled' : ''}
      >
        Previous
      </button>

      <span class="pager-page-info">
        Page ${page} of ${totalPages}
      </span>

      <button
        type="button"
        data-page="${page + 1}"
        ${page >= totalPages ? 'disabled' : ''}
      >
        Next
      </button>
    </div>
  `;

  container.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      onPage(Number(button.dataset.page));
    });
  });
}

function bindImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  input?.addEventListener('change', () => {
    const file = input.files[0];
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
    preview.onload = () => URL.revokeObjectURL(url);
  });
}

function bindSlugGenerator(titleId, slugId, enabled) {
  if (!enabled) return;
  const title = document.getElementById(titleId);
  const slug = document.getElementById(slugId);
  let manuallyEdited = false;

  slug?.addEventListener('input', () => {
    manuallyEdited = slug.value.trim().length > 0;
  });

  title?.addEventListener('input', () => {
    if (!manuallyEdited && slug) slug.value = slugify(title.value);
  });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildWhatsappLink(booking) {
  const phone = normalizeMalaysiaPhone(booking.phone);
  if (!phone) return '';

  const message = [
    `Assalamualaikum / Hi ${booking.patient_name}, kami dari Klinik Putrijaya.`,
    '',
    `Reference: ${formatBookingRef(booking.id)}`,
    `Branch: ${booking.branch_name || '-'}`,
    `Date: ${formatDate(booking.preferred_date)}`,
    `Time: ${booking.preferred_time || '-'}`,
    '',
    'Boleh kami bantu confirmkan slot anda?',
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeMalaysiaPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `6${digits}`;
  if (digits.startsWith('1')) digits = `60${digits}`;
  return digits.startsWith('60') ? digits : '';
}

function statusOption(value, selected, label) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
}

function formatBookingRef(id) {
  return `KP-APT-${String(id).padStart(5, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('en-GB');
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value));
}

function formatCategory(value) {
  return String(value || 'General')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = new URL(KPApi.baseUrl).origin;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function setButtonLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = text;
}

function setMessage(element, message, type = '') {
  if (!element) return;
  element.textContent = message || '';
  element.className = `form-message${type ? ` ${type}` : ''}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttribute(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
