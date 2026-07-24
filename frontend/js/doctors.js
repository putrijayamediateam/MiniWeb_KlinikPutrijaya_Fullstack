'use strict';

/*
  Klinik Putrijaya doctors page

  Data flow:
  1. Load branches from the database.
  2. Load active doctors from the database.
  3. Populate the branch filter using branch IDs.
  4. Filter the loaded doctors by branch ID and search text.
*/

let doctorsCache = [];
let branchesCache = [];
let doctorSearchTimer = null;

document.addEventListener('DOMContentLoaded', initialiseDoctorsPage);

async function initialiseDoctorsPage() {
  const container = document.getElementById('doctorsContainer');
  const searchInput = document.getElementById('doctorSearchInput');
  const branchFilter = document.getElementById('doctorBranchFilter');

  if (!container || !branchFilter) {
    return;
  }

  container.innerHTML =
    '<p class="doctor-loading">Loading doctors...</p>';

  branchFilter.disabled = true;
  branchFilter.innerHTML =
    '<option value="">Loading branches...</option>';

  try {
    const [branchResponse, doctorResponse] = await Promise.all([
      KPApi.getBranches(),
      KPApi.getDoctors(),
    ]);

    /*
      Support both possible API response formats:

      Direct array:
      [{ id: 1, name: "Klinik Putrijaya Cheras" }]

      Wrapped response:
      { data: [...] }
    */
    branchesCache = normaliseApiArray(branchResponse);
    doctorsCache = normaliseApiArray(doctorResponse);

    populateBranchFilter();
    filterAndRenderDoctors();
  } catch (error) {
    console.error('Unable to initialise doctors page:', error);

    branchFilter.disabled = true;
    branchFilter.innerHTML =
      '<option value="">Branches unavailable</option>';

    container.innerHTML = `
      <p class="doctor-error">
        Could not load doctors. Please make sure the backend
        and database are running.
      </p>
    `;
  }

  searchInput?.addEventListener('input', () => {
    clearTimeout(doctorSearchTimer);

    doctorSearchTimer = setTimeout(() => {
      filterAndRenderDoctors();
    }, 250);
  });

  branchFilter.addEventListener('change', filterAndRenderDoctors);
}

function normaliseApiArray(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function populateBranchFilter() {
  const branchFilter =
    document.getElementById('doctorBranchFilter');

  if (!branchFilter) {
    return;
  }

  const activeBranches = branchesCache.filter((branch) => {
    /*
      Show the branch unless the API explicitly returns is_active = 0.
      This also works when the branches API does not include is_active.
    */
    return branch.is_active === undefined ||
      Number(branch.is_active) === 1;
  });

  branchFilter.innerHTML = [
    '<option value="">All branches</option>',

    ...activeBranches.map((branch) => {
      return `
        <option value="${escapeAttribute(branch.id)}">
          ${escapeHtml(branch.name)}
        </option>
      `;
    }),
  ].join('');

  branchFilter.disabled = false;
}

function filterAndRenderDoctors() {
  const searchValue =
    document
      .getElementById('doctorSearchInput')
      ?.value
      .trim()
      .toLowerCase() || '';

  const selectedBranchId =
    document.getElementById('doctorBranchFilter')?.value || '';

  const filteredDoctors = doctorsCache.filter((doctor) => {
    const doctorBranchId = String(doctor.branch_id ?? '');

    const matchesBranch =
      !selectedBranchId ||
      doctorBranchId === String(selectedBranchId);

    const searchableText = [
      doctor.name,
      doctor.qualification,
      doctor.reg_no,
      doctor.branch_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch =
      !searchValue ||
      searchableText.includes(searchValue);

    return matchesBranch && matchesSearch;
  });

  renderDoctors(filteredDoctors);
}

function renderDoctors(doctors) {
  const container = document.getElementById('doctorsContainer');

  if (!container) {
    return;
  }

  if (!doctors.length) {
    container.innerHTML = `
      <p class="doctor-empty">
        No doctors match the selected branch or search.
      </p>
    `;
    return;
  }

  const groups = doctors.reduce((result, doctor) => {
    const branchName =
      doctor.branch_name || 'Klinik Putrijaya';

    if (!result[branchName]) {
      result[branchName] = [];
    }

    result[branchName].push(doctor);
    return result;
  }, {});

  container.innerHTML = Object.entries(groups)
    .map(([branchName, branchDoctors]) => {
      const shortBranchName = getShortBranchName(branchName);

      return `
        <section class="doctor-branch-group">
          <div class="doctor-branch-header">
            <div>
              <span class="doctor-branch-label">
                ${escapeHtml(branchName)}
              </span>

              <h3>
                ${escapeHtml(shortBranchName)} Resident Doctors
              </h3>
            </div>
          </div>

          <div class="doctor-detail-grid">
            ${branchDoctors
              .map((doctor) => renderDoctorCard(doctor))
              .join('')}
          </div>
        </section>
      `;
    })
    .join('');
}

function renderDoctorCard(doctor) {
  const photoUrl =
    doctor.photo_url || 'images/logoklinik.png';

  return `
    <article class="doctor-detail">
      <div class="doctor-photo">
        <img
          src="${escapeAttribute(photoUrl)}"
          alt="${escapeAttribute(doctor.name || 'Doctor')}"
          loading="lazy"
          onerror="this.onerror=null;this.src='images/logoklinik.png';"
        >
      </div>

      <div class="doctor-info">
        <h5>${escapeHtml(doctor.name || 'Doctor')}</h5>

        <p>
          ${escapeHtml(doctor.qualification || '')}
        </p>

        ${
          doctor.reg_no
            ? `
              <p class="reg">
                ${escapeHtml(doctor.reg_no)}
              </p>
            `
            : ''
        }
      </div>
    </article>
  `;
}

function getShortBranchName(branchName) {
  return String(branchName || '')
    .replace(/Klinik Putrijaya/gi, '')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || branchName;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}