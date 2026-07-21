// ============================================================
// Klinik Putrijaya - Admin Dashboard logic
// Depends on js/api.js (KPApi) being loaded first.
// ============================================================

const TOKEN_KEY = 'kp_admin_token';
const USERNAME_KEY = 'kp_admin_username';

let authedApi = null;
let branchesCache = [];
let bookingsCache = [];

// ------------------------------------------------------------
// Auth / bootstrap
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    enterDashboard(token, sessionStorage.getItem(USERNAME_KEY) || 'admin');
  }

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('bookingStatusFilter')?.addEventListener('change', renderBookingsFromCache);
document.getElementById('bookingBranchFilter')?.addEventListener('change', renderBookingsFromCache);
document.getElementById('bookingSearchInput')?.addEventListener('input', renderBookingsFromCache);
document.getElementById('exportBookingsBtn')?.addEventListener('click', exportFilteredBookingsToCSV);
  document.getElementById('addDoctorBtn').addEventListener('click', () => openDoctorModal());
  document.getElementById('addServiceBtn').addEventListener('click', () => openServiceModal());
  document.getElementById('addPromotionBtn').addEventListener('click', () => openPromotionModal());
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
});

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const messageBox = document.getElementById('loginMessage');
  const btn = document.getElementById('loginBtn');

  messageBox.className = 'form-message';
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    const res = await KPApi.login(username, password);
    sessionStorage.setItem(TOKEN_KEY, res.token);
    sessionStorage.setItem(USERNAME_KEY, res.username);
    enterDashboard(res.token, res.username);
  } catch (err) {
    messageBox.textContent = err.message || 'Login failed.';
    messageBox.className = 'form-message error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log in';
  }
}

function handleLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  authedApi = null;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function enterDashboard(token, username) {
  authedApi = KPApi.withAuth(token);
  document.getElementById('adminUsername').textContent = username;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');

  KPApi.getBranches()
  .then((b) => {
    branchesCache = b;
    populateBookingBranchFilter();
  })
  .catch(() => {});

  loadBookings();
  loadFeedback();
  loadDoctors();
  loadServices();
  loadPromotions();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatBookingRef(id) {
  return `KP-APT-${String(id).padStart(5, '0')}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString('en-GB');
}

function normalizeMalaysiaPhone(phone) {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, '');

  if (digits.startsWith('0')) {
    digits = '6' + digits;
  }

  if (digits.startsWith('1')) {
    digits = '60' + digits;
  }

  if (!digits.startsWith('60')) {
    return null;
  }

  return digits;
}

function buildWhatsappLink(booking) {
  const phone = normalizeMalaysiaPhone(booking.phone);
  if (!phone) return null;

  const ref = formatBookingRef(booking.id);
  const date = booking.preferred_date ? formatDate(booking.preferred_date) : '';

  const message =
    `Assalamualaikum / Hi ${booking.patient_name}, kami dari Klinik Putrijaya.\n\n` +
    `Kami ingin mengesahkan permohonan appointment anda.\n\n` +
    `Reference: ${ref}\n` +
    `Branch: ${booking.branch_name || '-'}\n` +
    `Date: ${date}\n` +
    `Time: ${booking.preferred_time || '-'}\n\n` +
    `Boleh kami bantu confirmkan slot anda?`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function populateBookingBranchFilter() {
  const branchFilter = document.getElementById('bookingBranchFilter');
  if (!branchFilter) return;

  branchFilter.innerHTML =
    '<option value="">All branches</option>' +
    branchesCache
      .map((branch) => `<option value="${escapeHtml(branch.name)}">${escapeHtml(branch.name)}</option>`)
      .join('');
}

function normalizeMalaysiaPhone(phone) {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, '');

  // 0139887151 -> 60139887151
  if (digits.startsWith('0')) {
    digits = '6' + digits;
  }

  // 139887151 -> 60139887151
  if (digits.startsWith('1')) {
    digits = '60' + digits;
  }

  // 60139887151 stays same
  if (!digits.startsWith('60')) {
    return null;
  }

  return digits;
}

function buildWhatsappLink(booking) {
  const phone = normalizeMalaysiaPhone(booking.phone);
  if (!phone) return null;

  const date = booking.preferred_date
    ? new Date(booking.preferred_date).toLocaleDateString()
    : '';

  const message = `Assalamualaikum / Hi ${booking.patient_name}, kami dari Klinik Putrijaya. Kami ingin mengesahkan permohonan appointment anda di ${booking.branch_name} pada ${date} jam ${booking.preferred_time}. Boleh kami bantu confirmkan slot anda?`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function handleAuthError(err) {
  if (String(err.message).toLowerCase().includes('token')) {
    alert('Your session has expired. Please log in again.');
    handleLogout();
    return true;
  }
  return false;
}

// ------------------------------------------------------------
// BOOKINGS
// ------------------------------------------------------------
async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');

  tbody.innerHTML = '<tr><td colspan="11" class="loading-row">Loading…</td></tr>';

  try {
    bookingsCache = await authedApi.getBookings();

    renderBookingSummary(bookingsCache);
    renderBookingsFromCache();

  } catch (err) {
    if (!handleAuthError(err)) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-row">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function getFilteredBookings() {
  const status = document.getElementById('bookingStatusFilter')?.value || '';
  const branch = document.getElementById('bookingBranchFilter')?.value || '';
  const search = document.getElementById('bookingSearchInput')?.value.trim().toLowerCase() || '';

  return bookingsCache.filter((booking) => {
    const ref = formatBookingRef(booking.id).toLowerCase();

    const matchesStatus = !status || booking.status === status;
    const matchesBranch = !branch || booking.branch_name === branch;

    const combinedText = [
      ref,
      booking.patient_name,
      booking.phone,
      booking.branch_name,
      booking.doctor_name,
      booking.service_title,
      booking.reason,
      booking.status
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = !search || combinedText.includes(search);

    return matchesStatus && matchesBranch && matchesSearch;
  });
}

function renderBookingSummary(bookings) {
  const total = bookings.length;
  const pending = bookings.filter((b) => b.status === 'pending').length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

  document.getElementById('summaryTotal').textContent = total;
  document.getElementById('summaryPending').textContent = pending;
  document.getElementById('summaryConfirmed').textContent = confirmed;
  document.getElementById('summaryCompleted').textContent = completed;
  document.getElementById('summaryCancelled').textContent = cancelled;
}

function renderBookingsFromCache() {
  const tbody = document.getElementById('bookingsTableBody');
  const bookings = getFilteredBookings();

  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-row">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map((bk) => {
    const reasonText = bk.reason || '—';
    const shouldShowToggle = reasonText.length > 45;
    const whatsappLink = buildWhatsappLink(bk);

    return `
      <tr data-id="${bk.id}">
        <td>
          <span class="booking-ref">${formatBookingRef(bk.id)}</span>
        </td>

        <td>${escapeHtml(bk.patient_name)}</td>
        <td>${escapeHtml(bk.phone)}</td>
        <td>${escapeHtml(bk.branch_name)}</td>
        <td>${escapeHtml(bk.doctor_name || '—')}</td>
        <td>${escapeHtml(bk.service_title || '—')}</td>
        <td>${formatDate(bk.preferred_date)}</td>
        <td>${escapeHtml(bk.preferred_time)}</td>

        <td class="reason-col">
          <div class="reason-text">${escapeHtml(reasonText)}</div>
          ${
            shouldShowToggle
              ? `<button class="reason-toggle" type="button">Read more</button>`
              : ''
          }
        </td>

        <td>
          <select class="status-select status-${bk.status}" data-id="${bk.id}">
            <option value="pending" ${bk.status === 'pending' ? 'selected' : ''}>Pending Review</option>
            <option value="confirmed" ${bk.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="completed" ${bk.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${bk.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>

        <td>
          <div class="booking-actions">
            ${
              whatsappLink
                ? `
                  <a
                    class="whatsapp-icon-btn"
                    href="${whatsappLink}"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp patient"
                    aria-label="WhatsApp patient"
                  >
                    <svg viewBox="0 0 32 32" aria-hidden="true">
                      <path d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Zm5.87-8.01c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/>
                    </svg>
                  </a>
                `
                : `<span class="whatsapp-icon-btn disabled" title="Invalid phone number">-</span>`
            }

            <button class="btn-small danger" data-action="delete-booking" data-id="${bk.id}">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachBookingRowEvents();
}

function attachBookingRowEvents() {
  const tbody = document.getElementById('bookingsTableBody');

  tbody.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await authedApi.updateBookingStatus(sel.dataset.id, sel.value);

        const booking = bookingsCache.find((b) => String(b.id) === String(sel.dataset.id));
        if (booking) booking.status = sel.value;

        sel.className = `status-select status-${sel.value}`;

        renderBookingSummary(bookingsCache);
      } catch (err) {
        if (!handleAuthError(err)) alert('Failed to update status: ' + err.message);
        loadBookings();
      }
    });
  });

  tbody.querySelectorAll('[data-action="delete-booking"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this booking?')) return;

      try {
        await authedApi.deleteBooking(btn.dataset.id);

        bookingsCache = bookingsCache.filter((b) => String(b.id) !== String(btn.dataset.id));

        renderBookingSummary(bookingsCache);
        renderBookingsFromCache();
      } catch (err) {
        if (!handleAuthError(err)) alert('Failed to delete: ' + err.message);
      }
    });
  });
}

