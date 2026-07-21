document.addEventListener('DOMContentLoaded', initDoctors);

let doctorFetchTimer = null;

function renderDoctors(doctors) {
  const container = document.getElementById('doctorsContainer');
  if (!container) return;

  if (!Array.isArray(doctors) || doctors.length === 0) {
    container.innerHTML = '<p class="doctor-empty">No doctors match your search.</p>';
    return;
  }

  const groups = doctors.reduce((result, doctor) => {
    const branch = doctor.branch_name || 'Klinik Putrijaya';
    if (!result[branch]) result[branch] = [];
    result[branch].push(doctor);
    return result;
  }, {});

  container.innerHTML = Object.entries(groups).map(([branchName, doctorsInBranch]) => {
    const displayName = branchName
      .replace('Klinik Putrijaya —', '')
      .replace('Klinik Putrijaya', '')
      .trim() || branchName;

    return `
      <section class="doctor-branch-group" aria-label="${KPUtils.escapeHtml(displayName)} doctors">
        <div class="doctor-branch-header">
          <div>
            <span class="doctor-branch-label">${KPUtils.escapeHtml(branchName)}</span>
            <h2>${KPUtils.escapeHtml(displayName)} Resident Doctors</h2>
          </div>
        </div>
        <div class="doctor-detail-grid">
          ${doctorsInBranch.map((doctor) => `
            <article class="doctor-detail">
              <div class="doctor-photo">
                <img src="${KPUtils.escapeHtml(doctor.photo_url || 'images/logoklinik.png')}" alt="${KPUtils.escapeHtml(doctor.name)}" loading="lazy">
              </div>
              <div class="doctor-info">
                <h3>${KPUtils.escapeHtml(doctor.name)}</h3>
                <p>${KPUtils.escapeHtml(doctor.qualification || '')}</p>
                ${doctor.reg_no ? `<p class="reg">Registration: ${KPUtils.escapeHtml(doctor.reg_no)}</p>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');
}

async function loadDoctors() {
  const container = document.getElementById('doctorsContainer');
  if (!container) return;

  const query = document.getElementById('doctorSearchInput')?.value.trim() || '';
  const branch = document.getElementById('doctorBranchFilter')?.value || '';

  container.innerHTML = '<p class="doctor-loading">Loading doctors…</p>';

  try {
    const doctors = await KPApi.getDoctors({
      ...(query ? { q: query } : {}),
      ...(branch ? { branch } : {}),
    });
    renderDoctors(doctors);
  } catch (error) {
    container.innerHTML = `<p class="doctor-error">Could not load doctors: ${KPUtils.escapeHtml(error.message)}</p>`;
  }
}

function initDoctors() {
  if (!document.getElementById('doctorsContainer')) return;

  loadDoctors();

  document.getElementById('doctorSearchInput')?.addEventListener('input', () => {
    clearTimeout(doctorFetchTimer);
    doctorFetchTimer = window.setTimeout(loadDoctors, 300);
  });

  document.getElementById('doctorBranchFilter')?.addEventListener('change', loadDoctors);
}