function exportFilteredBookingsToCSV() {
  const bookings = getFilteredBookings();

  if (!bookings.length) {
    alert('No booking data to export.');
    return;
  }

  const headers = [
    'Reference',
    'Patient Name',
    'Phone',
    'Branch',
    'Doctor',
    'Service',
    'Preferred Date',
    'Preferred Time',
    'Reason',
    'Status'
  ];

  const rows = bookings.map((bk) => [
    formatBookingRef(bk.id),
    bk.patient_name || '',
    bk.phone || '',
    bk.branch_name || '',
    bk.doctor_name || '',
    bk.service_title || '',
    formatDate(bk.preferred_date),
    bk.preferred_time || '',
    bk.reason || '',
    bk.status || ''
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');

  link.href = url;
  link.download = `klinik-putrijaya-bookings-${today}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// FEEDBACK
// ------------------------------------------------------------
async function loadFeedback() {
  const tbody = document.getElementById('feedbackTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    const items = await authedApi.getAllFeedback();
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No feedback yet.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((f) => `
      <tr data-id="${f.id}">
        <td>${escapeHtml(f.patient_name)}</td>
        <td>${escapeHtml(f.branch_name || '—')}</td>
        <td>${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</td>
        <td class="wrap-text">${escapeHtml(f.message)}</td>
        <td><span class="status-pill ${f.is_approved ? 'status-confirmed' : 'status-pending'}">${f.is_approved ? 'Approved' : 'Pending'}</span></td>
        <td>
          ${!f.is_approved ? `<button class="btn-small" data-action="approve-feedback" data-id="${f.id}">Approve</button>` : ''}
          <button class="btn-small danger" data-action="delete-feedback" data-id="${f.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="approve-feedback"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await authedApi.approveFeedback(btn.dataset.id);
          loadFeedback();
        } catch (err) {
          if (!handleAuthError(err)) alert('Failed to approve: ' + err.message);
        }
      });
    });
    tbody.querySelectorAll('[data-action="delete-feedback"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this feedback?')) return;
        try {
          await authedApi.deleteFeedback(btn.dataset.id);
          loadFeedback();
        } catch (err) {
          if (!handleAuthError(err)) alert('Failed to delete: ' + err.message);
        }
      });
    });
  } catch (err) {
    if (!handleAuthError(err)) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

// ------------------------------------------------------------
// DOCTORS
// ------------------------------------------------------------
async function loadDoctors() {
  const tbody = document.getElementById('doctorsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    const doctors = await authedApi.getAdminDoctors();
    if (!doctors.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No doctors found.</td></tr>';
      return;
    }
    tbody.innerHTML = doctors.map((d) => `
      <tr data-id="${d.id}">
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.branch_name)}</td>
        <td class="wrap-text">${escapeHtml(d.qualification)}</td>
        <td>${escapeHtml(d.reg_no)}</td>
        <td>${d.is_active ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn-small" data-action="edit-doctor" data-id="${d.id}">Edit</button>
          <button class="btn-small danger" data-action="delete-doctor" data-id="${d.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-doctor"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = doctors.find((x) => x.id == btn.dataset.id);
        openDoctorModal(d);
      });
    });
    tbody.querySelectorAll('[data-action="delete-doctor"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this doctor?')) return;
        try {
          await authedApi.deleteDoctor(btn.dataset.id);
          loadDoctors();
        } catch (err) {
          if (!handleAuthError(err)) alert('Failed to delete: ' + err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openDoctorModal(doctor) {
  const isEdit = !!doctor;
  showModal(isEdit ? 'Edit doctor' : 'Add doctor', `
    <label for="m-branch">Branch</label>
    <select id="m-branch" required>
      ${branchesCache.map((b) => `<option value="${b.id}" ${doctor && doctor.branch_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
    </select>
    <label for="m-name">Name</label>
    <input type="text" id="m-name" value="${doctor ? escapeHtml(doctor.name) : ''}" required>
    <label for="m-qual">Qualification</label>
    <textarea id="m-qual" required>${doctor ? escapeHtml(doctor.qualification) : ''}</textarea>
    <label for="m-reg">Registration No.</label>
    <input type="text" id="m-reg" value="${doctor ? escapeHtml(doctor.reg_no) : ''}" required>
    <label for="m-photo">Doctor photo</label>
    <input type="file" id="m-photo" accept="image/*">
    <input type="hidden" id="m-photo-url" value="${doctor ? escapeHtml(doctor.photo_url || '') : ''}">
    <div class="field-note">Current: ${doctor && doctor.photo_url ? escapeHtml(doctor.photo_url) : 'No image selected'}</div>
    ${isEdit ? `
      <label for="m-active">Active</label>
      <select id="m-active">
        <option value="1" ${doctor.is_active ? 'selected' : ''}>Yes</option>
        <option value="0" ${!doctor.is_active ? 'selected' : ''}>No</option>
      </select>` : ''}
    <div class="form-message" id="modalFormMessage"></div>
    <div class="modal-actions"><button type="submit" class="btn-primary">${isEdit ? 'Save changes' : 'Add doctor'}</button></div>
  `, async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('m-photo');
    const currentUrl = document.getElementById('m-photo-url').value.trim() || null;
    const payload = {
      branch_id: Number(document.getElementById('m-branch').value),
      name: document.getElementById('m-name').value.trim(),
      qualification: document.getElementById('m-qual').value.trim(),
      reg_no: document.getElementById('m-reg').value.trim(),
      photo_url: currentUrl,
    };
    if (isEdit) payload.is_active = Number(document.getElementById('m-active').value);

    try {
      if (fileInput.files.length > 0) {
        const uploadResult = await authedApi.uploadImage(fileInput.files[0]);
        payload.photo_url = uploadResult.url;
      }

      if (isEdit) {
        await authedApi.updateDoctor(doctor.id, payload);
      } else {
        await authedApi.createDoctor(payload);
      }
      closeModal();
      loadDoctors();
    } catch (err) {
      document.getElementById('modalFormMessage').textContent = err.message;
      document.getElementById('modalFormMessage').className = 'form-message error';
    }
  });
}

// ------------------------------------------------------------
// SERVICES
// ------------------------------------------------------------

async function loadServices() {
  const tbody = document.getElementById('servicesTableBody');

  tbody.innerHTML =
    '<tr><td colspan="5" class="loading-row">Loading…</td></tr>';

  try {
    const services = await authedApi.getAdminServices();

    if (!services.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-row">No service categories found.</td></tr>';

      return;
    }

    tbody.innerHTML = services.map((service) => {
      const detailCount = service.details
        ? String(service.details)
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
            .length
        : 0;

      return `
        <tr data-id="${service.id}">
          <td>
            ${escapeHtml(service.category_key)}
            <div class="field-note">
              Order: ${Number(service.sort_order) || 0}
            </div>
          </td>

          <td>
            <strong>${escapeHtml(service.title)}</strong>
            <div class="field-note">
              ${escapeHtml(service.kicker || 'No kicker')}
            </div>
          </td>

          <td class="wrap-text">
            ${escapeHtml(service.description || '—')}
            <div class="field-note">
              ${detailCount} detailed service${detailCount === 1 ? '' : 's'}
            </div>
          </td>

          <td>
            ${Number(service.is_active) === 1 ? 'Yes' : 'No'}
          </td>

          <td>
            <button
              class="btn-small"
              data-action="edit-service"
              data-id="${service.id}"
            >
              Edit
            </button>

            <button
              class="btn-small danger"
              data-action="delete-service"
              data-id="${service.id}"
            >
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody
      .querySelectorAll('[data-action="edit-service"]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const service = services.find(
            (item) => String(item.id) === String(button.dataset.id)
          );

          openServiceModal(service);
        });
      });

    tbody
      .querySelectorAll('[data-action="delete-service"]')
      .forEach((button) => {
        button.addEventListener('click', async () => {
          if (!confirm('Delete this service category?')) {
            return;
          }

          try {
            await authedApi.deleteService(button.dataset.id);
            loadServices();
          } catch (error) {
            if (!handleAuthError(error)) {
              alert(`Failed to delete service: ${error.message}`);
            }
          }
        });
      });
  } catch (error) {
    if (!handleAuthError(error)) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">
            Error: ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }
}

function openServiceModal(service = null) {
  const isEdit = Boolean(service);

  showModal(
    isEdit ? 'Edit service category' : 'Add service category',
    `
      <label for="m-cat">Category key</label>
      <input
        type="text"
        id="m-cat"
        value="${service ? escapeHtml(service.category_key) : ''}"
        placeholder="women, general, treatment or special"
        required
      >

      <div class="field-note">
        Use a short unique key without spaces.
      </div>

      <label for="m-kicker">Kicker</label>
      <input
        type="text"
        id="m-kicker"
        value="${service ? escapeHtml(service.kicker || '') : ''}"
        placeholder="Women’s Health"
      >

      <label for="m-title">Card title</label>
      <input
        type="text"
        id="m-title"
        value="${service ? escapeHtml(service.title || '') : ''}"
        placeholder="Women’s & Maternity Care"
        required
      >

      <label for="m-desc">Card description</label>
      <textarea
        id="m-desc"
        placeholder="Short description displayed on the service card."
      >${service ? escapeHtml(service.description || '') : ''}</textarea>

      <label for="m-details">Available services</label>
      <textarea
        id="m-details"
        rows="10"
        placeholder="Enter one service per line&#10;Antenatal check-up&#10;Ultrasound scan&#10;Pap smear"
      >${service ? escapeHtml(service.details || '') : ''}</textarea>

      <div class="field-note">
        Enter one service per line. These items will appear inside the popup.
      </div>

      <label for="m-sort">Display order</label>
      <input
        type="number"
        id="m-sort"
        min="0"
        value="${service ? Number(service.sort_order) || 0 : 0}"
      >

      <label for="m-active">Active</label>
      <select id="m-active">
        <option
          value="1"
          ${!service || Number(service.is_active) === 1 ? 'selected' : ''}
        >
          Yes
        </option>

        <option
          value="0"
          ${service && Number(service.is_active) === 0 ? 'selected' : ''}
        >
          No
        </option>
      </select>

      <div class="form-message" id="modalFormMessage"></div>

      <div class="modal-actions">
        <button type="submit" class="btn-primary">
          ${isEdit ? 'Save changes' : 'Add service category'}
        </button>
      </div>
    `,
    async (event) => {
      event.preventDefault();

      const payload = {
        category_key:
          document.getElementById('m-cat').value.trim(),

        kicker:
          document.getElementById('m-kicker').value.trim() || null,

        title:
          document.getElementById('m-title').value.trim(),

        description:
          document.getElementById('m-desc').value.trim() || null,

        details:
          document.getElementById('m-details').value.trim() || null,

        sort_order:
          Number(document.getElementById('m-sort').value || 0),

        is_active:
          Number(document.getElementById('m-active').value),
      };

      const messageBox =
        document.getElementById('modalFormMessage');

      try {
        if (isEdit) {
          await authedApi.updateService(service.id, payload);
        } else {
          await authedApi.createService(payload);
        }

        closeModal();
        loadServices();
      } catch (error) {
        messageBox.textContent = error.message;
        messageBox.className = 'form-message error';
      }
    }
  );
}

// ------------------------------------------------------------
// PROMOTIONS
// ------------------------------------------------------------
async function loadPromotions() {
  const tbody = document.getElementById('promotionsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading…</td></tr>';

  try {
    const promotions = await authedApi.getAdminPromotions();
    if (!promotions.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No promotions found.</td></tr>';
      return;
    }

    tbody.innerHTML = promotions.map((p) => `
      <tr data-id="${p.id}">
        <td>${escapeHtml(p.badge || '—')}</td>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.cta_label || '—')}</td>
        <td>${p.sort_order ?? 0}</td>
        <td>${p.is_active ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn-small" data-action="edit-promotion" data-id="${p.id}">Edit</button>
          <button class="btn-small danger" data-action="delete-promotion" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-promotion"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = promotions.find((x) => x.id == btn.dataset.id);
        openPromotionModal(p);
      });
    });

    tbody.querySelectorAll('[data-action="delete-promotion"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this promotion?')) return;
        try {
          await authedApi.deletePromotion(btn.dataset.id);
          loadPromotions();
        } catch (err) {
          if (!handleAuthError(err)) alert('Failed to delete: ' + err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openPromotionModal(promotion) {
  const isEdit = !!promotion;
  showModal(isEdit ? 'Edit promotion' : 'Add promotion', `
    <label for="m-badge">Badge</label>
    <input type="text" id="m-badge" value="${promotion ? escapeHtml(promotion.badge || '') : ''}" placeholder="Now hiring">
    <label for="m-title">Title</label>
    <input type="text" id="m-title" value="${promotion ? escapeHtml(promotion.title) : ''}" required>
    <label for="m-desc">Description</label>
    <textarea id="m-desc">${promotion ? escapeHtml(promotion.description || '') : ''}</textarea>
    <label for="m-details">Details (bullet list)</label>
    <textarea id="m-details" placeholder="One item per line">${promotion ? escapeHtml(promotion.details || '') : ''}</textarea>
    <label for="m-cta-label">CTA label</label>
    <input type="text" id="m-cta-label" value="${promotion ? escapeHtml(promotion.cta_label || '') : ''}" placeholder="Apply via WhatsApp">
    <label for="m-cta-link">CTA link</label>
    <input type="text" id="m-cta-link" value="${promotion ? escapeHtml(promotion.cta_link || '') : ''}" placeholder="https://wa.link/">
    <label for="m-image">Promotion poster</label>
    <input type="file" id="m-image" accept="image/*">
    <input type="hidden" id="m-image-url" value="${promotion ? escapeHtml(promotion.image_url || '') : ''}">
    <div class="field-note">Current: ${promotion && promotion.image_url ? escapeHtml(promotion.image_url) : 'No image selected'}</div>
    <label for="m-sort">Display order</label>
    <input type="number" id="m-sort" value="${promotion ? escapeHtml(String(promotion.sort_order ?? 0)) : '0'}">
    ${isEdit ? `
      <label for="m-active">Active</label>
      <select id="m-active">
        <option value="1" ${promotion.is_active ? 'selected' : ''}>Yes</option>
        <option value="0" ${!promotion.is_active ? 'selected' : ''}>No</option>
      </select>` : ''}
    <div class="form-message" id="modalFormMessage"></div>
    <div class="modal-actions"><button type="submit" class="btn-primary">${isEdit ? 'Save changes' : 'Add promotion'}</button></div>
  `, async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('m-image');
    const currentUrl = document.getElementById('m-image-url').value.trim() || null;
    const payload = {
      badge: document.getElementById('m-badge').value.trim() || null,
      title: document.getElementById('m-title').value.trim(),
      description: document.getElementById('m-desc').value.trim() || null,
      details: document.getElementById('m-details').value.trim() || null,
      cta_label: document.getElementById('m-cta-label').value.trim() || null,
      cta_link: document.getElementById('m-cta-link').value.trim() || null,
      image_url: currentUrl,
      sort_order: Number(document.getElementById('m-sort').value || 0),
    };
    if (isEdit) payload.is_active = Number(document.getElementById('m-active').value);

    try {
      if (fileInput.files.length > 0) {
        const uploadResult = await authedApi.uploadImage(fileInput.files[0]);
        payload.image_url = uploadResult.url;
      }

      if (isEdit) {
        await authedApi.updatePromotion(promotion.id, payload);
      } else {
        await authedApi.createPromotion(payload);
      }
      closeModal();
      loadPromotions();
    } catch (err) {
      document.getElementById('modalFormMessage').textContent = err.message;
      document.getElementById('modalFormMessage').className = 'form-message error';
    }
  });
}

// ------------------------------------------------------------
// Generic modal helper
// ------------------------------------------------------------
function showModal(title, formHtml, onSubmit) {
  document.getElementById('modalTitle').textContent = title;
  const form = document.getElementById('modalForm');
  form.innerHTML = formHtml;
  form.onsubmit = onSubmit;
  document.getElementById('modalBackdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.add('hidden');
}

// ------------------------------------------------------------
// Reason expand / collapse
// ------------------------------------------------------------
document.addEventListener('click', function (event) {
  if (!event.target.classList.contains('reason-toggle')) return;

  const button = event.target;
  const reasonText = button.previousElementSibling;

  reasonText.classList.toggle('expanded');

  button.textContent = reasonText.classList.contains('expanded')
    ? 'Show less'
    : 'Read more';
});
