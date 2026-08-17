'use strict';

// Full replacement for the existing frontend/admin.js.
// Requires frontend/js/api.js to load first.

const TOKEN_KEY = 'kp_admin_token';
const USERNAME_KEY = 'kp_admin_username';
const ROLE_KEY = 'kp_admin_role';

const ROLE_ACCESS = {
  admin: [
    'bookings',
    'performance',
  ],

  manager: [
    'bookings',
    'performance',
    'feedback',
    'doctors',
    'services',
    'service-setup',
    'promotions',
    'activities',
  ],

  superadmin: [
    'bookings',
    'performance',
    'feedback',
    'doctors',
    'services',
    'service-setup',
    'promotions',
    'activities',
    'users',
  ],
};

let currentAdmin = null;
let currentAdminRole = 'admin';

let authedApi = null;
let branchesCache = [];
let doctorsCache = [];
let servicesCache = [];

let serviceCategoriesCache = [];
let serviceSubcategoriesCache = [];

let promotionsCache = [];
let activitiesCache = [];
let adminUsersCache = [];
let performanceReportCache = null;
let performanceTrendChartInstance = null;
let performanceDeviceChartInstance = null;
let performanceGenderChartInstance = null;
let sessionExpiryPromptOpen = false;

const ADMIN_API_BASE = String(
  window.KP_API_BASE ||
  (
    ['localhost', '127.0.0.1']
      .includes(window.location.hostname)
      ? 'http://localhost:4000/api'
      : 'https://backend-production-d730.up.railway.app/api'
  )
).replace(/\/+$/, '');

const bookingState = {
  page: 1,
  limit: 10,
};

const feedbackState = {
  page: 1,
  limit: 10,
};

const doctorState = {
  page: 1,
  limit: 10,
  branch: '',
};

const serviceListState = {
  page: 1,
  limit: 10,
  search: '',
  category: '',
  subcategory: '',
};

const serviceCategoryState = {
  page: 1,
  limit: 10,
};

const serviceSubcategoryState = {
  page: 1,
  limit: 10,
};

const promotionState = {
  page: 1,
  limit: 10,
  search: '',
};

const activityState = {
  page: 1,
  limit: 10,
  search: '',
};

const adminUserState = {
  page: 1,
  limit: 10,
};

const googleSearchState = {
  queryPage: 1,
  pagePage: 1,
  limit: 20,
  queries: [],
  pages: [],
};

document.addEventListener('DOMContentLoaded', () => {
  bindCoreEvents();
  initialiseAdminGoogleLogin();
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    enterDashboard(
  token,
  sessionStorage.getItem(
    USERNAME_KEY
  ) || 'admin'
);
  }
});

const serviceTaxonomyState = {
  categoryFilter: '',
  search: '',
};

function bindCoreEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  const loginPassword =
  document.getElementById('loginPassword');

const toggleLoginPassword =
  document.getElementById('toggleLoginPassword');

toggleLoginPassword?.addEventListener(
  'click',
  () => {
    if (!loginPassword) {
      return;
    }

    const shouldShow =
      loginPassword.type === 'password';

    loginPassword.type =
      shouldShow ? 'text' : 'password';

    toggleLoginPassword.textContent =
      shouldShow ? 'Hide' : 'Show';

    toggleLoginPassword.setAttribute(
      'aria-label',
      shouldShow
        ? 'Hide password'
        : 'Show password'
    );

    toggleLoginPassword.setAttribute(
      'aria-pressed',
      String(shouldShow)
    );
  }
);

  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  document
  .getElementById('performancePresetFilter')
  ?.addEventListener('change', (event) => {
    applyPerformancePreset(event.target.value);

    if (event.target.value !== 'custom') {
      loadPerformance();
    }
  });

document
  .getElementById('performanceBranchFilter')
  ?.addEventListener('change', loadPerformance);

document
  .getElementById('performanceApplyBtn')
  ?.addEventListener('click', loadPerformance);

  document
  .getElementById('exportPerformanceBtn')
  ?.addEventListener(
    'click',
    exportPerformanceWorkbook
  );

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
  document
  .getElementById(
    'doctorBranchFilter'
  )
  ?.addEventListener(
    'change',
    (event) => {
      doctorState.branch =
        event.target.value;

      doctorState.page = 1;

      renderDoctors();
    }
  );

  document
  .getElementById(
    'serviceListSearchInput'
  )
  ?.addEventListener(
    'input',
    debounce(
      (event) => {
        serviceListState.search =
          String(
            event.target.value || ''
          )
            .trim()
            .toLowerCase();

        serviceListState.page = 1;

        renderServices();
      },
      250
    )
  );

document
  .getElementById(
    'serviceListCategoryFilter'
  )
  ?.addEventListener(
    'change',
    (event) => {
      serviceListState.category =
        event.target.value;

      serviceListState.subcategory =
        '';

      serviceListState.page = 1;

      populateServiceListSubcategoryFilter();

      renderServices();
    }
  );
document
  .getElementById(
    'serviceListSubcategoryFilter'
  )
  ?.addEventListener(
    'change',
    (event) => {
      serviceListState.subcategory =
        event.target.value;

      serviceListState.page = 1;

      renderServices();
    }
  );
  document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceModal());
    document
    .getElementById(
      'refreshServiceTaxonomyBtn'
    )
    ?.addEventListener(
      'click',
      loadServiceTaxonomy
    );

  document
    .getElementById(
      'addServiceCategoryBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        openServiceCategoryModal()
    );

  document
    .getElementById(
      'addServiceSubcategoryBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        openServiceSubcategoryModal()
    );

  document
  .getElementById(
    'taxonomyCategoryFilter'
  )
  ?.addEventListener(
    'change',
    (event) => {
      serviceTaxonomyState
        .categoryFilter =
        event.target.value;

      serviceSubcategoryState.page = 1;

      renderFilteredServiceSubcategories();
    }
  );

  document
  .getElementById(
    'taxonomySearchInput'
  )
  ?.addEventListener(
    'input',
    debounce(
      (event) => {
        serviceTaxonomyState.search =
          String(
            event.target.value || ''
          )
            .trim()
            .toLowerCase();

        serviceSubcategoryState.page = 1;

        renderFilteredServiceSubcategories();
      },
      250
    )
  );
  document.getElementById('addPromotionBtn')?.addEventListener('click', () => openPromotionModal());
  document
  .getElementById('promotionSearchInput')
  ?.addEventListener(
    'input',
    debounce((event) => {
      promotionState.search =
        String(event.target.value || '')
          .trim()
          .toLowerCase();

      promotionState.page = 1;

      renderPromotions();
    }, 250)
  );
  document.getElementById('addActivityBtn')?.addEventListener('click',() => openActivityModal());
  document
  .getElementById(
    'activitySearchInput'
  )
  ?.addEventListener(
    'input',
    debounce(
      (event) => {
        activityState.search =
          String(
            event.target.value ||
            ''
          )
            .trim()
            .toLowerCase();

        activityState.page = 1;

        renderActivities();
      },
      250
    )
  );
  document
  .getElementById(
    'refreshAdminUsersBtn'
  )
  ?.addEventListener(
    'click',
    loadAdminUsers
  );

document
  .getElementById(
    'adminUserSearchInput'
  )
  ?.addEventListener(
    'input',
    debounce(
      () => {
        adminUserState.page = 1;

        renderFilteredAdminUsers();
      },
      250
    )
  );

document
  .getElementById(
    'adminUserRoleFilter'
  )
  ?.addEventListener(
    'change',
    () => {
      adminUserState.page = 1;

      renderFilteredAdminUsers();
    }
  );

document
  .getElementById(
    'adminUserStatusFilter'
  )
  ?.addEventListener(
    'change',
    () => {
      adminUserState.page = 1;

      renderFilteredAdminUsers();
    }
  );
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);

  document.getElementById('modalBackdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'modalBackdrop') closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  window.addEventListener(
  'resize',
  debounce(() => {
    const tbody =
      document.getElementById(
        'bookingsTableBody'
      );

    if (tbody) {
      updateReasonReadButtons(
        tbody
      );
    }
  }, 150)
);
}


async function initialiseAdminGoogleLogin() {
  const target = document.getElementById(
    'adminGoogleButton'
  );

  if (!target) {
    return;
  }

  try {
    const config = await requestAdminAuth(
      '/auth/signup-config'
    );

    await renderAdminGoogleButton(
      config.googleClientId
    );
  } catch {
    showAdminGoogleUnavailable(
      'Google sign-in is currently unavailable.'
    );
  }
}

async function renderAdminGoogleButton(
  clientId
) {
  const target = document.getElementById(
    'adminGoogleButton'
  );

  if (!target) {
    return;
  }

  if (!clientId) {
    showAdminGoogleUnavailable(
      'Google sign-in has not been configured yet.'
    );
    return;
  }

  const timeoutAt = Date.now() + 8000;

  while (
    !window.google?.accounts?.id &&
    Date.now() < timeoutAt
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, 150)
    );
  }

  if (!window.google?.accounts?.id) {
    showAdminGoogleUnavailable(
      'Google sign-in could not be loaded.'
    );
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleAdminGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  target.replaceChildren();

  window.google.accounts.id.renderButton(
    target,
    {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: Math.min(
        target.clientWidth || 380,
        380
      ),
    }
  );
}

async function handleAdminGoogleCredential(
  response
) {
  const messageBox = document.getElementById(
    'loginMessage'
  );
  const credential = String(
    response?.credential || ''
  ).trim();

  if (!credential) {
    setMessage(
      messageBox,
      'Google sign-in did not return a credential.',
      'error'
    );
    return;
  }

  setMessage(
    messageBox,
    'Signing in with Google…'
  );

  try {
    const result = await requestAdminAuth(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({
          credential,
        }),
      }
    );
    const token = String(
      result.token || ''
    ).trim();

    if (result.pendingApproval === true) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USERNAME_KEY);
      sessionStorage.removeItem(ROLE_KEY);

      setMessage(
        messageBox,
        result.message ||
          'Your account is waiting for superadmin approval.',
        'success'
      );
      return;
    }

    if (!token) {
      throw new Error(
        'Google sign-in could not be completed.'
      );
    }

    const resolvedUsername =
      result.username ||
      result.email ||
      'admin';

    sessionStorage.setItem(
      TOKEN_KEY,
      token
    );
    sessionStorage.setItem(
      USERNAME_KEY,
      resolvedUsername
    );

    await enterDashboard(
      token,
      resolvedUsername
    );
  } catch (error) {
    setMessage(
      messageBox,
      error.message ||
        'Google sign-in failed.',
      'error'
    );
  }
}

async function requestAdminAuth(
  path,
  options = {}
) {
  const response = await fetch(
    `${ADMIN_API_BASE}${path}`,
    {
      ...options,
      headers: {
        'Content-Type':
          'application/json',
        ...(options.headers || {}),
      },
    }
  );
  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

function showAdminGoogleUnavailable(message) {
  const target = document.getElementById(
    'adminGoogleButton'
  );

  if (!target) {
    return;
  }

  const unavailable = document.createElement(
    'div'
  );

  unavailable.className = 'google-unavailable';
  unavailable.textContent = message;
  target.replaceChildren(unavailable);
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
    const resolvedUsername = response.username || username;
    sessionStorage.setItem(
  TOKEN_KEY,
  response.token
);

sessionStorage.setItem(
  USERNAME_KEY,
  resolvedUsername
);

await enterDashboard(
  response.token,
  resolvedUsername
);
  } catch (error) {
    setMessage(messageBox, error.message || 'Login failed.', 'error');
  } finally {
    setButtonLoading(button, false, 'Log in');
  }
}

function handleLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  authedApi = null;
  currentAdmin = null;
  currentAdminRole = 'admin';
  updateAdminApprovalsVisibility('admin');
  document.getElementById('dashboard')?.classList.add('hidden');
  document.getElementById('loginScreen')?.classList.remove('hidden');
}

async function enterDashboard(
  token,
  username
) {
  authedApi = KPApi.withAuth(token);

  try {
    currentAdmin =
      await loadCurrentAdminProfile(
        token
      );

    currentAdminRole =
      normalizeAdminRole(
        currentAdmin.role
      );

    const displayName =
      currentAdmin.username ||
      currentAdmin.email ||
      username ||
      'admin';

    sessionStorage.setItem(
      USERNAME_KEY,
      displayName
    );

    sessionStorage.setItem(
      ROLE_KEY,
      currentAdminRole
    );

    const usernameTarget =
      document.getElementById(
        'adminUsername'
      );

    if (usernameTarget) {
      usernameTarget.textContent =
        displayName;
    }

    applyRoleAccess();
  } catch (error) {
    console.error(
      'Unable to load admin profile:',
      error
    );

    handleLogout();

    const messageBox =
      document.getElementById(
        'loginMessage'
      );

    setMessage(
      messageBox,
      error.message ||
        'Unable to verify administrator access.',
      'error'
    );

    return;
  }

  document
    .getElementById('loginScreen')
    ?.classList.add('hidden');

  document
    .getElementById('dashboard')
    ?.classList.remove('hidden');

  try {
    branchesCache =
      await KPApi.getBranches();

    populateBookingBranchFilter();
    populatePerformanceBranchFilter();
  } catch (error) {
    console.warn(
      'Could not load branches:',
      error
    );
  }

  initialisePerformanceDates();

  await loadAllowedDashboardModules();
}

async function loadCurrentAdminProfile(
  token
) {
  const response = await fetch(
    `${ADMIN_API_BASE}/admin-users/me`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
        'Content-Type':
          'application/json',
      },
    }
  );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
      'Unable to verify administrator account.'
    );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

function normalizeAdminRole(value) {
  const role = String(
    value || 'admin'
  )
    .trim()
    .toLowerCase();

  if (
    role === 'admin' ||
    role === 'manager' ||
    role === 'superadmin'
  ) {
    return role;
  }

  return 'admin';
}

function canAccessTab(tabName) {
  const tabs =
    ROLE_ACCESS[
      currentAdminRole
    ] || ROLE_ACCESS.admin;

  return tabs.includes(tabName);
}

function hasManagementAccess() {
  return (
    currentAdminRole ===
      'manager' ||
    currentAdminRole ===
      'superadmin'
  );
}

function isSuperadmin() {
  return (
    currentAdminRole ===
    'superadmin'
  );
}

function applyRoleAccess() {
  document
    .querySelectorAll('.tab-btn')
    .forEach((button) => {
      const allowed =
        canAccessTab(
          button.dataset.tab
        );

      button.classList.toggle(
        'hidden',
        !allowed
      );

      button.disabled =
        !allowed;

      button.setAttribute(
        'aria-hidden',
        String(!allowed)
      );

      button.tabIndex =
        allowed ? 0 : -1;
    });

  document
    .querySelectorAll('.tab-panel')
    .forEach((panel) => {
      const tabName =
        panel.id.replace(
          'tab-',
          ''
        );

      const allowed =
        canAccessTab(tabName);

      panel.classList.toggle(
        'hidden',
        !allowed
      );

      if (!allowed) {
        panel.classList.remove(
          'active'
        );
      }
    });

  updateAdminApprovalsVisibility(
    currentAdminRole
  );

    [
    'addDoctorBtn',
    'addServiceBtn',
    'addServiceCategoryBtn',
    'addServiceSubcategoryBtn',
    'refreshServiceTaxonomyBtn',
    'addPromotionBtn',
    'addActivityBtn',
  ].forEach((id) => {
    document
      .getElementById(id)
      ?.classList.toggle(
        'hidden',
        !hasManagementAccess()
      );
  });

  switchTab('bookings');
}

async function loadAllowedDashboardModules() {
  const tasks = [];

  if (canAccessTab('bookings')) {
    tasks.push(
      loadBookings()
    );
  }

  if (canAccessTab('performance')) {
    tasks.push(
      loadPerformance()
    );
  }

  if (canAccessTab('feedback')) {
    tasks.push(
      loadFeedback()
    );
  }

  if (canAccessTab('doctors')) {
    tasks.push(
      loadDoctors()
    );
  }

  if (canAccessTab('services')) {
    tasks.push(
      loadServices()
    );
  }

    if (
    canAccessTab(
      'service-setup'
    )
  ) {
    tasks.push(
      loadServiceTaxonomy()
    );
  }

  if (canAccessTab('promotions')) {
    tasks.push(
      loadPromotions()
    );
  }

  if (canAccessTab('activities')) {
    tasks.push(
      loadActivities()
    );
  }

  if (canAccessTab('users')) {
  tasks.push(
    loadAdminUsers()
  );
}

  await Promise.allSettled(tasks);
}

function updateAdminApprovalsVisibility(role) {
  const approvalsButton = document.getElementById('adminApprovalsBtn');
  if (!approvalsButton) return;

  const isSuperadmin = String(role || '').toLowerCase() === 'superadmin';
  approvalsButton.classList.toggle('hidden', !isSuperadmin);
  approvalsButton.setAttribute('aria-hidden', String(!isSuperadmin));
  approvalsButton.tabIndex = isSuperadmin ? 0 : -1;
}

function getRoleFromToken(token) {
  try {
    const payloadPart = String(token || '').split('.')[1];
    if (!payloadPart) return '';

    const base64 = payloadPart
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '='
    );

    const payload = JSON.parse(atob(padded));
    return String(payload.role || '').toLowerCase();
  } catch (error) {
    console.warn('Could not read admin role from token:', error);
    return '';
  }
}

function switchTab(tab) {
  if (!canAccessTab(tab)) {
    console.warn(
      `${currentAdminRole} cannot access ${tab}.`
    );

    return;
  }

  document
    .querySelectorAll('.tab-btn')
    .forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.tab === tab
      );
    });

  document
    .querySelectorAll('.tab-panel')
    .forEach((panel) => {
      panel.classList.toggle(
        'active',
        panel.id ===
          `tab-${tab}`
      );
    });

  if (tab === 'performance') {
    initialisePerformanceDates();
    loadPerformance();
  }

    if (
    tab === 'service-setup' &&
    hasManagementAccess()
  ) {
    loadServiceTaxonomy();
  }

  if (
  tab === 'users' &&
  isSuperadmin()
) {
  loadAdminUsers();
}
}

function handleAuthError(error) {
  const isAuthError =
    error?.status === 401 ||
    /token|expired|authentication/i.test(
      error?.message || ''
    );

  if (!isAuthError) {
    return false;
  }

  if (!sessionExpiryPromptOpen) {
    sessionExpiryPromptOpen = true;

    openKpActionModal({
      eyebrow:
        'Session expired',

      title:
        'Please log in again',

      message:
        'Your administrator session has expired for security reasons.',

      confirmText:
        'Log in again',

      cancelText:
        'Close',

      variant:
        'warning',
    }).then(() => {
      sessionExpiryPromptOpen =
        false;

      handleLogout();
    });
  }

  return true;
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
// WEBSITE PERFORMANCE
// -----------------------------------------------------------------------------

function populatePerformanceBranchFilter() {
  const select =
    document.getElementById(
      'performanceBranchFilter'
    );

  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [
    '<option value="">All branches</option>',

    ...branchesCache.map(
      (branch) => `
        <option value="${Number(branch.id)}">
          ${escapeHtml(branch.name)}
        </option>
      `
    ),
  ].join('');

  if (
    branchesCache.some(
      (branch) =>
        String(branch.id) ===
        String(currentValue)
    )
  ) {
    select.value = currentValue;
  }
}

function localDateInputValue(date) {
  const timezoneOffset =
    date.getTimezoneOffset() *
    60000;

  return new Date(
    date.getTime() -
      timezoneOffset
  )
    .toISOString()
    .slice(0, 10);
}

function initialisePerformanceDates() {
  const startInput =
    document.getElementById(
      'performanceStartDate'
    );

  const endInput =
    document.getElementById(
      'performanceEndDate'
    );

  if (
    !startInput ||
    !endInput
  ) {
    return;
  }

  if (
    startInput.value &&
    endInput.value
  ) {
    return;
  }

  applyPerformancePreset('30');
}

function applyPerformancePreset(
  preset
) {
  const startInput =
    document.getElementById(
      'performanceStartDate'
    );

  const endInput =
    document.getElementById(
      'performanceEndDate'
    );

  if (
    !startInput ||
    !endInput ||
    preset === 'custom'
  ) {
    return;
  }

  const today = new Date();
const currentYear =
  today.getFullYear();

let startDate =
  new Date(today);

let endDate =
  new Date(today);

if (preset === 'today') {
  // Today only.
} else if (preset === '7') {
  startDate.setDate(
    startDate.getDate() - 6
  );
} else if (preset === 'month') {
  startDate =
    new Date(
      currentYear,
      today.getMonth(),
      1
    );
} else if (preset === 'q1') {
  startDate =
    new Date(
      currentYear,
      0,
      1
    );

  endDate =
    new Date(
      currentYear,
      2,
      31
    );
} else if (preset === 'q2') {
  startDate =
    new Date(
      currentYear,
      3,
      1
    );

  endDate =
    new Date(
      currentYear,
      5,
      30
    );
} else if (preset === 'q3') {
  startDate =
    new Date(
      currentYear,
      6,
      1
    );

  endDate =
    new Date(
      currentYear,
      8,
      30
    );
} else if (preset === 'q4') {
  startDate =
    new Date(
      currentYear,
      9,
      1
    );

  endDate =
    new Date(
      currentYear,
      11,
      31
    );
} else {
  startDate.setDate(
    startDate.getDate() - 29
  );
}

startInput.value =
  localDateInputValue(
    startDate
  );

endInput.value =
  localDateInputValue(
    endDate
  );
}

async function loadPerformance() {
  if (
    !authedApi
      ?.getPerformanceOverview
  ) {
    return;
  }

  const startDate =
    document.getElementById(
      'performanceStartDate'
    )?.value || '';

  const endDate =
    document.getElementById(
      'performanceEndDate'
    )?.value || '';

  const branchId =
    document.getElementById(
      'performanceBranchFilter'
    )?.value || '';

      loadGoogleSearchPerformance(
    startDate,
    endDate
  );

  const trendContainer =
    document.getElementById(
      'performanceTrendChart'
    );

  const deviceContainer =
    document.getElementById(
      'performanceDeviceChart'
    );

    const genderContainer =
  document.getElementById(
    'performanceGenderChart'
  );

  const branchBody =
    document.getElementById(
      'performanceBranchTableBody'
    );

  if (trendContainer) {
    trendContainer.innerHTML = `
      <div class="performance-empty">
        Loading performance...
      </div>
    `;
  }

  if (deviceContainer) {
    deviceContainer.innerHTML = `
      <div class="performance-empty">
        Loading device data...
      </div>
    `;
  }

  if (genderContainer) {
  genderContainer.innerHTML = `
    <div class="performance-empty">
      Loading booking gender data...
    </div>
  `;
}

  if (branchBody) {
    branchBody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="loading-row"
        >
          Loading...
        </td>
      </tr>
    `;
  }

  try {
    const response =
      await authedApi
        .getPerformanceOverview({
          start_date:
            startDate,

          end_date:
            endDate,

          branch_id:
            branchId,
        });

    performanceReportCache =
      response;

    renderPerformanceSummary(
      response.summary || {}
    );

    renderPerformanceTrend(
      response.daily || []
    );

    renderPerformanceDevices(
      response.devices || []
    );

    renderPerformanceGenders(
  response.genders || []
);

    renderPerformanceBranches(
      response.branches || []
    );
  } catch (error) {
    performanceReportCache = null;

    if (
      handleAuthError(error)
    ) {
      return;
    }

    const message = escapeHtml(
      error.message ||
        'Unable to load performance.'
    );

    if (trendContainer) {
      trendContainer.innerHTML = `
        <div
          class="performance-empty error"
        >
          ${message}
        </div>
      `;
    }

    if (deviceContainer) {
      deviceContainer.innerHTML = `
        <div
          class="performance-empty error"
        >
          ${message}
        </div>
      `;
    }

    if (genderContainer) {
  genderContainer.innerHTML = `
    <div
      class="performance-empty error"
    >
      ${message}
    </div>
  `;
}

    if (branchBody) {
      branchBody.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="empty-row"
          >
            ${message}
          </td>
        </tr>
      `;
    }
  }
}

function performanceNumber(value) {
  return new Intl.NumberFormat(
    'en-MY'
  ).format(
    Number(value || 0)
  );
}

function renderPerformanceSummary(
  summary
) {
  setText(
    'performanceTotalInteractions',
    performanceNumber(
      summary.total_interactions
    )
  );

  setText(
    'performanceWebsiteVisits',
    performanceNumber(
      summary.website_visits
    )
  );

  setText(
    'performanceCalls',
    performanceNumber(
      summary.calls
    )
  );

  setText(
    'performanceBookings',
    performanceNumber(
      summary.bookings
    )
  );

  setText(
    'performanceDirections',
    performanceNumber(
      summary.directions
    )
  );

  setText(
    'performanceWhatsApp',
    performanceNumber(
      summary.whatsapp_clicks
    )
  );
}

function shortPerformanceDate(
  dateString
) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
    }
  ).format(date);
}

function renderPerformanceTrend(
  daily
) {
  const container =
    document.getElementById(
      'performanceTrendChart'
    );

  if (!container) return;

  if (
    performanceTrendChartInstance
  ) {
    performanceTrendChartInstance
      .destroy();

    performanceTrendChartInstance =
      null;
  }

  if (!daily.length) {
    container.innerHTML = `
      <div class="performance-empty">
        No website activity recorded
        for this period.
      </div>
    `;

    return;
  }

  if (
    typeof Chart ===
    'undefined'
  ) {
    container.innerHTML = `
      <div
        class="performance-empty error"
      >
        Chart library could not
        be loaded.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <canvas
      aria-label="
        Website performance
        trend chart
      "
    ></canvas>
  `;

  const canvas =
    container.querySelector(
      'canvas'
    );

  performanceTrendChartInstance =
    new Chart(
      canvas,
      {
        type: 'bar',

        data: {
          labels:
            daily.map(
              (item) =>
                shortPerformanceDate(
                  item.date
                )
            ),

          datasets: [
            {
              type: 'bar',

              label:
                'Website visits',

              data:
                daily.map(
                  (item) =>
                    Number(
                      item
                        .website_visits ||
                      0
                    )
                ),

              backgroundColor:
                'rgba(227, 28, 121, 0.24)',

              borderColor:
                '#e31c79',

              borderWidth: 1,
              borderRadius: 7,
              maxBarThickness: 34,
            },

            {
              type: 'line',

              label:
                'Total interactions',

              data:
                daily.map(
                  (item) =>
                    Number(
                      item
                        .total_interactions ||
                      0
                    )
                ),

              borderColor:
                '#24141c',

              backgroundColor:
                '#24141c',

              borderWidth: 2.5,
              pointRadius: 3,
              pointHoverRadius: 5,

              pointBackgroundColor:
                '#ffffff',

              pointBorderColor:
                '#24141c',

              pointBorderWidth: 2,
              tension: 0.32,
              fill: false,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio:
            false,

          interaction: {
            mode: 'index',
            intersect: false,
          },

          plugins: {
            legend: {
              position:
                'bottom',

              labels: {
                usePointStyle:
                  true,

                boxWidth: 8,
                padding: 18,
              },
            },
          },

          scales: {
            x: {
              grid: {
                display: false,
              },

              ticks: {
                maxRotation: 0,
                autoSkip: true,

                maxTicksLimit:
                  10,
              },
            },

            y: {
              beginAtZero: true,

              ticks: {
                precision: 0,
              },

              grid: {
                color:
                  'rgba(36, 20, 28, 0.08)',
              },
            },
          },
        },
      }
    );
}

function renderPerformanceDevices(
  devices
) {
  const container =
    document.getElementById(
      'performanceDeviceChart'
    );

  if (!container) return;

  if (
    performanceDeviceChartInstance
  ) {
    performanceDeviceChartInstance
      .destroy();

    performanceDeviceChartInstance =
      null;
  }

  const mobileUsers =
    Number(
      devices.find(
        (item) =>
          item.device_type ===
          'mobile'
      )?.users || 0
    );

  const desktopUsers =
    Number(
      devices.find(
        (item) =>
          item.device_type ===
          'desktop'
      )?.users || 0
    );

  if (
    !mobileUsers &&
    !desktopUsers
  ) {
    container.innerHTML = `
      <div class="performance-empty">
        No device data yet.
        New visits will be classified
        after this update.
      </div>
    `;

    return;
  }

  if (
    typeof Chart ===
    'undefined'
  ) {
    container.innerHTML = `
      <div
        class="performance-empty error"
      >
        Chart library could not
        be loaded.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <canvas
      aria-label="
        Device access pie chart
      "
    ></canvas>
  `;

  const canvas =
    container.querySelector(
      'canvas'
    );

  performanceDeviceChartInstance =
    new Chart(
      canvas,
      {
        type: 'pie',

        data: {
          labels: [
            'Phone / tablet',
            'Desktop',
          ],

          datasets: [
            {
              data: [
                mobileUsers,
                desktopUsers,
              ],

              backgroundColor: [
                '#e31c79',
                '#24141c',
              ],

              borderColor:
                '#ffffff',

              borderWidth: 4,
              hoverOffset: 7,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio:
            false,

          plugins: {
            legend: {
              position:
                'bottom',

              labels: {
                usePointStyle:
                  true,

                boxWidth: 8,
                padding: 18,
              },
            },

            tooltip: {
              callbacks: {
                label(context) {
                  const values =
                    context
                      .dataset
                      .data
                      .map(Number);

                  const total =
                    values.reduce(
                      (
                        sum,
                        value
                      ) =>
                        sum +
                        value,
                      0
                    );

                  const percentage =
                    total
                      ? (
                          (
                            Number(
                              context.raw
                            ) /
                            total
                          ) *
                          100
                        ).toFixed(1)
                      : '0.0';

                  return (
                    `${context.label}: ` +
                    `${performanceNumber(
                      context.raw
                    )} ` +
                    `(${percentage}%)`
                  );
                },
              },
            },
          },
        },
      }
    );
}

function renderPerformanceGenders(
  genders
) {
  const container =
    document.getElementById(
      'performanceGenderChart'
    );

  if (!container) {
    return;
  }

  if (
    performanceGenderChartInstance
  ) {
    performanceGenderChartInstance
      .destroy();

    performanceGenderChartInstance =
      null;
  }

  const femaleBookings =
    Number(
      genders.find(
        (item) =>
          item.gender ===
          'female'
      )?.bookings || 0
    );

  const maleBookings =
    Number(
      genders.find(
        (item) =>
          item.gender ===
          'male'
      )?.bookings || 0
    );

  if (
    !femaleBookings &&
    !maleBookings
  ) {
    container.innerHTML = `
      <div class="performance-empty">
        No booking gender data
        recorded for this period.
      </div>
    `;

    return;
  }

  if (
    typeof Chart ===
    'undefined'
  ) {
    container.innerHTML = `
      <div
        class="performance-empty error"
      >
        Chart library could not
        be loaded.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <canvas
      aria-label="
        Booking gender pie chart
      "
    ></canvas>
  `;

  const canvas =
    container.querySelector(
      'canvas'
    );

  performanceGenderChartInstance =
    new Chart(
      canvas,
      {
        type: 'pie',

        data: {
          labels: [
            'Female',
            'Male',
          ],

          datasets: [
            {
              data: [
                femaleBookings,
                maleBookings,
              ],

              backgroundColor: [
                '#e98ab3',
                '#536b86',
              ],

              borderColor:
                '#ffffff',

              borderWidth: 4,
              hoverOffset: 7,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio:
            false,

          plugins: {
            legend: {
              position:
                'bottom',

              labels: {
                usePointStyle:
                  true,

                boxWidth: 8,
                padding: 18,
              },
            },

            tooltip: {
              callbacks: {
                label(context) {
                  const values =
                    context
                      .dataset
                      .data
                      .map(Number);

                  const total =
                    values.reduce(
                      (
                        sum,
                        value
                      ) =>
                        sum +
                        value,
                      0
                    );

                  const percentage =
                    total
                      ? (
                          (
                            Number(
                              context.raw
                            ) /
                            total
                          ) *
                          100
                        ).toFixed(1)
                      : '0.0';

                  return (
                    `${context.label}: ` +
                    `${performanceNumber(
                      context.raw
                    )} ` +
                    `(${percentage}%)`
                  );
                },
              },
            },
          },
        },
      }
    );
}

function renderPerformanceBranches(
  branches
) {
  const body =
    document.getElementById(
      'performanceBranchTableBody'
    );

  if (!body) return;

  if (!branches.length) {
    body.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          No branch activity recorded.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    branches
      .map(
        (branch) => `
          <tr>
            <td>
              <strong>
                ${escapeHtml(
                  branch.branch_name
                )}
              </strong>
            </td>

            <td>
              ${performanceNumber(
                branch.calls
              )}
            </td>

            <td>
              ${performanceNumber(
                branch.bookings
              )}
            </td>

            <td>
              ${performanceNumber(
                branch.directions
              )}
            </td>

            <td>
              ${performanceNumber(
                branch
                  .whatsapp_clicks
              )}
            </td>

            <td>
              <strong>
                ${performanceNumber(
                  branch
                    .total_interactions
                )}
              </strong>
            </td>
          </tr>
        `
      )
      .join('');
}

// -----------------------------------------------------------------------------
// GOOGLE SEARCH CONSOLE PERFORMANCE
// -----------------------------------------------------------------------------

function formatSearchConsolePage(
  value
) {
  try {
    const url =
      new URL(value);

    return (
      url.pathname || '/'
    );
  } catch {
    return value || '—';
  }
}

function renderGoogleSearchSummary(
  summary = {}
) {
  setText(
    'searchConsoleClicks',
    Number(
      summary.clicks || 0
    ).toLocaleString(
      'en-MY'
    )
  );

  setText(
    'searchConsoleImpressions',
    Number(
      summary.impressions || 0
    ).toLocaleString(
      'en-MY'
    )
  );

  setText(
    'searchConsoleCtr',
    `${Number(
      summary.ctr_percentage || 0
    ).toFixed(2)}%`
  );

  const averagePosition =
    Number(
      summary.average_position || 0
    );

  setText(
    'searchConsolePosition',
    averagePosition > 0
      ? averagePosition.toFixed(1)
      : '—'
  );
}

function renderGoogleSearchQueries(
  queries =
    googleSearchState.queries
) {
  const tbody =
    document.getElementById(
      'searchConsoleQueriesBody'
    );

  const pager =
    document.getElementById(
      'searchConsoleQueriesPager'
    );

  if (!tbody) {
    return;
  }

  googleSearchState.queries =
    Array.isArray(queries)
      ? queries
      : [];

  const result =
    paginateClientItems(
      googleSearchState.queries,
      googleSearchState.queryPage,
      googleSearchState.limit
    );

  googleSearchState.queryPage =
    result.pagination.page;

  if (
    !result.items.length
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-row"
        >
          Search queries are not available yet.
          Google may hide low-volume queries
          for privacy.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (row) => `
          <tr>
            <td>
              <strong>
                ${escapeHtml(
                  row.query ||
                  'Unknown query'
                )}
              </strong>
            </td>

            <td>
              ${Number(
                row.clicks || 0
              ).toLocaleString(
                'en-MY'
              )}
            </td>

            <td>
              ${Number(
                row.impressions || 0
              ).toLocaleString(
                'en-MY'
              )}
            </td>

            <td>
              ${Number(
                row.ctr_percentage ||
                0
              ).toFixed(2)}%
            </td>

            <td>
              ${Number(
                row.position || 0
              ).toFixed(1)}
            </td>
          </tr>
        `
      )
      .join('');

  renderPager(
    pager,
    result.pagination,
    (page) => {
      googleSearchState.queryPage =
        page;

      renderGoogleSearchQueries();
    }
  );
}

function renderGoogleSearchPages(
  pages =
    googleSearchState.pages
) {
  const tbody =
    document.getElementById(
      'searchConsolePagesBody'
    );

  const pager =
    document.getElementById(
      'searchConsolePagesPager'
    );

  if (!tbody) {
    return;
  }

  googleSearchState.pages =
    Array.isArray(pages)
      ? pages
      : [];

  const result =
    paginateClientItems(
      googleSearchState.pages,
      googleSearchState.pagePage,
      googleSearchState.limit
    );

  googleSearchState.pagePage =
    result.pagination.page;

  if (
    !result.items.length
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-row"
        >
          No landing-page data found
          for this date range.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (row) => `
          <tr>
            <td
              title="${escapeAttribute(
                row.page || ''
              )}"
            >
              <strong>
                ${escapeHtml(
                  formatSearchConsolePage(
                    row.page
                  )
                )}
              </strong>

              <div class="cell-subtext">
                ${escapeHtml(
                  row.page || ''
                )}
              </div>
            </td>

            <td>
              ${Number(
                row.clicks || 0
              ).toLocaleString(
                'en-MY'
              )}
            </td>

            <td>
              ${Number(
                row.impressions || 0
              ).toLocaleString(
                'en-MY'
              )}
            </td>

            <td>
              ${Number(
                row.ctr_percentage ||
                0
              ).toFixed(2)}%
            </td>

            <td>
              ${Number(
                row.position || 0
              ).toFixed(1)}
            </td>
          </tr>
        `
      )
      .join('');

  renderPager(
    pager,
    result.pagination,
    (page) => {
      googleSearchState.pagePage =
        page;

      renderGoogleSearchPages();
    }
  );
}

async function loadGoogleSearchPerformance(
  startDate,
  endDate
) {
  const queryBody =
    document.getElementById(
      'searchConsoleQueriesBody'
    );

  const pageBody =
    document.getElementById(
      'searchConsolePagesBody'
    );

  /*
    HTML Search Console mungkin belum ditambah.
    Dalam keadaan itu, jangan buat API request.
  */
  if (
    !queryBody &&
    !pageBody
  ) {
    return;
  }

  if (
    !startDate ||
    !endDate
  ) {
    return;
  }

  if (queryBody) {
    queryBody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="loading-row"
        >
          Loading Google Search queries...
        </td>
      </tr>
    `;
  }

  if (pageBody) {
    pageBody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="loading-row"
        >
          Loading landing pages...
        </td>
      </tr>
    `;
  }

  try {
    if (
      !authedApi
        ?.getGoogleSearchPerformance
    ) {
      throw new Error(
        'Google Search API function is unavailable.'
      );
    }

    const data =
      await authedApi
        .getGoogleSearchPerformance(
          startDate,
          endDate
        );

    renderGoogleSearchSummary(
      data?.summary || {}
    );

    googleSearchState.queryPage = 1;
    googleSearchState.pagePage = 1;
    renderGoogleSearchQueries(
      Array.isArray(
        data?.queries
      )
        ? data.queries
        : []
    );

    renderGoogleSearchPages(
      Array.isArray(
        data?.pages
      )
        ? data.pages
        : []
    );
  } catch (error) {
    console.error(
      'Unable to load Google Search performance:',
      error
    );

    const message =
      escapeHtml(
        error.message ||
        'Unable to load Google Search data.'
      );

    if (queryBody) {
      queryBody.innerHTML = `
        <tr>
          <td
            colspan="5"
            class="empty-row"
          >
            ${message}
          </td>
        </tr>
      `;
    }

    if (pageBody) {
      pageBody.innerHTML = `
        <tr>
          <td
            colspan="5"
            class="empty-row"
          >
            ${message}
          </td>
        </tr>
      `;
    }
  }
}

function performanceExportFilterRows(
  report
) {
  const branchSelect =
    document.getElementById(
      'performanceBranchFilter'
    );

  return [
    [
      'Start date',
      report.filters
        ?.start_date || '',
    ],

    [
      'End date',
      report.filters
        ?.end_date || '',
    ],

    [
      'Branch',

      branchSelect
        ?.selectedOptions?.[0]
        ?.textContent
        ?.trim() ||
        'All branches',
    ],

    [
      'Exported at',

      new Date()
        .toLocaleString(
          'en-MY'
        ),
    ],
  ];
}

function appendPerformanceMetricSheet(
  workbook,
  sheetName,
  metricLabel,
  metricValue,
  filterRows
) {
  const worksheet =
    XLSX.utils
      .aoa_to_sheet([
        [
          'Website Performance Report',
        ],

        [],

        [
          'Metric',
          metricLabel,
        ],

        [
          'Value',
          Number(
            metricValue || 0
          ),
        ],

        [],

        ...filterRows,
      ]);

  worksheet['!cols'] = [
    {
      wch: 24,
    },

    {
      wch: 28,
    },
  ];

  XLSX.utils
    .book_append_sheet(
      workbook,
      worksheet,
      sheetName
    );
}

function exportPerformanceWorkbook() {
  if (!performanceReportCache) {
  showKpToast({
    title:
      'Report not ready',

    message:
      'Load the performance report before exporting.',

    duration: 6000,
  });

  return;
}

  if (
  typeof XLSX ===
  'undefined'
) {
  showKpToast({
    title:
      'Export unavailable',

    message:
      'The Excel export library could not be loaded. Please refresh the page and try again.',

    duration: 7000,
  });

  return;
}

  const report =
    performanceReportCache;

  const summary =
    report.summary || {};

  const filterRows =
    performanceExportFilterRows(
      report
    );

  const workbook =
    XLSX.utils.book_new();

  appendPerformanceMetricSheet(
    workbook,
    'Total Interactions',
    'Total interactions',
    summary.total_interactions,
    filterRows
  );

  appendPerformanceMetricSheet(
    workbook,
    'Website Visits',
    'Website visits',
    summary.website_visits,
    filterRows
  );

  appendPerformanceMetricSheet(
    workbook,
    'Calls',
    'Call clicks',
    summary.calls,
    filterRows
  );

  appendPerformanceMetricSheet(
    workbook,
    'Bookings',
    'Successful bookings',
    summary.bookings,
    filterRows
  );

  appendPerformanceMetricSheet(
    workbook,
    'Directions',
    'Direction clicks',
    summary.directions,
    filterRows
  );

  appendPerformanceMetricSheet(
    workbook,
    'WhatsApp',
    'WhatsApp clicks',
    summary.whatsapp_clicks,
    filterRows
  );

  const dailySheet =
    XLSX.utils
      .json_to_sheet(
        (
          report.daily ||
          []
        ).map(
          (item) => ({
            Date:
              item.date,

            'Website Visits':
              Number(
                item
                  .website_visits ||
                0
              ),

            'Total Interactions':
              Number(
                item
                  .total_interactions ||
                0
              ),
          })
        )
      );

  dailySheet['!cols'] = [
    {
      wch: 16,
    },

    {
      wch: 18,
    },

    {
      wch: 20,
    },
  ];

  XLSX.utils
    .book_append_sheet(
      workbook,
      dailySheet,
      'Daily Trend'
    );

  const branchSheet =
    XLSX.utils
      .json_to_sheet(
        (
          report.branches ||
          []
        ).map(
          (branch) => ({
            Branch:
              branch.branch_name,

            Calls:
              Number(
                branch.calls ||
                0
              ),

            Bookings:
              Number(
                branch.bookings ||
                0
              ),

            Directions:
              Number(
                branch.directions ||
                0
              ),

            WhatsApp:
              Number(
                branch
                  .whatsapp_clicks ||
                0
              ),

            'Total Interactions':
              Number(
                branch
                  .total_interactions ||
                0
              ),
          })
        )
      );

  branchSheet['!cols'] = [
    {
      wch: 28,
    },

    {
      wch: 12,
    },

    {
      wch: 12,
    },

    {
      wch: 14,
    },

    {
      wch: 14,
    },

    {
      wch: 20,
    },
  ];

  XLSX.utils
    .book_append_sheet(
      workbook,
      branchSheet,
      'Branches'
    );

  const deviceSheet =
    XLSX.utils
      .json_to_sheet(
        (
          report.devices ||
          []
        ).map(
          (device) => ({
            Device:
              device
                .device_type ===
              'mobile'
                ? 'Phone / tablet'
                : 'Desktop',

            'Unique Sessions':
              Number(
                device.users ||
                0
              ),
          })
        )
      );

  deviceSheet['!cols'] = [
    {
      wch: 22,
    },

    {
      wch: 18,
    },
  ];

  XLSX.utils
    .book_append_sheet(
      workbook,
      deviceSheet,
      'Device Access'
    );

    const genderSheet =
  XLSX.utils
    .json_to_sheet(
      (
        report.genders ||
        []
      ).map(
        (item) => ({
          Gender:
            item.gender ===
            'female'
              ? 'Female'
              : 'Male',

          Bookings:
            Number(
              item.bookings ||
              0
            ),
        })
      )
    );

genderSheet['!cols'] = [
  {
    wch: 18,
  },

  {
    wch: 14,
  },
];

XLSX.utils
  .book_append_sheet(
    workbook,
    genderSheet,
    'Booking Gender'
  );

  const startDate =
    report.filters
      ?.start_date ||
    'start';

  const endDate =
    report.filters
      ?.end_date ||
    'end';

  XLSX.writeFile(
    workbook,

    `website-performance-${startDate}-to-${endDate}.xlsx`
  );
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

    return `
      <tr data-id="${booking.id}">
        <td>
  <button
    class="booking-ref booking-details-trigger"
    type="button"
    data-action="view-booking-details"
    data-id="${booking.id}"
    title="View booking details"
    aria-label="View booking details for ${escapeAttribute(
      formatBookingRef(booking.id)
    )}"
  >
    ${escapeHtml(
      formatBookingRef(booking.id)
    )}
  </button>
</td>
        <td>
          <strong>${escapeHtml(booking.patient_name)}</strong>
        </td>
        <td>${escapeHtml(booking.phone)}</td>
        <td>${escapeHtml(booking.branch_name || '—')}</td>
        <td>${escapeHtml(booking.doctor_name || '—')}</td>
        <td>${escapeHtml(booking.service_title || '—')}</td>
        <td>${formatDate(booking.preferred_date)}</td>
        <td>${escapeHtml(booking.preferred_time || '—')}</td>
        <td class="reason-col">
  <div class="reason-preview">
    <span class="reason-text">
      ${escapeHtml(booking.reason || '—')}
    </span>

    ${
      booking.reason
        ? `
          <button
            class="reason-view-btn"
            type="button"
            data-action="view-booking-reason"
            data-id="${booking.id}"
            title="Read full reason"
            aria-label="Read full booking reason"
            hidden
          >
            Read
          </button>
        `
        : ''
    }
  </div>
</td>
        <td>
          <select class="status-select status-${escapeAttribute(booking.status)}" data-id="${booking.id}">
            ${statusOption('pending', booking.status, 'Pending')}
            ${statusOption('confirmed', booking.status, 'Confirmed')}
            ${statusOption('completed', booking.status, 'Completed')}
            ${statusOption('cancelled', booking.status, 'Cancelled')}
          </select>
        </td>
        <td>
          <div class="booking-actions">
            ${
  whatsappLink
    ? `
      <a
        class="booking-whatsapp-btn"
        href="${escapeAttribute(whatsappLink)}"
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp patient"
        aria-label="Open WhatsApp chat with patient"
      >
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Zm5.87-8.01c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
          />
        </svg>
      </a>
    `
    : `
      <span
        class="booking-whatsapp-btn is-disabled"
        title="Invalid phone number"
        aria-label="WhatsApp unavailable"
      >
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Z"
          />
        </svg>
      </span>
    `
}
            ${
  hasManagementAccess()
    ? `
      <button
        class="btn-small danger"
        type="button"
        data-action="delete-booking"
        data-id="${booking.id}"
      >
        Delete
      </button>
    `
    : ''
}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  requestAnimationFrame(() => {
  updateReasonReadButtons(tbody);
});

tbody
  .querySelectorAll(
    '[data-action="view-booking-details"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const booking =
          bookings.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.id
              )
          );

        if (!booking) {
          return;
        }

        openBookingDetailsModal(
          booking
        );
      }
    );
  });

  tbody
  .querySelectorAll(
    '[data-action="view-booking-reason"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const booking =
          bookings.find(
            (item) =>
              String(item.id) ===
              String(button.dataset.id)
          );

        if (!booking) {
          return;
        }

        openBookingDetailsModal(booking);
      }
    );
  });

  tbody
  .querySelectorAll(
    '.status-select'
  )
  .forEach((select) => {
    select.addEventListener(
      'change',
      async () => {
        const previous =
          select.dataset.previous ||
          '';

        const nextStatus =
          select.value;

        const booking =
          bookings.find(
            (item) =>
              String(item.id) ===
              String(
                select.dataset.id
              )
          );

        const reference =
          formatBookingRef(
            select.dataset.id
          );

        select.disabled = true;

        try {
          await authedApi
            .updateBookingStatus(
              select.dataset.id,
              nextStatus
            );

          select.dataset.previous =
            nextStatus;

          select.className =
            `status-select status-${nextStatus}`;

          await loadBookings();

          showKpToast({
            title:
              'Booking status updated',

            message:
              `${reference} is now ${formatBookingStatusLabel(
                nextStatus
              )}.`,

            duration: 4500,
          });
        } catch (error) {
          if (previous) {
            select.value =
              previous;

            select.className =
              `status-select status-${previous}`;
          }

          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to update booking',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          select.disabled = false;
        }
      }
    );

    select.dataset.previous =
      select.value;
  });

  tbody
  .querySelectorAll(
    '[data-action="delete-booking"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const booking =
          bookings.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.id
              )
          );

        const reference =
          formatBookingRef(
            button.dataset.id
          );

        const patientName =
          booking?.patient_name ||
          'this patient';

        const confirmed =
          await confirmDelete({
            title:
              `Delete ${reference}?`,

            message:
              `The booking for ${patientName} will be permanently removed. This action cannot be undone.`,
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .deleteBooking(
              button.dataset.id
            );

          await loadBookings();

          showKpToast({
            title:
              'Booking deleted',

            message:
              `${reference} has been permanently removed.`,

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to delete booking',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });
}

function updateReasonReadButtons(
  container = document
) {
  container
    .querySelectorAll(
      '.reason-preview'
    )
    .forEach((preview) => {
      const text =
        preview.querySelector(
          '.reason-text'
        );

      const button =
        preview.querySelector(
          '.reason-view-btn'
        );

      if (!text || !button) {
        return;
      }

      /*
        Reset dahulu supaya ukuran dibuat
        menggunakan ruang penuh kolum Reason.
      */
      preview.classList.remove(
        'has-read-button'
      );

      button.hidden = true;

      const isOverflowing =
        text.scrollWidth >
        text.clientWidth + 1;

      if (isOverflowing) {
        preview.classList.add(
          'has-read-button'
        );

        button.hidden = false;
      }
    });
}

function openBookingDetailsModal(
  booking
) {
  const ticketHtml =
    buildBookingTicketMarkup(
      booking
    );

  showModal(
    '',
    `
      <div class="booking-ticket-shell">
        ${ticketHtml}

        <div class="booking-ticket-actions">
          <button
            class="booking-ticket-download"
            id="downloadBookingTicketBtn"
            type="button"
          >
            Download Ticket
          </button>

          <button
            class="booking-ticket-close"
            id="closeBookingDetailsBtn"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    `,
    (event) => {
      event.preventDefault();
    }
  );

  document
    .getElementById(
      'closeBookingDetailsBtn'
    )
    ?.addEventListener(
      'click',
      closeModal
    );

  document
    .getElementById(
      'downloadBookingTicketBtn'
    )
    ?.addEventListener(
      'click',
      () =>
        downloadBookingTicket(
          booking
        )
    );
}

function buildBookingTicketMarkup(
  booking
) {
  const reason =
    String(
      booking.reason || ''
    ).trim() ||
    'No reason provided.';

  const gender =
    formatBookingGender(
      booking.gender
    );

  const resolvedIdentityType =
    booking.identity_type ||
    (
      booking.ic_number
        ? 'ic'
        : ''
    );

  const identityType =
    formatBookingIdentityType(
      resolvedIdentityType
    );

  const identityNumber =
    String(
      booking.identity_number ||
      booking.ic_number ||
      ''
    ).trim() ||
    'Not recorded';

  const statusLabel =
    formatBookingStatusLabel(
      booking.status
    );

  const statusClass =
    String(
      booking.status || 'pending'
    )
      .trim()
      .toLowerCase();

  return `
    <article class="kp-ticket">

      <header class="kp-ticket-header">
        <img
          src="images/logoklinik.png"
          alt="Klinik Putrijaya"
          class="kp-ticket-logo"
        >

        <div class="kp-ticket-brand-text">
          <strong>KLINIK PUTRIJAYA</strong>
          <span>Appointment Booking</span>
        </div>
      </header>

      <div class="kp-ticket-title">
        <span></span>
        <h2>Booking Details</h2>
        <span></span>
      </div>

      <div class="kp-ticket-cut-line"></div>

      <section class="kp-ticket-reference">
        <div>
          <span>Reference</span>

          <strong>
            ${escapeHtml(
              formatBookingRef(
                booking.id
              )
            )}
          </strong>
        </div>
      </section>

      <section class="kp-ticket-section">
        <div class="kp-ticket-section-heading">
          <span class="kp-ticket-icon">
            ♙
          </span>

          <h3>Patient Information</h3>
        </div>

        <div class="kp-ticket-list">
          ${renderTicketRow(
            'Patient',
            booking.patient_name ||
              'Not recorded'
          )}

          ${renderTicketRow(
            'Gender',
            gender
          )}

          ${renderTicketRow(
            'Phone',
            booking.phone ||
              'Not recorded'
          )}

          ${renderTicketRow(
            'Identification Type',
            identityType
          )}

          ${renderTicketRow(
            'Identification Number',
            identityNumber
          )}
        </div>
      </section>

      <section class="kp-ticket-section">
        <div class="kp-ticket-section-heading">
          <span class="kp-ticket-icon">
            ◫
          </span>

          <h3>Appointment Information</h3>
        </div>

        <div class="kp-ticket-list">
          ${renderTicketRow(
            'Branch',
            booking.branch_name ||
              'Not recorded'
          )}

          ${renderTicketRow(
            'Doctor',
            booking.doctor_name ||
              'Any available doctor'
          )}

          ${renderTicketRow(
            'Service',
            booking.service_title ||
              'General consultation'
          )}

          ${renderTicketRow(
            'Preferred Date',
            formatDate(
              booking.preferred_date
            )
          )}

          ${renderTicketRow(
            'Preferred Time',
            booking.preferred_time ||
              'Not recorded'
          )}

          ${renderTicketRow(
            'Status',
            statusLabel,
            `
              kp-ticket-status
              kp-ticket-status-${escapeAttribute(
                statusClass
              )}
            `
          )}
        </div>
      </section>

      <section class="kp-ticket-reason">
        <div class="kp-ticket-section-heading">
          <span class="kp-ticket-icon">
            □
          </span>

          <h3>Reason Provided</h3>
        </div>

        <p>${escapeHtml(reason)}</p>
      </section>

      <footer class="kp-ticket-footer">
        <strong>Thank You</strong>
        <span>Your health, our priority.</span>
      </footer>

    </article>
  `;
}

function renderTicketRow(
  label,
  value,
  customClass = ''
) {
  return `
    <div class="kp-ticket-row">
      <span class="kp-ticket-row-icon">
        •
      </span>

      <span class="kp-ticket-row-label">
        ${escapeHtml(label)}
      </span>

      <strong
        class="${escapeAttribute(
          customClass
        )}"
      >
        ${escapeHtml(
          value || 'Not recorded'
        )}
      </strong>
    </div>
  `;
}

function renderBookingTicketItem(
  label,
  value,
  customClass = ''
) {
  return `
    <div class="booking-ticket-item">
      <span>${escapeHtml(label)}</span>

      <strong class="${escapeAttribute(customClass)}">
        ${escapeHtml(
          value || 'Not recorded'
        )}
      </strong>
    </div>
  `;
}

function downloadBookingTicket(
  booking
) {
  const ticketMarkup =
    buildBookingTicketMarkup(
      booking
    );

  const ticketWindow =
    window.open(
      '',
      '_blank',
      'width=820,height=1050'
    );

  if (!ticketWindow) {
  showKpToast({
    title:
      'Popup blocked',

    message:
      'Please allow popups for this website, then try downloading the booking ticket again.',

    duration: 8000,
  });

  return;
}

  const reference =
    formatBookingRef(
      booking.id
    );

  ticketWindow.document.open();

  ticketWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>${escapeHtml(
        reference
      )} Booking Ticket</title>

      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          min-height: 100%;
          margin: 0;
          padding: 0;
        }

        body {
          display: flex;
          align-items: center;
          justify-content: center;

          min-height: 100vh;
          padding: 12mm;

          color: #272129;
          background: #f7f3f5;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          -webkit-print-color-adjust:
            exact;

          print-color-adjust:
            exact;
        }

        .kp-ticket {
          --ticket-accent: #c9447f;
          --ticket-accent-dark: #9f2f63;
          --ticket-soft: #fff2f7;
          --ticket-border: #ead7e0;
          --ticket-text: #272129;
          --ticket-muted: #776972;

          position: relative;

          width: 108mm;
          max-width: 100%;
          margin: 0 auto;

          overflow: hidden;

          color: var(--ticket-text);
          background: #fff;

          border: 1px solid
            var(--ticket-border);

          border-radius: 5mm;

          box-shadow:
            0 4mm 12mm
            rgba(49, 35, 42, 0.12);
        }

        .kp-ticket::before,
        .kp-ticket::after {
          content: "";

          position: absolute;
          top: 42mm;
          z-index: 3;

          width: 7mm;
          height: 13mm;

          background: #f7f3f5;
          border-radius: 50%;
        }

        .kp-ticket::before {
          left: -3.8mm;
        }

        .kp-ticket::after {
          right: -3.8mm;
        }

        .kp-ticket-header {
          display: flex;
          align-items: center;
          gap: 3mm;

          padding:
            6mm
            7mm
            3mm;
        }

        .kp-ticket-logo {
          display: block;

          width: 27mm;
          max-height: 11mm;

          object-fit: contain;
          object-position: left center;
        }

        .kp-ticket-brand-text {
          display: grid;
          gap: 0.6mm;
        }

        .kp-ticket-brand-text strong {
          color:
            var(--ticket-accent-dark);

          font-size: 8pt;
          letter-spacing: 0.04em;
        }

        .kp-ticket-brand-text span {
          color: var(--ticket-muted);
          font-size: 6.5pt;
        }

        .kp-ticket-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.5mm;

          padding:
            3mm
            7mm
            4mm;
        }

        .kp-ticket-title span {
          width: 1.5mm;
          height: 1.5mm;

          border-radius: 50%;
          background:
            var(--ticket-accent);
        }

        .kp-ticket-title h2 {
          margin: 0;

          color:
            var(--ticket-accent-dark);

          font-size: 10pt;
          font-weight: 800;

          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .kp-ticket-cut-line {
          margin: 0 7mm;

          border-top:
            1px dashed
            rgba(
              183,
              145,
              164,
              0.65
            );
        }

        .kp-ticket-reference {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 5mm;

          padding:
            5mm
            7mm
            4mm;
        }

        .kp-ticket-reference span {
          display: block;
          margin-bottom: 1.3mm;

          color: var(--ticket-muted);

          font-size: 6.5pt;
          font-weight: 700;

          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .kp-ticket-reference strong {
          display: block;

          color: var(--ticket-text);

          font-size: 14pt;
          font-weight: 800;

          letter-spacing: 0.025em;
        }

        /*
          Jangan papar QR palsu dalam PDF.
        */
        .kp-ticket-qr {
          display: none !important;
        }

        .kp-ticket-section,
        .kp-ticket-reason {
          margin:
            0
            7mm
            3.5mm;

          padding-top: 3.5mm;

          border-top:
            1px solid
            #eee3e8;
        }

        .kp-ticket-section-heading {
          display: flex;
          align-items: center;
          gap: 2.2mm;

          margin-bottom: 2mm;
        }

        .kp-ticket-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          width: 6.5mm;
          height: 6.5mm;

          border-radius: 50%;

          color:
            var(--ticket-accent-dark);

          background:
            var(--ticket-soft);

          font-size: 7pt;
          font-weight: 700;
        }

        .kp-ticket-section-heading h3 {
          margin: 0;

          color:
            var(--ticket-accent-dark);

          font-size: 7pt;
          font-weight: 800;

          letter-spacing: 0.055em;
          text-transform: uppercase;
        }

        .kp-ticket-list {
          display: grid;
        }

        .kp-ticket-row {
          display: grid;

          grid-template-columns:
            4mm
            34mm
            minmax(0, 1fr);

          align-items: start;
          gap: 2mm;

          min-width: 0;

          padding:
            1.7mm
            0;

          border-bottom:
            1px solid
            #f1e9ed;
        }

        .kp-ticket-row:last-child {
          border-bottom: 0;
        }

        .kp-ticket-row-icon {
          color:
            var(--ticket-accent-dark);

          font-size: 7pt;
        }

        .kp-ticket-row-label {
          color: var(--ticket-muted);

          font-size: 7pt;
          font-weight: 600;

          line-height: 1.35;
        }

        .kp-ticket-row strong {
          min-width: 0;

          color: var(--ticket-text);

          font-size: 7.5pt;
          font-weight: 700;

          line-height: 1.35;

          white-space: normal;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .kp-ticket-status {
          display: inline-flex;

          width: fit-content;

          padding:
            1mm
            2.6mm;

          border-radius: 999px;
        }

        .kp-ticket-status-pending {
          color: #8a5d16;
          background: #fff0c9;
        }

        .kp-ticket-status-confirmed {
          color: #196178;
          background: #dff4fa;
        }

        .kp-ticket-status-completed {
          color: #276f50;
          background: #e1f2e8;
        }

        .kp-ticket-status-cancelled {
          color: #9a3c50;
          background: #f9e2e8;
        }

        .kp-ticket-reason p {
          margin: 0;

          padding:
            1mm
            0
            4mm;

          color: var(--ticket-text);

          font-size: 7.5pt;
          line-height: 1.5;

          white-space: pre-line;
          overflow-wrap: anywhere;
        }

        .kp-ticket-footer {
          padding:
            5mm
            6mm
            6mm;

          text-align: center;

          background:
            linear-gradient(
              180deg,
              #fdebf2 0%,
              #f8dce8 100%
            );
        }

        .kp-ticket-footer strong {
          display: block;

          color:
            var(--ticket-accent-dark);

          font-size: 8pt;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .kp-ticket-footer span {
          display: block;

          margin-top: 1.2mm;

          color: var(--ticket-muted);
          font-size: 6.5pt;
        }

        @media print {
          html,
          body {
            width: 210mm;
            height: 297mm;

            overflow: hidden;
          }

          body {
            padding: 10mm;
            background: #fff;
          }

          .kp-ticket {
            break-inside: avoid;
            page-break-inside: avoid;

            box-shadow: none;
          }
        }
      </style>
    </head>

    <body>
      ${ticketMarkup}

      <script>
        window.addEventListener(
          'load',
          function () {
            setTimeout(
              function () {
                window.print();
              },
              500
            );
          }
        );
      <\/script>
    </body>
    </html>
  `);

  ticketWindow.document.close();
}

function formatBookingGender(
  value
) {
  const gender =
    String(value || '')
      .trim()
      .toLowerCase();

  if (gender === 'female') {
    return 'Female';
  }

  if (gender === 'male') {
    return 'Male';
  }

  return 'Not recorded';
}

function formatBookingIdentityType(
  value
) {
  const identityType =
    String(value || '')
      .trim()
      .toLowerCase();

  if (identityType === 'ic') {
    return 'Malaysian IC';
  }

  if (
    identityType === 'passport'
  ) {
    return 'Passport';
  }

  return 'Not recorded';
}

function formatBookingStatusLabel(
  value
) {
  const status =
    String(value || '')
      .trim()
      .toLowerCase();

  const labels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    labels[status] ||
    'Not recorded'
  );
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
  showKpToast({
    title:
      'No bookings to export',

    message:
      'No booking records match the current filters.',

    duration: 6000,
  });

  return;
}

    const headers = [
      'Reference', 'Patient Name', 'Phone', 'Branch', 'Doctor',
      'Service', 'Preferred Date', 'Preferred Time', 'Reason', 'Status',
    ];

    const rows = bookings.map((booking) => [
      formatBookingRef(booking.id),
      booking.patient_name || '',
      booking.phone || '',
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
    if (
      !handleAuthError(error)
    ) {
      showKpToast({
        title:
          'Unable to export bookings',

        message:
          error.message ||
          'Please try again.',

        duration: 7000,
      });
    }
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

    tbody
  .querySelectorAll(
    '[data-action="approve-feedback"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        button.disabled = true;

        try {
          await authedApi
            .approveFeedback(
              button.dataset.id
            );

          await loadFeedback();

          showKpToast({
            title:
              'Feedback approved',
            message:
              'The feedback is now approved and ready for display.',
            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to approve feedback',
              message:
                error.message ||
                'Please try again.',
              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });

    tbody
  .querySelectorAll(
    '[data-action="delete-feedback"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const confirmed =
          await confirmDelete({
            title:
              'Delete this feedback?',
            message:
              'This feedback will be permanently removed and cannot be recovered.',
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .deleteFeedback(
              button.dataset.id
            );

          await loadFeedback();

          showKpToast({
            title:
              'Feedback deleted',
            message:
              'The feedback has been permanently removed.',
            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to delete feedback',
              message:
                error.message ||
                'Please try again.',
              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
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
  const tbody =
    document.getElementById(
      'doctorsTableBody'
    );

  if (
    !tbody ||
    !authedApi
  ) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="6"
        class="loading-row"
      >
        Loading…
      </td>
    </tr>
  `;

  try {
    doctorsCache =
      await authedApi
        .getAdminDoctors();

    populateDoctorBranchFilter();

    renderDoctors();
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="empty-row"
          >
            ${escapeHtml(
              error.message ||
              'Unable to load doctors.'
            )}
          </td>
        </tr>
      `;
    }
  }
}

function populateDoctorBranchFilter() {
  const select =
    document.getElementById(
      'doctorBranchFilter'
    );

  if (!select) {
    return;
  }

  const currentValue =
    doctorState.branch ||
    select.value ||
    '';

  select.innerHTML = [
    `
      <option value="">
        All branches
      </option>
    `,

    ...branchesCache.map(
      (branch) => `
        <option
          value="${Number(
            branch.id
          )}"
        >
          ${escapeHtml(
            branch.name
          )}
        </option>
      `
    ),
  ].join('');

  if (
    currentValue &&
    branchesCache.some(
      (branch) =>
        String(branch.id) ===
        String(currentValue)
    )
  ) {
    select.value =
      currentValue;
  }

  doctorState.branch =
    select.value;
}

function renderDoctors() {
  const tbody =
    document.getElementById(
      'doctorsTableBody'
    );

  const pager =
    document.getElementById(
      'doctorsPager'
    );

  if (!tbody) {
    return;
  }

  const filteredDoctors =
    doctorsCache.filter(
      (doctor) => {
        if (
          !doctorState.branch
        ) {
          return true;
        }

        return (
          String(
            doctor.branch_id
          ) ===
          String(
            doctorState.branch
          )
        );
      }
    );

  const result =
    paginateClientItems(
      filteredDoctors,
      doctorState.page,
      doctorState.limit
    );

  doctorState.page =
    result.pagination.page;

  if (
    !result.items.length
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          No doctors found.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (doctor) => `
          <tr data-id="${doctor.id}">
            <td>
              <div class="doctor-admin-cell">
                ${
                  doctor.photo_url
                    ? `
                      <img
                        src="${escapeAttribute(
                          resolveImageUrl(
                            doctor.photo_url
                          )
                        )}"
                        alt=""
                      >
                    `
                    : `
                      <span
                        class="doctor-admin-placeholder"
                      >
                        DR
                      </span>
                    `
                }

                <strong>
                  ${escapeHtml(
                    doctor.name
                  )}
                </strong>
              </div>
            </td>

            <td>
              ${escapeHtml(
                doctor.branch_name ||
                '—'
              )}
            </td>

            <td class="wrap-text">
              ${escapeHtml(
                doctor.qualification ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                doctor.reg_no ||
                '—'
              )}
            </td>

            <td>
              ${
                Number(
                  doctor.is_active
                )
                  ? 'Yes'
                  : 'No'
              }
            </td>

            <td>
              <button
                class="btn-small"
                type="button"
                data-action="edit-doctor"
                data-id="${doctor.id}"
              >
                Edit
              </button>

              <button
                class="btn-small danger"
                type="button"
                data-action="delete-doctor"
                data-id="${doctor.id}"
              >
                Delete
              </button>
            </td>
          </tr>
        `
      )
      .join('');

  tbody
    .querySelectorAll(
      '[data-action="edit-doctor"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const doctor =
              doctorsCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            if (doctor) {
              openDoctorModal(
                doctor
              );
            }
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="delete-doctor"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          async () => {
            const doctor =
              doctorsCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            const doctorName =
              doctor?.name ||
              'this doctor';

            const confirmed =
              await confirmDelete({
                title:
                  `Delete ${doctorName}?`,

                message:
                  'Permanent deletion may not be allowed if this doctor has previous bookings. Use Inactive status instead when historical records must be retained.',
              });

            if (!confirmed) {
              return;
            }

            button.disabled = true;

            try {
              await authedApi
                .deleteDoctor(
                  button.dataset.id
                );

              await loadDoctors();

              showKpToast({
                title:
                  'Doctor deleted',

                message:
                  `${doctorName} has been removed.`,

                duration: 5000,
              });
            } catch (error) {
              if (
                !handleAuthError(
                  error
                )
              ) {
                showKpToast({
                  title:
                    'Unable to delete doctor',

                  message:
                    error.message ||
                    'The doctor may have existing records. Try setting the doctor to Inactive instead.',

                  duration: 8000,
                });
              }
            } finally {
              button.disabled =
                false;
            }
          }
        );
      }
    );

  renderPager(
    pager,
    result.pagination,
    (page) => {
      doctorState.page =
        page;

      renderDoctors();
    }
  );
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
  <label for="m-doctor-photo">
    Doctor photo
  </label>

  <input
    id="m-doctor-photo"
    type="file"
    accept="image/jpeg,image/png,image/webp"
  >

  <input
    id="m-doctor-photo-url"
    type="hidden"
    value="${escapeAttribute(
      doctor?.photo_url || ''
    )}"
  >

  <div class="upload-help">
    JPEG, PNG or WebP. Maximum 5 MB.
    Portrait images work best.
  </div>

  <div
    id="m-doctor-preview-wrap"
    class="${doctor?.photo_url ? '' : 'hidden'}"
  >
    <img
      id="m-doctor-preview"
      class="admin-image-preview portrait"
      src="${
        doctor?.photo_url
          ? escapeAttribute(
              resolveImageUrl(
                doctor.photo_url
              )
            )
          : ''
      }"
      alt="Doctor photo preview"
    >

    <button
      type="button"
      class="btn-small danger"
      id="removeDoctorPhotoBtn"
    >
      Delete photo
    </button>
  </div>
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
  await authedApi
    .updateDoctor(
      doctor.id,
      payload
    );
} else {
  await authedApi
    .createDoctor(
      payload
    );
}

closeModal();

await loadDoctors();

showKpToast({
  title: isEdit
    ? 'Doctor updated successfully'
    : 'Doctor added successfully',

  message: isEdit
    ? `${payload.name}'s information has been updated.`
    : `${payload.name} has been added to the doctor list.`,

  duration: 5000,
});
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-doctor-photo', 'm-doctor-preview');

  const doctorPhotoInput =
  document.getElementById(
    'm-doctor-photo'
  );

const doctorPhotoUrl =
  document.getElementById(
    'm-doctor-photo-url'
  );

const doctorPreview =
  document.getElementById(
    'm-doctor-preview'
  );

const doctorPreviewWrap =
  document.getElementById(
    'm-doctor-preview-wrap'
  );

doctorPhotoInput?.addEventListener(
  'change',
  () => {
    if (
      doctorPhotoInput.files?.length
    ) {
      doctorPreviewWrap
        ?.classList.remove('hidden');
    }
  }
);

document
  .getElementById(
    'removeDoctorPhotoBtn'
  )
  ?.addEventListener(
    'click',
    async () => {
      const confirmed =
        await confirmDelete({
          title:
            'Delete doctor photo?',

          message:
            'The doctor photo will be removed after you save the doctor.',

          confirmText:
            'Remove photo',
        });

      if (!confirmed) return;

      doctorPhotoInput.value = '';
      doctorPhotoUrl.value = '';

      if (doctorPreview) {
        doctorPreview.src = '';
      }

      doctorPreviewWrap
        ?.classList.add('hidden');

      showKpToast({
        title:
          'Doctor photo removed',

        message:
          'Save the doctor to apply this change.',

        duration: 5000,
      });
    }
  );
}

// -----------------------------------------------------------------------------
// SERVICES: list, search, category / subcategory filters and pagination
// -----------------------------------------------------------------------------

async function loadServices() {
  const tbody =
    document.getElementById(
      'servicesTableBody'
    );

  if (
    !tbody ||
    !authedApi
  ) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="5"
        class="loading-row"
      >
        Loading…
      </td>
    </tr>
  `;

  try {
    servicesCache =
      await authedApi
        .getAdminServices();

    populateServiceListCategoryFilter();

    populateServiceListSubcategoryFilter();

    renderServices();
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="5"
            class="empty-row"
          >
            ${escapeHtml(
              error.message ||
              'Unable to load services.'
            )}
          </td>
        </tr>
      `;
    }
  }
}

function populateServiceListCategoryFilter() {
  const select =
    document.getElementById(
      'serviceListCategoryFilter'
    );

  if (!select) {
    return;
  }

  const currentValue =
    serviceListState.category ||
    select.value ||
    '';

  const categories = [
    ...new Map(
      servicesCache
        .filter(
          (service) =>
            service.category_id &&
            service.category_name
        )
        .map(
          (service) => [
            String(
              service.category_id
            ),
            {
              id:
                service.category_id,
              name:
                service.category_name,
            },
          ]
        )
    ).values(),
  ];

  select.innerHTML = [
    `
      <option value="">
        All categories
      </option>
    `,

    ...categories.map(
      (category) => `
        <option
          value="${Number(
            category.id
          )}"
        >
          ${escapeHtml(
            category.name
          )}
        </option>
      `
    ),
  ].join('');

  if (
    currentValue &&
    categories.some(
      (category) =>
        String(category.id) ===
        String(currentValue)
    )
  ) {
    select.value =
      currentValue;
  } else {
    select.value = '';

    serviceListState.category =
      '';
  }
}

function populateServiceListSubcategoryFilter() {
  const select =
    document.getElementById(
      'serviceListSubcategoryFilter'
    );

  if (!select) {
    return;
  }

  const currentValue =
    serviceListState.subcategory ||
    select.value ||
    '';

  const subcategories = [
    ...new Map(
      servicesCache
        .filter(
          (service) => {
            if (
              !service.subcategory_id ||
              !service.subcategory_name
            ) {
              return false;
            }

            if (
              serviceListState.category &&
              String(
                service.category_id
              ) !==
                String(
                  serviceListState.category
                )
            ) {
              return false;
            }

            return true;
          }
        )
        .map(
          (service) => [
            String(
              service.subcategory_id
            ),
            {
              id:
                service.subcategory_id,
              name:
                service.subcategory_name,
            },
          ]
        )
    ).values(),
  ];

  select.innerHTML = [
    `
      <option value="">
        All subcategories
      </option>
    `,

    ...subcategories.map(
      (subcategory) => `
        <option
          value="${Number(
            subcategory.id
          )}"
        >
          ${escapeHtml(
            subcategory.name
          )}
        </option>
      `
    ),
  ].join('');

  if (
    currentValue &&
    subcategories.some(
      (subcategory) =>
        String(
          subcategory.id
        ) ===
        String(
          currentValue
        )
    )
  ) {
    select.value =
      currentValue;
  } else {
    select.value = '';

    serviceListState.subcategory =
      '';
  }
}

function renderServices() {
  const tbody =
    document.getElementById(
      'servicesTableBody'
    );

  const pager =
    document.getElementById(
      'servicesPager'
    );

  if (!tbody) {
    return;
  }

  const search =
    String(
      serviceListState.search ||
      ''
    )
      .trim()
      .toLowerCase();

  const filteredServices =
    servicesCache.filter(
      (service) => {
        const matchesCategory =
          !serviceListState.category ||
          String(
            service.category_id
          ) ===
            String(
              serviceListState.category
            );

        const matchesSubcategory =
          !serviceListState.subcategory ||
          String(
            service.subcategory_id
          ) ===
            String(
              serviceListState.subcategory
            );

        if (
          !matchesCategory ||
          !matchesSubcategory
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const searchableText = [
          service.title,
          service.slug,
          service.kicker,
          service.description,
          service.full_description,
          service.keywords,
          service.category_name,
          service.subcategory_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText
          .includes(search);
      }
    );

  const result =
    paginateClientItems(
      filteredServices,
      serviceListState.page,
      serviceListState.limit
    );

  serviceListState.page =
    result.pagination.page;

  if (
    !result.items.length
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-row"
        >
          No services found.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (service) => `
          <tr
            data-id="${service.id}"
          >
            <td>
              <strong>
                ${escapeHtml(
                  service.category_name ||
                  formatCategory(
                    service.category_key
                  )
                )}
              </strong>

              ${
                service
                  .subcategory_name
                  ? `
                    <div
                      class="cell-subtext"
                    >
                      ${escapeHtml(
                        service
                          .subcategory_name
                      )}
                    </div>
                  `
                  : ''
              }

              <div
                class="cell-subtext"
              >
                Order ${Number(
                  service.sort_order ||
                  0
                )}
              </div>
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  service.title
                )}
              </strong>

              <div
                class="cell-subtext"
              >
                /${escapeHtml(
                  service.slug
                )}
              </div>

              ${
                service.keywords
                  ? `
                    <div
                      class="cell-subtext"
                    >
                      Keywords:
                      ${escapeHtml(
                        service.keywords
                      )}
                    </div>
                  `
                  : ''
              }
            </td>

            <td
              class="wrap-text"
            >
              ${escapeHtml(
                service.description ||
                '—'
              )}

              <div
                class="cell-subtext"
              >
                ${Number(
                  service.price_count ||
                  0
                )}
                price item(s)
                ·
                ${Number(
                  service.gallery_count ||
                  0
                )}
                image(s)
              </div>
            </td>

            <td>
              ${
                Number(
                  service.is_active
                )
                  ? 'Yes'
                  : 'No'
              }
            </td>

            <td>
              <div
                class="table-action-stack"
              >
                <button
                  class="btn-small"
                  type="button"
                  data-action="edit-service"
                  data-id="${service.id}"
                >
                  Edit details
                </button>

                <button
                  class="btn-small"
                  type="button"
                  data-action="manage-prices"
                  data-id="${service.id}"
                >
                  Prices
                </button>

                <button
                  class="btn-small"
                  type="button"
                  data-action="manage-gallery"
                  data-id="${service.id}"
                >
                  Gallery
                </button>

                <a
                  class="btn-small"
                  href="service-detail.html?slug=${encodeURIComponent(
                    service.slug
                  )}"
                  target="_blank"
                  rel="noopener"
                >
                  Preview
                </a>

                <button
                  class="btn-small danger"
                  type="button"
                  data-action="delete-service"
                  data-id="${service.id}"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join('');

  bindServiceTableActions();

  renderPager(
    pager,
    result.pagination,
    (page) => {
      serviceListState.page =
        page;

      renderServices();
    }
  );
}

function bindServiceTableActions() {
  const tbody =
    document.getElementById(
      'servicesTableBody'
    );

  if (!tbody) {
    return;
  }

  tbody
    .querySelectorAll(
      '[data-action="edit-service"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const service =
              servicesCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            if (service) {
              openServiceModal(
                service
              );
            }
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="manage-prices"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            openPriceManager(
              Number(
                button.dataset.id
              )
            );
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="manage-gallery"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            openGalleryManager(
              Number(
                button.dataset.id
              )
            );
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="delete-service"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          async () => {
            const service =
              servicesCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            const serviceTitle =
              service?.title ||
              'this service';

            const confirmed =
              await confirmDelete({
                title:
                  `Delete ${serviceTitle}?`,

                message:
                  'This will permanently remove the service together with its price list and gallery images. This action cannot be undone.',
              });

            if (!confirmed) {
              return;
            }

            button.disabled = true;

            try {
              await authedApi
                .deleteService(
                  button.dataset.id
                );

              await loadServices();

              showKpToast({
                title:
                  'Service deleted',

                message:
                  `${serviceTitle} has been permanently removed.`,

                duration: 5000,
              });
            } catch (error) {
              if (
                !handleAuthError(
                  error
                )
              ) {
                showKpToast({
                  title:
                    'Unable to delete service',

                  message:
                    error.message ||
                    'Please try again.',

                  duration: 8000,
                });
              }
            } finally {
              button.disabled =
                false;
            }
          }
        );
      }
    );
}

function getServiceCategoryKey(categorySlug) {
  const categoryKeyMap = {
    'family-general-medicine': 'general',
    'womens-maternity-care': 'women',
    'procedures-minor-care': 'treatment',
    'wellness-certification': 'special',
  };

  return (
    categoryKeyMap[
      String(categorySlug || '')
        .trim()
        .toLowerCase()
    ] || 'general'
  );
}

async function openServiceModal(service = null) {
  const isEdit = Boolean(service);
  const isLegacy =
    isEdit && !Number(service?.subcategory_id);

  let categories = [];
  let subcategories = [];
  let branches = [];

  try {
    [categories, subcategories, branches] =
      await Promise.all([
        KPApi.getServiceCategories(),
        KPApi.getServiceSubcategories(),
        branchesCache.length
          ? branchesCache
          : KPApi.getBranches(),
      ]);

    if (!branchesCache.length) {
      branchesCache = branches;
    }
  } catch (error) {
  showKpToast({
    title:
      'Unable to open service form',

    message:
      error.message ||
      'The Services V2 form could not be loaded.',

    duration: 7000,
  });

  return;
}

  const legacyCategorySlugMap = {
    general: 'family-general-medicine',
    women: 'womens-maternity-care',
    treatment: 'procedures-minor-care',
    special: 'wellness-certification',
  };

  const selectedCategory =
    categories.find(
      (category) =>
        Number(category.id) ===
        Number(service?.category_id)
    ) ||
    categories.find(
      (category) =>
        category.slug ===
        legacyCategorySlugMap[
          String(service?.category_key || '')
            .trim()
            .toLowerCase()
        ]
    ) ||
    null;

  const selectedCategoryId =
    Number(selectedCategory?.id || 0);

  const selectedSubcategoryId =
    Number(service?.subcategory_id || 0);

  const selectedBranchIds = new Set(
    (service?.branch_ids || []).map(Number)
  );

  const categoryOptions = categories
    .map(
      (category) => `
        <option
          value="${Number(category.id)}"
          ${
            Number(category.id) ===
            selectedCategoryId
              ? 'selected'
              : ''
          }
        >
          ${escapeHtml(category.name)}
        </option>
      `
    )
    .join('');

  const branchOptions = branches
    .map(
      (branch) => `
        <option
          value="${Number(branch.id)}"
          ${
            selectedBranchIds.has(
              Number(branch.id)
            )
              ? 'selected'
              : ''
          }
        >
          ${escapeHtml(branch.name)}
        </option>
      `
    )
    .join('');

  function getSubcategoryOptions(
    categoryId,
    currentSubcategoryId = 0
  ) {
    const availableSubcategories =
      subcategories.filter(
        (subcategory) =>
          Number(subcategory.category_id) ===
          Number(categoryId)
      );

    const blankLabel = isLegacy
      ? 'Keep as legacy category card'
      : 'Select service subcategory';

    return `
      <option value="">
        ${blankLabel}
      </option>

      ${availableSubcategories
        .map(
          (subcategory) => `
            <option
              value="${Number(subcategory.id)}"
              ${
                Number(subcategory.id) ===
                Number(currentSubcategoryId)
                  ? 'selected'
                  : ''
              }
            >
              ${escapeHtml(subcategory.name)}
            </option>
          `
        )
        .join('')}
    `;
  }

  showModal(
    isEdit
      ? 'Edit service details'
      : 'Add Services V2 service',
    `
      ${
        isLegacy
          ? `
            <div class="form-message">
              This is an existing legacy category card.
              Leave the subcategory empty to keep it as a
              legacy card, or select a subcategory and
              branches to convert it into Services V2.
            </div>
          `
          : ''
      }

      <div class="admin-form-grid two-column">
        <label>
          <span>Service category</span>
          <select
            id="m-service-category"
            required
          >
            <option value="">
              Select category
            </option>
            ${categoryOptions}
          </select>
        </label>

        <label>
          <span>Service subcategory</span>
          <select
            id="m-service-subcategory"
            ${isLegacy ? '' : 'required'}
          >
            ${getSubcategoryOptions(
              selectedCategoryId,
              selectedSubcategoryId
            )}
          </select>
        </label>
      </div>

      <label>
        <span>Available branches</span>
        <select
          id="m-service-branches"
          multiple
          size="3"
          ${isLegacy ? '' : 'required'}
        >
          ${branchOptions}
        </select>

        <div class="upload-help">
          Hold Ctrl while selecting to choose more than
          one branch.
        </div>
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Service title</span>
          <input
            id="m-service-title"
            type="text"
            value="${escapeAttribute(
              service?.title || ''
            )}"
            required
          >
        </label>

        <label>
          <span>URL slug</span>
          <input
            id="m-service-slug"
            type="text"
            value="${escapeAttribute(
              service?.slug || ''
            )}"
            placeholder="anomaly-scan"
          >
        </label>
      </div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Kicker / short label</span>
          <input
            id="m-service-kicker"
            type="text"
            value="${escapeAttribute(
              service?.kicker || ''
            )}"
          >
        </label>

        <label>
          <span>Result time</span>
          <input
            id="m-service-result-time"
            type="text"
            value="${escapeAttribute(
              service?.result_time || ''
            )}"
            placeholder="Same day, 1–3 working days..."
          >
        </label>
      </div>

      <label>
        <span>Short card description</span>
        <textarea
          id="m-service-description"
          rows="3"
        >${escapeHtml(
          service?.description || ''
        )}</textarea>
      </label>

      <label>
        <span>Full service description</span>
        <textarea
          id="m-service-full"
          rows="7"
        >${escapeHtml(
          service?.full_description || ''
        )}</textarea>
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Suitable for — one item per line</span>
          <textarea
            id="m-service-suitable"
            rows="6"
          >${escapeHtml(
            service?.suitable_for || ''
          )}</textarea>
        </label>

        <label>
          <span>What is included — one item per line</span>
          <textarea
            id="m-service-included"
            rows="6"
          >${escapeHtml(
            service?.included_items || ''
          )}</textarea>
        </label>
      </div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Preparation — one item per line</span>
          <textarea
            id="m-service-preparation"
            rows="6"
          >${escapeHtml(
            service?.preparation || ''
          )}</textarea>
        </label>

        <label>
          <span>Aftercare — one item per line</span>
          <textarea
            id="m-service-aftercare"
            rows="6"
          >${escapeHtml(
            service?.aftercare || ''
          )}</textarea>
        </label>
      </div>

      <label>
        <span>Search keywords</span>
        <input
          id="m-service-keywords"
          type="text"
          value="${escapeAttribute(
            service?.keywords || ''
          )}"
          placeholder="pregnancy, scan, antenatal..."
        >
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Display order</span>
          <input
            id="m-service-order"
            type="number"
            value="${Number(
              service?.sort_order || 0
            )}"
          >
        </label>

        <label>
          <span>Featured service</span>
          <select id="m-service-featured">
            <option
              value="1"
              ${
                Number(service?.is_featured)
                  ? 'selected'
                  : ''
              }
            >
              Yes
            </option>

            <option
              value="0"
              ${
                !Number(service?.is_featured)
                  ? 'selected'
                  : ''
              }
            >
              No
            </option>
          </select>
        </label>
      </div>

      <div class="admin-upload-field">
  <label for="m-service-hero">
    Hero image
  </label>

  <input
    id="m-service-hero"
    type="file"
    accept="image/jpeg,image/png,image/webp"
  >

  <input
    id="m-service-hero-url"
    type="hidden"
    value="${escapeAttribute(
      service?.hero_image_url || ''
    )}"
  >

  <div class="upload-help">
    This image is used on the service card and
    service detail page.
  </div>

  <div
    id="m-service-hero-preview-wrap"
    class="${
      service?.hero_image_url
        ? ''
        : 'hidden'
    }"
  >
    <img
      id="m-service-hero-preview"
      class="admin-image-preview landscape"
      src="${
        service?.hero_image_url
          ? escapeAttribute(
              resolveImageUrl(
                service.hero_image_url
              )
            )
          : ''
      }"
      alt="Service hero preview"
    >

    <button
      type="button"
      class="btn-small danger"
      id="removeServiceHeroBtn"
    >
      Delete hero image
    </button>
  </div>
</div>

      <label>
        <span>Active</span>
        <select id="m-service-active">
          <option
            value="1"
            ${
              !service ||
              Number(service.is_active)
                ? 'selected'
                : ''
            }
          >
            Yes
          </option>

          <option
            value="0"
            ${
              service &&
              !Number(service.is_active)
                ? 'selected'
                : ''
            }
          >
            No
          </option>
        </select>
      </label>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          class="btn-primary"
          type="submit"
        >
          ${
            isEdit
              ? 'Save service'
              : 'Create service'
          }
        </button>
      </div>
    `,
    async (event) => {
      event.preventDefault();

      const message = document.getElementById(
        'modalFormMessage'
      );

      const categoryId = Number(
        document.getElementById(
          'm-service-category'
        ).value
      );

      const category = categories.find(
        (item) =>
          Number(item.id) === categoryId
      );

      const subcategoryValue =
        document.getElementById(
          'm-service-subcategory'
        ).value;

      const subcategoryId =
        subcategoryValue === ''
          ? null
          : Number(subcategoryValue);

      const branchSelect =
        document.getElementById(
          'm-service-branches'
        );

      const branchIds = Array.from(
        branchSelect.selectedOptions
      ).map((option) => Number(option.value));

      const isServicesV2 =
        Number.isInteger(subcategoryId) &&
        subcategoryId > 0;

      const heroInput =
        document.getElementById(
          'm-service-hero'
        );

      let heroUrl =
        document
          .getElementById(
            'm-service-hero-url'
          )
          .value.trim() || null;

      try {
        if (!category) {
          throw new Error(
            'Please select a service category.'
          );
        }

        if (!isLegacy && !isServicesV2) {
          throw new Error(
            'Please select a service subcategory.'
          );
        }

        if (
          isServicesV2 &&
          !branchIds.length
        ) {
          throw new Error(
            'Please select at least one branch.'
          );
        }

        if (heroInput.files[0]) {
          const upload =
            await authedApi.uploadImage(
              heroInput.files[0],
              'services'
            );

          heroUrl = upload.url;
        }

        const payload = {
          category_key:
            getServiceCategoryKey(
              category.slug
            ),

          subcategory_id: subcategoryId,

          title:
            document
              .getElementById(
                'm-service-title'
              )
              .value.trim(),

          slug:
            document
              .getElementById(
                'm-service-slug'
              )
              .value.trim(),

          kicker:
            document
              .getElementById(
                'm-service-kicker'
              )
              .value.trim() || null,

          description:
            document
              .getElementById(
                'm-service-description'
              )
              .value.trim() || null,

          full_description:
            document
              .getElementById(
                'm-service-full'
              )
              .value.trim() || null,

          suitable_for:
            document
              .getElementById(
                'm-service-suitable'
              )
              .value.trim() || null,

          included_items:
            document
              .getElementById(
                'm-service-included'
              )
              .value.trim() || null,

          preparation:
            document
              .getElementById(
                'm-service-preparation'
              )
              .value.trim() || null,

          aftercare:
            document
              .getElementById(
                'm-service-aftercare'
              )
              .value.trim() || null,

          hero_image_url: heroUrl,

          keywords:
            document
              .getElementById(
                'm-service-keywords'
              )
              .value.trim() || null,

          result_time:
            document
              .getElementById(
                'm-service-result-time'
              )
              .value.trim() || null,

          is_featured: Number(
            document.getElementById(
              'm-service-featured'
            ).value
          ),

          sort_order: Number(
            document.getElementById(
              'm-service-order'
            ).value || 0
          ),

          is_active: Number(
            document.getElementById(
              'm-service-active'
            ).value
          ),
        };

        /*
          Branch IDs are required for Services V2.
          Legacy cards remain untouched when no
          subcategory is selected.
        */
        if (isServicesV2) {
          payload.branch_ids = branchIds;
        }

        let savedId = service?.id;

        if (isEdit) {
          await authedApi.updateService(
            service.id,
            payload
          );
        } else {
          const response =
            await authedApi.createService(
              payload
            );

          savedId = response.id;
        }

        closeModal();

await loadServices();

if (isEdit) {
  showKpToast({
    title:
      'Service updated successfully',

    message:
      `${payload.title} has been updated.`,

    duration: 5000,
  });
}

if (!isEdit && savedId) {
  showKpToast({
    title:
      'Service created successfully',

    message:
      'Service has been saved.',

    actionText:
      'Add price list',

    onAction: () => {
      openPriceManager(
        savedId
      );
    },

    duration: 8000,
  });
}
      } catch (error) {
        if (!handleAuthError(error)) {
          setMessage(
            message,
            error.message,
            'error'
          );
        }
      }
    }
  );

  const categorySelect =
    document.getElementById(
      'm-service-category'
    );

  const subcategorySelect =
    document.getElementById(
      'm-service-subcategory'
    );

  categorySelect?.addEventListener(
    'change',
    () => {
      subcategorySelect.innerHTML =
        getSubcategoryOptions(
          Number(categorySelect.value),
          0
        );

      subcategorySelect.disabled =
        !categorySelect.value;
    }
  );

  if (subcategorySelect) {
    subcategorySelect.disabled =
      !categorySelect?.value;
  }

  bindImagePreview(
    'm-service-hero',
    'm-service-hero-preview'
  );

  const heroInput =
  document.getElementById(
    'm-service-hero'
  );

const heroUrlInput =
  document.getElementById(
    'm-service-hero-url'
  );

const heroPreview =
  document.getElementById(
    'm-service-hero-preview'
  );

const heroPreviewWrap =
  document.getElementById(
    'm-service-hero-preview-wrap'
  );

const removeHeroButton =
  document.getElementById(
    'removeServiceHeroBtn'
  );

heroInput?.addEventListener(
  'change',
  () => {
    if (
      heroInput.files?.length
    ) {
      heroPreviewWrap
        ?.classList.remove(
          'hidden'
        );
    }
  }
);

removeHeroButton?.addEventListener(
  'click',
  async () => {
    const hasHero =
      Boolean(
        heroUrlInput?.value ||
        heroInput?.files?.length
      );

    if (!hasHero) {
      return;
    }

    const confirmed =
      await confirmDelete({
        title:
          'Delete hero image?',

        message:
          'The hero image will be removed from this service after you save the service.',

        confirmText:
          'Remove image',
      });

    if (!confirmed) {
      return;
    }

    if (heroInput) {
      heroInput.value = '';
    }

    if (heroUrlInput) {
      heroUrlInput.value = '';
    }

    if (heroPreview) {
      heroPreview.src = '';
      heroPreview.classList.add(
        'hidden'
      );
    }

    heroPreviewWrap
      ?.classList.add(
        'hidden'
      );

    showKpToast({
      title:
        'Hero image removed',

      message:
        'Save the service to apply this change.',

      duration: 5000,
    });
  }
);

  bindSlugGenerator(
    'm-service-title',
    'm-service-slug',
    !isEdit
  );
}

async function openPriceManager(
  serviceId
) {
  try {
    const service =
      await authedApi
        .getAdminService(
          serviceId
        );

    renderPriceManager(
      service
    );
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      showKpToast({
        title:
          'Unable to load price list',

        message:
          error.message ||
          'Please try again.',

        duration: 7000,
      });
    }
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
      const isEditPrice =
  Boolean(priceId);

if (isEditPrice) {
  await authedApi
    .updateServicePrice(
      priceId,
      payload
    );
} else {
  await authedApi
    .createServicePrice(
      service.id,
      payload
    );
}

await openPriceManager(
  service.id
);

showKpToast({
  title: isEditPrice
    ? 'Price updated'
    : 'Price added',

  message:
    `${payload.package_name} has been saved successfully.`,

  duration: 5000,
});
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

  document
  .querySelectorAll(
    '[data-delete-price]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const price =
          service.prices.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset
                  .deletePrice
              )
          );

        const priceName =
          price?.package_name ||
          'this price item';

        const confirmed =
          await confirmDelete({
            title:
              `Delete ${priceName}?`,

            message:
              'This price item will be permanently removed from the service.',
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .deleteServicePrice(
              button.dataset
                .deletePrice
            );

          await openPriceManager(
            service.id
          );

          showKpToast({
            title:
              'Price deleted',

            message:
              `${priceName} has been removed.`,

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to delete price',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
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

async function openGalleryManager(
  serviceId
) {
  try {
    const service =
      await authedApi
        .getAdminService(
          serviceId
        );

    renderGalleryManager(
      service
    );
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      showKpToast({
        title:
          'Unable to load gallery',

        message:
          error.message ||
          'Please try again.',

        duration: 7000,
      });
    }
  }
}

function renderGalleryManager(service) {
  const gallery = Array.isArray(
    service.gallery
  )
    ? service.gallery
    : [];

  showModal(
    `Gallery · ${service.title}`,
    `
      <div class="gallery-manager-grid">
        ${
          gallery.length
            ? gallery
                .map(
                  (image) => `
                    <article class="gallery-manager-card">
                      <img
                        src="${escapeAttribute(
                          resolveImageUrl(
                            image.image_url
                          )
                        )}"
                        alt="${escapeAttribute(
                          image.alt_text ||
                            image.caption ||
                            'Service gallery image'
                        )}"
                      >

                      <div>
                        <strong>
                          ${escapeHtml(
                            image.caption ||
                              'No caption'
                          )}
                        </strong>

                        <small>
                          ${
                            Number(
                              image.is_active
                            )
                              ? 'Active'
                              : 'Inactive'
                          }
                          · Order
                          ${Number(
                            image.sort_order || 0
                          )}
                        </small>

                        <div class="gallery-manager-actions">
                          <button
                            class="btn-small"
                            type="button"
                            data-edit-gallery="${image.id}"
                          >
                            Edit
                          </button>

                          <button
                            class="btn-small danger"
                            type="button"
                            data-delete-gallery="${image.id}"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  `
                )
                .join('')
            : `
                <div class="manager-empty">
                  No gallery images added yet.
                </div>
              `
        }
      </div>

      <hr class="modal-divider">

      <h3 id="galleryFormHeading">
        Add gallery image
      </h3>

      <input
        id="m-gallery-id"
        type="hidden"
      >

      <input
        id="m-gallery-existing-url"
        type="hidden"
      >

      <div class="admin-upload-field">
        <label for="m-gallery-file">
          Image
        </label>

        <input
        id="m-gallery-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
      >

        <div class="upload-help">
  You can select multiple images when adding
  gallery items. When editing an existing image,
  only one replacement image will be used.
</div>

        <img
          id="m-gallery-preview"
          class="admin-image-preview landscape hidden"
          src=""
          alt="Gallery preview"
        >
      </div>

      <label>
        <span>Caption</span>

        <input
          id="m-gallery-caption"
          type="text"
          placeholder="Optional image caption"
        >
      </label>

      <label>
        <span>Alternative text</span>

        <input
          id="m-gallery-alt"
          type="text"
          placeholder="Describe the image for accessibility"
        >
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Display order</span>

          <input
            id="m-gallery-order"
            type="number"
            value="0"
          >
        </label>

        <label>
          <span>Active</span>

          <select id="m-gallery-active">
            <option value="1">
              Yes
            </option>

            <option value="0">
              No
            </option>
          </select>
        </label>
      </div>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          class="btn-ghost"
          id="galleryFormCancel"
          type="button"
        >
          Clear form
        </button>

        <button
          class="btn-primary"
          id="gallerySaveButton"
          type="submit"
        >
          Upload image
        </button>
      </div>
    `,
    async (event) => {
      event.preventDefault();

      const message =
        document.getElementById(
          'modalFormMessage'
        );

      const galleryId =
        document.getElementById(
          'm-gallery-id'
        ).value;

      const existingImageUrl =
        document.getElementById(
          'm-gallery-existing-url'
        ).value;

      const fileInput =
  document.getElementById(
    'm-gallery-file'
  );

const files =
  Array.from(
    fileInput?.files || []
  );

if (
  !galleryId &&
  !files.length
) {
  setMessage(
    message,
    'Please select at least one image.',
    'error'
  );

  return;
}

      try {
  setMessage(
    message,
    ''
  );

  const caption =
    document
      .getElementById(
        'm-gallery-caption'
      )
      .value.trim() ||
    null;

  const altText =
    document
      .getElementById(
        'm-gallery-alt'
      )
      .value.trim() ||
    null;

  const startOrder =
    Number(
      document.getElementById(
        'm-gallery-order'
      ).value || 0
    );

  const isActive =
    Number(
      document.getElementById(
        'm-gallery-active'
      ).value
    );

  const isEditGallery =
    Boolean(galleryId);

  /*
    EDIT MODE
    Existing gallery item remains
    a single record.
  */
  if (isEditGallery) {
    let imageUrl =
      existingImageUrl || '';

    if (files[0]) {
      const upload =
        await authedApi
          .uploadImage(
            files[0],
            'services'
          );

      imageUrl =
        upload.url;
    }

    if (!imageUrl) {
      setMessage(
        message,
        'A gallery image is required.',
        'error'
      );

      return;
    }

    await authedApi
      .updateGalleryItem(
        galleryId,
        {
          image_url:
            imageUrl,

          caption,

          alt_text:
            altText,

          sort_order:
            startOrder,

          is_active:
            isActive,
        }
      );

    await openGalleryManager(
      service.id
    );

    showKpToast({
      title:
        'Gallery image updated',

      message:
        'The gallery image has been updated successfully.',

      duration: 5000,
    });

    return;
  }

  /*
    ADD MODE
    Each selected image becomes
    its own gallery record.
  */
  let uploadedCount = 0;

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    const file =
      files[index];

    const upload =
      await authedApi
        .uploadImage(
          file,
          'services'
        );

    await authedApi
      .createGalleryItem(
        service.id,
        {
          image_url:
            upload.url,

          caption,

          alt_text:
            altText,

          sort_order:
            startOrder +
            index,

          is_active:
            isActive,
        }
      );

    uploadedCount += 1;
  }

  await openGalleryManager(
    service.id
  );

  showKpToast({
    title:
      uploadedCount === 1
        ? 'Gallery image added'
        : 'Gallery images added',

    message:
      `${uploadedCount} image${
        uploadedCount === 1
          ? ''
          : 's'
      } added successfully.`,

    duration: 5000,
  });
} catch (error) {
  if (
    !handleAuthError(error)
  ) {
    setMessage(
      message,
      error.message ||
        'Unable to save gallery image.',
      'error'
    );
  }
}
    }
  );

  bindImagePreview(
    'm-gallery-file',
    'm-gallery-preview'
  );

  document
    .getElementById(
      'galleryFormCancel'
    )
    ?.addEventListener(
      'click',
      clearGalleryForm
    );

  document
    .querySelectorAll(
      '[data-edit-gallery]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const image = gallery.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.editGallery
              )
          );

          if (!image) {
            return;
          }

          document.getElementById(
            'galleryFormHeading'
          ).textContent =
            'Edit gallery image';

          document.getElementById(
            'm-gallery-id'
          ).value = image.id;

          document.getElementById(
            'm-gallery-existing-url'
          ).value =
            image.image_url || '';

          document.getElementById(
            'm-gallery-caption'
          ).value =
            image.caption || '';

          document.getElementById(
            'm-gallery-alt'
          ).value =
            image.alt_text || '';

          document.getElementById(
            'm-gallery-order'
          ).value =
            image.sort_order || 0;

          document.getElementById(
            'm-gallery-active'
          ).value =
            Number(image.is_active)
              ? '1'
              : '0';

          const fileInput =
            document.getElementById(
              'm-gallery-file'
            );

          fileInput.value = '';
          fileInput.multiple =
  false;

          const preview =
            document.getElementById(
              'm-gallery-preview'
            );

          preview.src =
            resolveImageUrl(
              image.image_url
            );

          preview.alt =
            image.alt_text ||
            image.caption ||
            'Gallery preview';

          preview.classList.remove(
            'hidden'
          );

          document.getElementById(
            'gallerySaveButton'
          ).textContent =
            'Save changes';

          document
            .getElementById(
              'galleryFormHeading'
            )
            .scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });

          document
            .getElementById(
              'm-gallery-caption'
            )
            .focus();
        }
      );
    });

  document
  .querySelectorAll(
    '[data-delete-gallery]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const image =
          gallery.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset
                  .deleteGallery
              )
          );

        const imageLabel =
          image?.caption ||
          'this gallery image';

        const confirmed =
          await confirmDelete({
            title:
              'Delete gallery image?',

            message:
              `${imageLabel} will be permanently removed from this service.`,
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .deleteGalleryItem(
              button.dataset
                .deleteGallery
            );

          await openGalleryManager(
            service.id
          );

          showKpToast({
            title:
              'Gallery image deleted',

            message:
              'The image has been permanently removed.',

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to delete image',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });
}

function clearGalleryForm() {
  const heading =
    document.getElementById(
      'galleryFormHeading'
    );

  const saveButton =
    document.getElementById(
      'gallerySaveButton'
    );

  if (heading) {
    heading.textContent =
      'Add gallery image';
  }

  if (saveButton) {
    saveButton.textContent =
      'Upload image';
  }

  [
    'm-gallery-id',
    'm-gallery-existing-url',
    'm-gallery-caption',
    'm-gallery-alt',
  ].forEach((id) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.value = '';
    }
  });

  const fileInput =
    document.getElementById(
      'm-gallery-file'
    );

  if (fileInput) {
  fileInput.value = '';
  fileInput.multiple =
    true;
}

  const order =
    document.getElementById(
      'm-gallery-order'
    );

  if (order) {
    order.value = '0';
  }

  const active =
    document.getElementById(
      'm-gallery-active'
    );

  if (active) {
    active.value = '1';
  }

  const preview =
    document.getElementById(
      'm-gallery-preview'
    );

  if (preview) {
    preview.removeAttribute('src');
    preview.alt = 'Gallery preview';
    preview.classList.add('hidden');
  }

  setMessage(
    document.getElementById(
      'modalFormMessage'
    ),
    ''
  );
}

// -----------------------------------------------------------------------------
// SERVICE TAXONOMY — MANAGER / SUPERADMIN
// -----------------------------------------------------------------------------

async function loadServiceTaxonomy() {
  const categoryBody =
    document.getElementById(
      'serviceCategoriesTableBody'
    );

  const subcategoryBody =
    document.getElementById(
      'serviceSubcategoriesTableBody'
    );

  if (
    !authedApi ||
    !hasManagementAccess() ||
    (
      !categoryBody &&
      !subcategoryBody
    )
  ) {
    return;
  }

  if (categoryBody) {
    categoryBody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="loading-row"
        >
          Loading categories…
        </td>
      </tr>
    `;
  }

  if (subcategoryBody) {
    subcategoryBody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="loading-row"
        >
          Loading subcategories…
        </td>
      </tr>
    `;
  }

  try {
    [
      serviceCategoriesCache,
      serviceSubcategoriesCache,
    ] = await Promise.all([
      authedApi
        .getAdminServiceCategories(),

      authedApi
        .getAdminServiceSubcategories(),
    ]);

    serviceCategoriesCache =
      Array.isArray(
        serviceCategoriesCache
      )
        ? serviceCategoriesCache
        : [];

    serviceSubcategoriesCache =
      Array.isArray(
        serviceSubcategoriesCache
      )
        ? serviceSubcategoriesCache
        : [];

    renderServiceCategoriesTable();

    populateTaxonomyCategoryFilter();

    renderFilteredServiceSubcategories();
  } catch (error) {
    if (
      handleAuthError(error)
    ) {
      return;
    }

    const message =
      escapeHtml(
        error.message ||
        'Unable to load service setup.'
      );

    if (categoryBody) {
      categoryBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty-row"
          >
            ${message}
          </td>
        </tr>
      `;
    }

    if (subcategoryBody) {
      subcategoryBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty-row"
          >
            ${message}
          </td>
        </tr>
      `;
    }
  }
}

function renderServiceCategoriesTable() {
  const tbody =
    document.getElementById(
      'serviceCategoriesTableBody'
    );

  if (!tbody) {
    return;
  }

  if (!serviceCategoriesCache.length) {
  tbody.innerHTML = `
    <tr>
      <td
        colspan="7"
        class="empty-row"
      >
        No service categories found.
      </td>
    </tr>
  `;

  const pager =
    document.getElementById(
      'serviceCategoriesPager'
    );

  if (pager) {
    pager.innerHTML = '';
  }

  return;
}

  const result =
  paginateClientItems(
    serviceCategoriesCache,
    serviceCategoryState.page,
    serviceCategoryState.limit
  );

serviceCategoryState.page =
  result.pagination.page;

  tbody.innerHTML =
  result.items
    .map(
        (category) => {
          const isActive =
            Number(
              category.is_active
            ) === 1;

          return `
            <tr data-category-id="${Number(
              category.id
            )}">
              <td>
                <strong>
                  ${escapeHtml(
                    category.name
                  )}
                </strong>
              </td>

              <td>
                <span class="cell-subtext">
                  ${escapeHtml(
                    category.slug
                  )}
                </span>
              </td>

              <td>
                ${Number(
                  category
                    .subcategory_count ||
                  0
                )}
              </td>

              <td>
                ${Number(
                  category
                    .service_count ||
                  0
                )}
              </td>

              <td>
                ${Number(
                  category.sort_order ||
                  0
                )}
              </td>

              <td>
                <span class="status-pill ${
                  isActive
                    ? 'status-completed'
                    : 'status-cancelled'
                }">
                  ${
                    isActive
                      ? 'Active'
                      : 'Inactive'
                  }
                </span>
              </td>

              <td>
                <div class="table-action-stack">
                  <button
                    type="button"
                    class="btn-small"
                    data-action="edit-service-category"
                    data-id="${Number(
                      category.id
                    )}"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    class="btn-small ${
                      isActive
                        ? 'danger'
                        : ''
                    }"
                    data-action="toggle-service-category"
                    data-id="${Number(
                      category.id
                    )}"
                    data-active="${
                      isActive
                        ? '1'
                        : '0'
                    }"
                  >
                    ${
                      isActive
                        ? 'Deactivate'
                        : 'Activate'
                    }
                  </button>
                </div>
              </td>
            </tr>
          `;
        }
      )
      .join('');

  tbody
    .querySelectorAll(
      '[data-action="edit-service-category"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const category =
            serviceCategoriesCache.find(
              (item) =>
                String(item.id) ===
                String(
                  button.dataset.id
                )
            );

          if (category) {
            openServiceCategoryModal(
              category
            );
          }
        }
      );
    });

  tbody
  .querySelectorAll(
    '[data-action="toggle-service-category"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const currentlyActive =
          Number(
            button.dataset.active
          ) === 1;

        const nextActive =
          currentlyActive
            ? 0
            : 1;

        const category =
          serviceCategoriesCache.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.id
              )
          );

        const categoryName =
          category?.name ||
          'this category';

        const confirmed =
          await confirmStatusChange({
            title: nextActive
              ? `Activate ${categoryName}?`
              : `Deactivate ${categoryName}?`,

            message: nextActive
              ? 'This category will become available for active service setup.'
              : 'Services under this category may no longer appear normally on the public website until the category is activated again.',

            confirmText: nextActive
              ? 'Activate'
              : 'Deactivate',
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .updateServiceCategoryStatus(
              button.dataset.id,
              nextActive
            );

          await loadServiceTaxonomy();

          showKpToast({
            title: nextActive
              ? 'Category activated'
              : 'Category deactivated',

            message:
              `${categoryName} is now ${
                nextActive
                  ? 'active'
                  : 'inactive'
              }.`,

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to update category',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });

  renderPager(
  document.getElementById(
    'serviceCategoriesPager'
  ),
  result.pagination,
  (page) => {
    serviceCategoryState.page =
      page;

    renderServiceCategoriesTable();
  }
);
}

function populateTaxonomyCategoryFilter() {
  const select =
    document.getElementById(
      'taxonomyCategoryFilter'
    );

  if (!select) {
    return;
  }

  const currentValue =
    serviceTaxonomyState
      .categoryFilter;

  select.innerHTML = [
    `
      <option value="">
        All categories
      </option>
    `,

    ...serviceCategoriesCache.map(
      (category) => `
        <option
          value="${Number(
            category.id
          )}"
        >
          ${escapeHtml(
            category.name
          )}
        </option>
      `
    ),
  ].join('');

  if (
    serviceCategoriesCache.some(
      (category) =>
        String(category.id) ===
        String(currentValue)
    )
  ) {
    select.value =
      currentValue;
  } else {
    serviceTaxonomyState
      .categoryFilter = '';

    select.value = '';
  }
}

function renderFilteredServiceSubcategories() {
  const categoryFilter =
    String(
      serviceTaxonomyState
        .categoryFilter || ''
    );

  const search =
    String(
      serviceTaxonomyState.search ||
      ''
    )
      .trim()
      .toLowerCase();

  const filtered =
    serviceSubcategoriesCache.filter(
      (subcategory) => {
        const matchesCategory =
          !categoryFilter ||
          String(
            subcategory.category_id
          ) === categoryFilter;

        const searchableText = [
          subcategory.name,
          subcategory.slug,
          subcategory.category_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !search ||
          searchableText.includes(
            search
          );

        return (
          matchesCategory &&
          matchesSearch
        );
      }
    );

  const result =
    paginateClientItems(
      filtered,
      serviceSubcategoryState.page,
      serviceSubcategoryState.limit
    );

  serviceSubcategoryState.page =
    result.pagination.page;

  renderServiceSubcategoriesTable(
    result.items
  );

  const pager =
    document.getElementById(
      'serviceSubcategoriesPager'
    );

  if (!filtered.length) {
    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  renderPager(
    pager,
    result.pagination,
    (page) => {
      serviceSubcategoryState.page =
        page;

      renderFilteredServiceSubcategories();
    }
  );
}

function renderServiceSubcategoriesTable(
  subcategories
) {
  const tbody =
    document.getElementById(
      'serviceSubcategoriesTableBody'
    );

  if (!tbody) {
    return;
  }

  if (!subcategories.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="empty-row"
        >
          No matching subcategories found.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    subcategories
      .map(
        (subcategory) => {
          const isActive =
            Number(
              subcategory.is_active
            ) === 1;

          const parentActive =
            Number(
              subcategory
                .category_is_active
            ) === 1;

          return `
            <tr data-subcategory-id="${Number(
              subcategory.id
            )}">
              <td>
                <strong>
                  ${escapeHtml(
                    subcategory.name
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  subcategory
                    .category_name ||
                  '—'
                )}

                ${
                  !parentActive
                    ? `
                      <div class="cell-subtext">
                        Parent inactive
                      </div>
                    `
                    : ''
                }
              </td>

              <td>
                <span class="cell-subtext">
                  ${escapeHtml(
                    subcategory.slug
                  )}
                </span>
              </td>

              <td>
                ${Number(
                  subcategory
                    .service_count ||
                  0
                )}
              </td>

              <td>
                ${Number(
                  subcategory
                    .sort_order ||
                  0
                )}
              </td>

              <td>
                <span class="status-pill ${
                  isActive
                    ? 'status-completed'
                    : 'status-cancelled'
                }">
                  ${
                    isActive
                      ? 'Active'
                      : 'Inactive'
                  }
                </span>
              </td>

              <td>
                <div class="table-action-stack">
                  <button
                    type="button"
                    class="btn-small"
                    data-action="edit-service-subcategory"
                    data-id="${Number(
                      subcategory.id
                    )}"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    class="btn-small ${
                      isActive
                        ? 'danger'
                        : ''
                    }"
                    data-action="toggle-service-subcategory"
                    data-id="${Number(
                      subcategory.id
                    )}"
                    data-active="${
                      isActive
                        ? '1'
                        : '0'
                    }"
                  >
                    ${
                      isActive
                        ? 'Deactivate'
                        : 'Activate'
                    }
                  </button>
                </div>
              </td>
            </tr>
          `;
        }
      )
      .join('');

  tbody
    .querySelectorAll(
      '[data-action="edit-service-subcategory"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const subcategory =
            serviceSubcategoriesCache.find(
              (item) =>
                String(item.id) ===
                String(
                  button.dataset.id
                )
            );

          if (subcategory) {
            openServiceSubcategoryModal(
              subcategory
            );
          }
        }
      );
    });

  tbody
  .querySelectorAll(
    '[data-action="toggle-service-subcategory"]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const currentlyActive =
          Number(
            button.dataset.active
          ) === 1;

        const nextActive =
          currentlyActive
            ? 0
            : 1;

        const subcategory =
          serviceSubcategoriesCache.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.id
              )
          );

        const subcategoryName =
          subcategory?.name ||
          'this subcategory';

        const confirmed =
          await confirmStatusChange({
            title: nextActive
              ? `Activate ${subcategoryName}?`
              : `Deactivate ${subcategoryName}?`,

            message: nextActive
              ? 'This subcategory will become available for service assignment.'
              : 'Services assigned to this subcategory may no longer appear normally on the public website until it is activated again.',

            confirmText: nextActive
              ? 'Activate'
              : 'Deactivate',
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .updateServiceSubcategoryStatus(
              button.dataset.id,
              nextActive
            );

          await loadServiceTaxonomy();

          showKpToast({
            title: nextActive
              ? 'Subcategory activated'
              : 'Subcategory deactivated',

            message:
              `${subcategoryName} is now ${
                nextActive
                  ? 'active'
                  : 'inactive'
              }.`,

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to update subcategory',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });
}

function openServiceCategoryModal(
  category = null
) {
  const isEdit =
    Boolean(category);

  showModal(
    isEdit
      ? 'Edit service category'
      : 'Add service category',

    `
      <div class="admin-form-grid two-column">
        <label>
          <span>Category name</span>

          <input
            id="m-taxonomy-category-name"
            type="text"
            value="${escapeAttribute(
              category?.name || ''
            )}"
            required
          >
        </label>

        <label>
          <span>URL slug</span>

          <input
            id="m-taxonomy-category-slug"
            type="text"
            value="${escapeAttribute(
              category?.slug || ''
            )}"
            placeholder="family-general-medicine"
          >
        </label>
      </div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Display order</span>

          <input
            id="m-taxonomy-category-order"
            type="number"
            value="${Number(
              category?.sort_order ||
              0
            )}"
          >
        </label>

        <label>
          <span>Status</span>

          <select
            id="m-taxonomy-category-active"
          >
            <option
              value="1"
              ${
                !category ||
                Number(
                  category.is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              Active
            </option>

            <option
              value="0"
              ${
                category &&
                !Number(
                  category.is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              Inactive
            </option>
          </select>
        </label>
      </div>

      <div class="upload-help">
        The slug is used in the Services page URL.
        Leave it unchanged unless necessary.
      </div>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          type="submit"
          class="btn-primary"
          id="saveServiceCategoryBtn"
        >
          ${
            isEdit
              ? 'Save category'
              : 'Create category'
          }
        </button>
      </div>
    `,

    async (event) => {
      event.preventDefault();

      const message =
        document.getElementById(
          'modalFormMessage'
        );

      const saveButton =
        document.getElementById(
          'saveServiceCategoryBtn'
        );

      const payload = {
        name:
          document
            .getElementById(
              'm-taxonomy-category-name'
            )
            .value.trim(),

        slug:
          document
            .getElementById(
              'm-taxonomy-category-slug'
            )
            .value.trim(),

        short_description:
          category
            ?.short_description ||
          null,

        image_url:
          category?.image_url ||
          null,

        sort_order: Number(
          document
            .getElementById(
              'm-taxonomy-category-order'
            )
            .value || 0
        ),

        is_active: Number(
          document
            .getElementById(
              'm-taxonomy-category-active'
            )
            .value
        ),
      };

      try {
        setButtonLoading(
          saveButton,
          true,
          'Saving…'
        );

        if (isEdit) {
  await authedApi
    .updateServiceCategory(
      category.id,
      payload
    );
} else {
  await authedApi
    .createServiceCategory(
      payload
    );
}

closeModal();

await loadServiceTaxonomy();

showKpToast({
  title: isEdit
    ? 'Category updated'
    : 'Category created',

  message:
    `${payload.name} has been saved successfully.`,

  duration: 5000,
});
      } catch (error) {
        if (
          !handleAuthError(
            error
          )
        ) {
          setMessage(
            message,
            error.message ||
            'Unable to save category.',
            'error'
          );
        }
      } finally {
        if (
          document.body.contains(
            saveButton
          )
        ) {
          setButtonLoading(
            saveButton,
            false,
            isEdit
              ? 'Save category'
              : 'Create category'
          );
        }
      }
    }
  );

  bindSlugGenerator(
    'm-taxonomy-category-name',
    'm-taxonomy-category-slug',
    !isEdit
  );
}

function openServiceSubcategoryModal(
  subcategory = null
) {
  const isEdit =
    Boolean(subcategory);

  const categoryOptions =
    serviceCategoriesCache
      .map(
        (category) => `
          <option
            value="${Number(
              category.id
            )}"
            ${
              Number(
                category.id
              ) ===
              Number(
                subcategory
                  ?.category_id
              )
                ? 'selected'
                : ''
            }
          >
            ${escapeHtml(
              category.name
            )}
            ${
              Number(
                category.is_active
              )
                ? ''
                : ' — Inactive'
            }
          </option>
        `
      )
      .join('');

  showModal(
    isEdit
      ? 'Edit service subcategory'
      : 'Add service subcategory',

    `
      <label>
        <span>Parent category</span>

        <select
          id="m-taxonomy-subcategory-category"
          required
        >
          <option value="">
            Select category
          </option>

          ${categoryOptions}
        </select>
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Subcategory name</span>

          <input
            id="m-taxonomy-subcategory-name"
            type="text"
            value="${escapeAttribute(
              subcategory?.name || ''
            )}"
            required
          >
        </label>

        <label>
          <span>URL slug</span>

          <input
            id="m-taxonomy-subcategory-slug"
            type="text"
            value="${escapeAttribute(
              subcategory?.slug || ''
            )}"
            placeholder="general-consultation"
          >
        </label>
      </div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Display order</span>

          <input
            id="m-taxonomy-subcategory-order"
            type="number"
            value="${Number(
              subcategory
                ?.sort_order ||
              0
            )}"
          >
        </label>

        <label>
          <span>Status</span>

          <select
            id="m-taxonomy-subcategory-active"
          >
            <option
              value="1"
              ${
                !subcategory ||
                Number(
                  subcategory
                    .is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              Active
            </option>

            <option
              value="0"
              ${
                subcategory &&
                !Number(
                  subcategory
                    .is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              Inactive
            </option>
          </select>
        </label>
      </div>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          type="submit"
          class="btn-primary"
          id="saveServiceSubcategoryBtn"
        >
          ${
            isEdit
              ? 'Save subcategory'
              : 'Create subcategory'
          }
        </button>
      </div>
    `,

    async (event) => {
      event.preventDefault();

      const message =
        document.getElementById(
          'modalFormMessage'
        );

      const saveButton =
        document.getElementById(
          'saveServiceSubcategoryBtn'
        );

      const payload = {
        category_id: Number(
          document
            .getElementById(
              'm-taxonomy-subcategory-category'
            )
            .value
        ),

        name:
          document
            .getElementById(
              'm-taxonomy-subcategory-name'
            )
            .value.trim(),

        slug:
          document
            .getElementById(
              'm-taxonomy-subcategory-slug'
            )
            .value.trim(),

        short_description:
          subcategory
            ?.short_description ||
          null,

        image_url:
          subcategory?.image_url ||
          null,

        sort_order: Number(
          document
            .getElementById(
              'm-taxonomy-subcategory-order'
            )
            .value || 0
        ),

        is_active: Number(
          document
            .getElementById(
              'm-taxonomy-subcategory-active'
            )
            .value
        ),
      };

      try {
        setButtonLoading(
          saveButton,
          true,
          'Saving…'
        );

        if (isEdit) {
  await authedApi
    .updateServiceSubcategory(
      subcategory.id,
      payload
    );
} else {
  await authedApi
    .createServiceSubcategory(
      payload
    );
}

closeModal();

await loadServiceTaxonomy();

showKpToast({
  title: isEdit
    ? 'Subcategory updated'
    : 'Subcategory created',

  message:
    `${payload.name} has been saved successfully.`,

  duration: 5000,
});
      } catch (error) {
        if (
          !handleAuthError(
            error
          )
        ) {
          setMessage(
            message,
            error.message ||
            'Unable to save subcategory.',
            'error'
          );
        }
      } finally {
        if (
          document.body.contains(
            saveButton
          )
        ) {
          setButtonLoading(
            saveButton,
            false,
            isEdit
              ? 'Save subcategory'
              : 'Create subcategory'
          );
        }
      }
    }
  );

  bindSlugGenerator(
    'm-taxonomy-subcategory-name',
    'm-taxonomy-subcategory-slug',
    !isEdit
  );
}

// -----------------------------------------------------------------------------
// PROMOTIONS: preserved from the existing dashboard
// -----------------------------------------------------------------------------

async function loadPromotions() {
  const tbody =
    document.getElementById(
      'promotionsTableBody'
    );

  if (
    !tbody ||
    !authedApi?.getAdminPromotions
  ) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="6"
        class="loading-row"
      >
        Loading…
      </td>
    </tr>
  `;

  try {
    promotionsCache =
      await authedApi.getAdminPromotions();

    renderPromotions();
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="empty-row"
          >
            ${escapeHtml(
              error.message ||
              'Unable to load promotions.'
            )}
          </td>
        </tr>
      `;
    }
  }
}

function renderPromotions() {
  const tbody =
    document.getElementById(
      'promotionsTableBody'
    );

  const pager =
    document.getElementById(
      'promotionsPager'
    );

  if (!tbody) {
    return;
  }

  const search =
    String(
      promotionState.search ||
      ''
    )
      .trim()
      .toLowerCase();

  const filteredPromotions =
    promotionsCache.filter(
      (promotion) => {
        if (!search) {
          return true;
        }

        const searchableText = [
          promotion.badge,
          promotion.title,
          promotion.description,
          promotion.details,
          promotion.cta_label,
          promotion.cta_link,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText
          .includes(search);
      }
    );

  const result =
    paginateClientItems(
      filteredPromotions,
      promotionState.page,
      promotionState.limit
    );

  promotionState.page =
    result.pagination.page;

  if (!result.items.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          No promotions found.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (promotion) => `
          <tr>
            <td>
              ${Number(
                promotion.sort_order ||
                0
              )}
            </td>

            <td>
              ${escapeHtml(
                promotion.badge ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                promotion.title
              )}
            </td>

            <td class="wrap-text">
              ${escapeHtml(
                promotion.description ||
                '—'
              )}
            </td>

            <td>
              ${
                Number(
                  promotion.is_active
                )
                  ? 'Yes'
                  : 'No'
              }
            </td>

            <td>
              <button
                class="btn-small"
                type="button"
                data-edit-promotion="${promotion.id}"
              >
                Edit
              </button>

              <button
                class="btn-small danger"
                type="button"
                data-delete-promotion="${promotion.id}"
              >
                Delete
              </button>
            </td>
          </tr>
        `
      )
      .join('');

  tbody
    .querySelectorAll(
      '[data-edit-promotion]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const promotion =
              promotionsCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset
                      .editPromotion
                  )
              );

            if (promotion) {
              openPromotionModal(
                promotion
              );
            }
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-delete-promotion]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          async () => {
            const promotion =
              promotionsCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset
                      .deletePromotion
                  )
              );

            const promotionTitle =
              promotion?.title ||
              'this promotion';

            const confirmed =
              await confirmDelete({
                title:
                  `Delete ${promotionTitle}?`,

                message:
                  'This promotion will be permanently removed and cannot be recovered.',
              });

            if (!confirmed) {
              return;
            }

            button.disabled = true;

            try {
              await authedApi
                .deletePromotion(
                  button.dataset
                    .deletePromotion
                );

              await loadPromotions();

              showKpToast({
                title:
                  'Promotion deleted',

                message:
                  `${promotionTitle} has been permanently removed.`,

                duration: 5000,
              });
            } catch (error) {
              if (
                !handleAuthError(
                  error
                )
              ) {
                showKpToast({
                  title:
                    'Unable to delete promotion',

                  message:
                    error.message ||
                    'Please try again.',

                  duration: 7000,
                });
              }
            } finally {
              button.disabled =
                false;
            }
          }
        );
      }
    );

  renderPager(
    pager,
    result.pagination,
    (page) => {
      promotionState.page =
        page;

      renderPromotions();
    }
  );
}

function openPromotionModal(promotion = null) {
  const isEdit = Boolean(promotion);

  showModal(isEdit ? 'Edit promotion' : 'Add promotion', `
    <div class="admin-form-grid two-column">
      <label><span>Badge</span><input id="m-promo-badge" type="text" value="${escapeAttribute(promotion?.badge || '')}"></label>
      <label><span>Sort order</span><input id="m-promo-order" type="number" value="${Number(promotion?.sort_order || 0)}"></label>
    </div>
    <label><span>Title</span><input id="m-promo-title" type="text" value="${escapeAttribute(promotion?.title || '')}" required></label>
    <label><span>Description</span><textarea id="m-promo-description" rows="4">${escapeHtml(promotion?.description || '')}</textarea></label>
    <label><span>Details — one item per line</span><textarea id="m-promo-details" rows="6">${escapeHtml(promotion?.details || '')}</textarea></label>
    <div class="admin-form-grid two-column">
      <label><span>CTA label</span><input id="m-promo-cta-label" type="text" value="${escapeAttribute(promotion?.cta_label || '')}"></label>
      <label><span>CTA link</span><input id="m-promo-cta-link" type="url" value="${escapeAttribute(promotion?.cta_link || '')}"></label>
    </div>
    <div class="admin-upload-field">
  <label for="m-promo-image">
    Poster image
  </label>

  <input
    id="m-promo-image"
    type="file"
    accept="image/jpeg,image/png,image/webp"
  >

  <input
    id="m-promo-image-url"
    type="hidden"
    value="${escapeAttribute(
      promotion?.image_url || ''
    )}"
  >

  <div
    id="m-promo-preview-wrap"
    class="${
      promotion?.image_url
        ? ''
        : 'hidden'
    }"
  >
    <img
      id="m-promo-preview"
      class="admin-image-preview portrait"
      src="${
        promotion?.image_url
          ? escapeAttribute(
              resolveImageUrl(
                promotion.image_url
              )
            )
          : ''
      }"
      alt="Promotion preview"
    >

    <button
      type="button"
      class="btn-small danger"
      id="removePromotionImageBtn"
    >
      Delete poster image
    </button>
  </div>
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
        sort_order: Number(document.getElementById('m-promo-order').value || 0),
        is_active: Number(document.getElementById('m-promo-active').value),
      };

      if (isEdit) {
  await authedApi
    .updatePromotion(
      promotion.id,
      payload
    );
} else {
  await authedApi
    .createPromotion(
      payload
    );
}

closeModal();

await loadPromotions();

showKpToast({
  title: isEdit
    ? 'Promotion updated'
    : 'Promotion created',

  message:
    `${payload.title} has been saved successfully.`,

  duration: 5000,
});
    } catch (error) {
      if (!handleAuthError(error)) setMessage(message, error.message, 'error');
    }
  });

  bindImagePreview('m-promo-image', 'm-promo-preview');

  const promoImageInput =
  document.getElementById(
    'm-promo-image'
  );

const promoImageUrl =
  document.getElementById(
    'm-promo-image-url'
  );

const promoPreview =
  document.getElementById(
    'm-promo-preview'
  );

const promoPreviewWrap =
  document.getElementById(
    'm-promo-preview-wrap'
  );

promoImageInput?.addEventListener(
  'change',
  () => {
    if (
      promoImageInput.files?.length
    ) {
      promoPreviewWrap
        ?.classList.remove('hidden');
    }
  }
);

document
  .getElementById(
    'removePromotionImageBtn'
  )
  ?.addEventListener(
    'click',
    async () => {
      const confirmed =
        await confirmDelete({
          title:
            'Delete promotion image?',

          message:
            'The poster image will be removed after you save the promotion.',

          confirmText:
            'Remove image',
        });

      if (!confirmed) return;

      promoImageInput.value = '';
      promoImageUrl.value = '';

      if (promoPreview) {
        promoPreview.src = '';
      }

      promoPreviewWrap
        ?.classList.add('hidden');

      showKpToast({
        title:
          'Promotion image removed',

        message:
          'Save the promotion to apply this change.',

        duration: 5000,
      });
    }
  );
}

// -----------------------------------------------------------------------------
// ACTIVITIES & CSR
// -----------------------------------------------------------------------------

async function loadActivities() {
  const tbody =
    document.getElementById(
      'activitiesTableBody'
    );

  if (
    !tbody ||
    !authedApi?.getAdminActivities
  ) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="7"
        class="loading-row"
      >
        Loading…
      </td>
    </tr>
  `;

  try {
    activitiesCache =
      await authedApi
        .getAdminActivities();

    renderActivities();
  } catch (error) {
    if (
      !handleAuthError(error)
    ) {
      tbody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="empty-row"
          >
            ${escapeHtml(
              error.message ||
              'Unable to load activities.'
            )}
          </td>
        </tr>
      `;
    }
  }
}

function renderActivities() {
  const tbody =
    document.getElementById(
      'activitiesTableBody'
    );

  const pager =
    document.getElementById(
      'activitiesPager'
    );

  if (!tbody) {
    return;
  }

  const search =
    String(
      activityState.search ||
      ''
    )
      .trim()
      .toLowerCase();

  const filteredActivities =
    activitiesCache.filter(
      (activity) => {
        if (!search) {
          return true;
        }

        const searchableText = [
          activity.category,
          activity.title,
          activity.slug,
          activity.description,
          activity.location,
          activity.cta_label,
          getActivityMetaText(
            activity
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText
          .includes(search);
      }
    );

  const result =
    paginateClientItems(
      filteredActivities,
      activityState.page,
      activityState.limit
    );

  activityState.page =
    result.pagination.page;

  if (!result.items.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="empty-row"
        >
          No activities found.
        </td>
      </tr>
    `;

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  tbody.innerHTML =
    result.items
      .map(
        (activity) => `
          <tr data-id="${Number(
            activity.id
          )}">
            <td>
              <strong>
                ${escapeHtml(
                  activity.category ||
                  '—'
                )}
              </strong>
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  activity.title
                )}
              </strong>

              <div class="cell-subtext">
                /${escapeHtml(
                  activity.slug
                )}
              </div>
            </td>

            <td class="wrap-text">
              ${escapeHtml(
                getActivityMetaText(
                  activity
                )
              )}
            </td>

            <td>
              ${Number(
                activity.gallery
                  ?.length || 0
              )}
              image(s)
            </td>

            <td>
              ${Number(
                activity.sort_order ||
                0
              )}
            </td>

            <td>
              ${
                Number(
                  activity.is_active
                )
                  ? 'Yes'
                  : 'No'
              }
            </td>

            <td>
              <div class="table-action-stack">
                <button
                  class="btn-small"
                  type="button"
                  data-action="edit-activity"
                  data-id="${Number(
                    activity.id
                  )}"
                >
                  Edit
                </button>

                <button
                  class="btn-small"
                  type="button"
                  data-action="manage-activity-gallery"
                  data-id="${Number(
                    activity.id
                  )}"
                >
                  Gallery
                </button>

                <a
                  class="btn-small"
                  href="activities.html"
                  target="_blank"
                  rel="noopener"
                >
                  Preview
                </a>

                <button
                  class="btn-small danger"
                  type="button"
                  data-action="delete-activity"
                  data-id="${Number(
                    activity.id
                  )}"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join('');

  tbody
    .querySelectorAll(
      '[data-action="edit-activity"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const activity =
              activitiesCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            if (activity) {
              openActivityModal(
                activity
              );
            }
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="manage-activity-gallery"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            openActivityGalleryManager(
              Number(
                button.dataset.id
              )
            );
          }
        );
      }
    );

  tbody
    .querySelectorAll(
      '[data-action="delete-activity"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          async () => {
            const activity =
              activitiesCache.find(
                (item) =>
                  String(item.id) ===
                  String(
                    button.dataset.id
                  )
              );

            const activityTitle =
              activity?.title ||
              'this activity';

            const confirmed =
              await confirmDelete({
                title:
                  `Delete ${activityTitle}?`,

                message:
                  'This activity and its associated gallery content will be permanently removed. This action cannot be undone.',
              });

            if (!confirmed) {
              return;
            }

            button.disabled = true;

            try {
              await authedApi
                .deleteActivity(
                  button.dataset.id
                );

              await loadActivities();

              showKpToast({
                title:
                  'Activity deleted',

                message:
                  `${activityTitle} has been permanently removed.`,

                duration: 5000,
              });
            } catch (error) {
              if (
                !handleAuthError(
                  error
                )
              ) {
                showKpToast({
                  title:
                    'Unable to delete activity',

                  message:
                    error.message ||
                    'Please try again.',

                  duration: 7000,
                });
              }
            } finally {
              button.disabled =
                false;
            }
          }
        );
      }
    );

  renderPager(
    pager,
    result.pagination,
    (page) => {
      activityState.page =
        page;

      renderActivities();
    }
  );
}

function getActivityMetaText(
  activity
) {
  const manualMeta =
    String(
      activity.meta_text || ''
    ).trim();

  if (manualMeta) {
    return manualMeta;
  }

  const parts = [];

  if (activity.event_date) {
    parts.push(
      formatActivityDate(
        activity.event_date
      )
    );
  }

  if (activity.location) {
    parts.push(
      activity.location
    );
  }

  return (
    parts.join(' · ') ||
    '—'
  );
}

function formatActivityDate(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      `${String(value).slice(
        0,
        10
      )}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      month: 'long',
      year: 'numeric',
    }
  ).format(date);
}

function openActivityModal(
  activity = null
) {
  const isEdit =
    Boolean(activity);

  const categories = [
    'Community Outreach',
    'CSR Programme',
    'Staff Activity',
    'Sponsorship',
    'Health Screening',
    'School Programme',
    'Corporate Programme',
    'Other',
  ];

  const categoryOptions =
    categories
      .map(
        (category) => `
          <option
            value="${escapeAttribute(
              category
            )}"
            ${
              String(
                activity?.category ||
                ''
              ) === category
                ? 'selected'
                : ''
            }
          >
            ${escapeHtml(
              category
            )}
          </option>
        `
      )
      .join('');

  showModal(
    isEdit
      ? 'Edit activity'
      : 'Add activity',
    `
      <div class="admin-form-grid two-column">
        <label>
          <span>Category / tag</span>

          <select
            id="m-activity-category"
            required
          >
            <option value="">
              Select category
            </option>

            ${categoryOptions}
          </select>
        </label>

        <label>
          <span>Display order</span>

          <input
            id="m-activity-order"
            type="number"
            value="${Number(
              activity?.sort_order ||
              0
            )}"
          >
        </label>
      </div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Activity title</span>

          <input
            id="m-activity-title"
            type="text"
            value="${escapeAttribute(
              activity?.title || ''
            )}"
            required
          >
        </label>

        <label>
          <span>URL slug</span>

          <input
            id="m-activity-slug"
            type="text"
            value="${escapeAttribute(
              activity?.slug || ''
            )}"
            placeholder="ramadan-food-distribution"
          >
        </label>
      </div>

      <label>
        <span>Short description</span>

        <textarea
          id="m-activity-description"
          rows="5"
        >${escapeHtml(
          activity
            ?.short_description ||
          ''
        )}</textarea>
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Event date</span>

          <input
            id="m-activity-date"
            type="date"
            value="${escapeAttribute(
              activity?.event_date
                ? String(
                    activity.event_date
                  ).slice(0, 10)
                : ''
            )}"
          >
        </label>

        <label>
          <span>Location</span>

          <input
            id="m-activity-location"
            type="text"
            value="${escapeAttribute(
              activity?.location || ''
            )}"
            placeholder="Bandar Sri Permaisuri, Cheras"
          >
        </label>
      </div>

      <label>
        <span>
          Meta text shown on card
        </span>

        <input
          id="m-activity-meta"
          type="text"
          value="${escapeAttribute(
            activity?.meta_text || ''
          )}"
          placeholder="March 2026 · Bandar Sri Permaisuri, Cheras"
        >

        <div class="upload-help">
          Optional. When filled, this exact text
          will be shown on the public card.
        </div>
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>CTA label</span>

          <input
            id="m-activity-cta-label"
            type="text"
            value="${escapeAttribute(
              activity?.cta_label || ''
            )}"
            placeholder="Watch on TikTok →"
          >
        </label>

        <label>
          <span>CTA link</span>

          <input
            id="m-activity-cta-link"
            type="url"
            value="${escapeAttribute(
              activity?.cta_link || ''
            )}"
            placeholder="https://..."
          >
        </label>
      </div>

      <div class="admin-upload-field">
  <label for="m-activity-cover">
    Cover image
  </label>

  <input
    id="m-activity-cover"
    type="file"
    accept="image/jpeg,image/png,image/webp"
  >

  <input
    id="m-activity-cover-url"
    type="hidden"
    value="${escapeAttribute(
      activity?.cover_image_url || ''
    )}"
  >

  <div class="upload-help">
    Used as the first image when the
    activity has no gallery images.
  </div>

  <div
    id="m-activity-cover-preview-wrap"
    class="${
      activity?.cover_image_url
        ? ''
        : 'hidden'
    }"
  >
    <img
      id="m-activity-cover-preview"
      class="admin-image-preview landscape"
      src="${
        activity?.cover_image_url
          ? escapeAttribute(
              resolveImageUrl(
                activity.cover_image_url
              )
            )
          : ''
      }"
      alt="Activity cover preview"
    >

    <button
      type="button"
      class="btn-small danger"
      id="removeActivityCoverBtn"
    >
      Delete cover image
    </button>
  </div>
</div>

      <div class="admin-form-grid two-column">
        <label>
          <span>Featured</span>

          <select
            id="m-activity-featured"
          >
            <option
              value="1"
              ${
                Number(
                  activity
                    ?.is_featured
                )
                  ? 'selected'
                  : ''
              }
            >
              Yes
            </option>

            <option
              value="0"
              ${
                !Number(
                  activity
                    ?.is_featured
                )
                  ? 'selected'
                  : ''
              }
            >
              No
            </option>
          </select>
        </label>

        <label>
          <span>Active</span>

          <select
            id="m-activity-active"
          >
            <option
              value="1"
              ${
                !activity ||
                Number(
                  activity.is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              Yes
            </option>

            <option
              value="0"
              ${
                activity &&
                !Number(
                  activity.is_active
                )
                  ? 'selected'
                  : ''
              }
            >
              No
            </option>
          </select>
        </label>
      </div>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          class="btn-primary"
          type="submit"
        >
          ${
            isEdit
              ? 'Save activity'
              : 'Create activity'
          }
        </button>
      </div>
    `,
    async (event) => {
      event.preventDefault();

      const message =
        document.getElementById(
          'modalFormMessage'
        );

      const coverInput =
        document.getElementById(
          'm-activity-cover'
        );

      let coverImageUrl =
        document
          .getElementById(
            'm-activity-cover-url'
          )
          .value.trim() ||
        null;

      try {
        if (
          coverInput.files[0]
        ) {
          const upload =
            await authedApi
              .uploadImage(
                coverInput
                  .files[0],
                'activities'
              );

          coverImageUrl =
            upload.url;
        }

        const payload = {
          category:
            document
              .getElementById(
                'm-activity-category'
              )
              .value.trim(),

          title:
            document
              .getElementById(
                'm-activity-title'
              )
              .value.trim(),

          slug:
            document
              .getElementById(
                'm-activity-slug'
              )
              .value.trim(),

          short_description:
            document
              .getElementById(
                'm-activity-description'
              )
              .value.trim() ||
            null,

          event_date:
            document
              .getElementById(
                'm-activity-date'
              )
              .value ||
            null,

          meta_text:
            document
              .getElementById(
                'm-activity-meta'
              )
              .value.trim() ||
            null,

          location:
            document
              .getElementById(
                'm-activity-location'
              )
              .value.trim() ||
            null,

          cta_label:
            document
              .getElementById(
                'm-activity-cta-label'
              )
              .value.trim() ||
            null,

          cta_link:
            document
              .getElementById(
                'm-activity-cta-link'
              )
              .value.trim() ||
            null,

          cover_image_url:
            coverImageUrl,

          sort_order: Number(
            document
              .getElementById(
                'm-activity-order'
              )
              .value || 0
          ),

          is_featured: Number(
            document
              .getElementById(
                'm-activity-featured'
              )
              .value
          ),

          is_active: Number(
            document
              .getElementById(
                'm-activity-active'
              )
              .value
          ),
        };

        let savedId =
          activity?.id;

        if (isEdit) {
          await authedApi
            .updateActivity(
              activity.id,
              payload
            );
        } else {
          const response =
            await authedApi
              .createActivity(
                payload
              );

          savedId =
            response.id;
        }

        closeModal();

await loadActivities();

if (isEdit) {
  showKpToast({
    title:
      'Activity updated',

    message:
      `${payload.title} has been updated successfully.`,

    duration: 5000,
  });
}

if (
  !isEdit &&
  savedId
) {
  showKpToast({
    title:
      'Activity created',

    message:
      `${payload.title} has been saved successfully.`,

    actionText:
      'Add gallery images',

    onAction: () => {
      openActivityGalleryManager(
        savedId
      );
    },

    duration: 8000,
  });
}
      } catch (error) {
        if (
          !handleAuthError(
            error
          )
        ) {
          setMessage(
            message,
            error.message ||
              'Unable to save activity.',
            'error'
          );
        }
      }
    }
  );

  bindImagePreview(
    'm-activity-cover',
    'm-activity-cover-preview'
  );

  const activityCoverInput =
  document.getElementById(
    'm-activity-cover'
  );

const activityCoverUrl =
  document.getElementById(
    'm-activity-cover-url'
  );

const activityCoverPreview =
  document.getElementById(
    'm-activity-cover-preview'
  );

const activityCoverWrap =
  document.getElementById(
    'm-activity-cover-preview-wrap'
  );

activityCoverInput?.addEventListener(
  'change',
  () => {
    if (
      activityCoverInput.files?.length
    ) {
      activityCoverWrap
        ?.classList.remove('hidden');
    }
  }
);

document
  .getElementById(
    'removeActivityCoverBtn'
  )
  ?.addEventListener(
    'click',
    async () => {
      const confirmed =
        await confirmDelete({
          title:
            'Delete cover image?',

          message:
            'The activity cover image will be removed after you save the activity.',

          confirmText:
            'Remove image',
        });

      if (!confirmed) return;

      activityCoverInput.value = '';
      activityCoverUrl.value = '';

      if (activityCoverPreview) {
        activityCoverPreview.src = '';
      }

      activityCoverWrap
        ?.classList.add('hidden');

      showKpToast({
        title:
          'Cover image removed',

        message:
          'Save the activity to apply this change.',

        duration: 5000,
      });
    }
  );

  bindSlugGenerator(
    'm-activity-title',
    'm-activity-slug',
    !isEdit
  );
}

async function openActivityGalleryManager(
  activityId
) {
  try {
    const activity =
      await authedApi
        .getAdminActivity(
          activityId
        );

    renderActivityGalleryManager(
      activity
    );
  } catch (error) {
    if (
  !handleAuthError(error)
) {
  showKpToast({
    title:
      'Unable to load activity gallery',

    message:
      error.message ||
      'Please try again.',

    duration: 7000,
  });
}
  }
}

function renderActivityGalleryManager(
  activity
) {
  const gallery =
    Array.isArray(
      activity.gallery
    )
      ? activity.gallery
      : [];

  showModal(
    `Activity gallery · ${activity.title}`,
    `
      <div class="gallery-manager-grid">
        ${
          gallery.length
            ? gallery
                .map(
                  (image) => `
                    <article class="gallery-manager-card">
                      <img
                        src="${escapeAttribute(
                          resolveImageUrl(
                            image.image_url
                          )
                        )}"
                        alt="${escapeAttribute(
                          image.alt_text ||
                          image.caption ||
                          'Activity gallery image'
                        )}"
                      >

                      <div>
                        <strong>
                          ${escapeHtml(
                            image.caption ||
                            'No caption'
                          )}
                        </strong>

                        <small>
                          ${
                            Number(
                              image.is_active
                            )
                              ? 'Active'
                              : 'Inactive'
                          }
                          · Order
                          ${Number(
                            image.sort_order ||
                            0
                          )}
                        </small>

                        <div class="gallery-manager-actions">
                          <button
                            class="btn-small"
                            type="button"
                            data-edit-activity-gallery="${Number(
                              image.id
                            )}"
                          >
                            Edit
                          </button>

                          <button
                            class="btn-small danger"
                            type="button"
                            data-delete-activity-gallery="${Number(
                              image.id
                            )}"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  `
                )
                .join('')
            : `
                <div class="manager-empty">
                  No gallery images added yet.
                </div>
              `
        }
      </div>

      <hr class="modal-divider">

      <h3 id="activityGalleryFormHeading">
        Add gallery image
      </h3>

      <input
        id="m-activity-gallery-id"
        type="hidden"
      >

      <input
        id="m-activity-gallery-existing-url"
        type="hidden"
      >

      <div class="admin-upload-field">
        <label for="m-activity-gallery-file">
          Image
        </label>

        <input
  id="m-activity-gallery-file"
  type="file"
  accept="image/jpeg,image/png,image/webp"
  multiple
>

        <div class="upload-help">
  You may select multiple images at once.
  New images will be uploaded with automatic
  display order. Use Edit afterwards to add
  captions, alternative text or change order.
</div>

        <img
          id="m-activity-gallery-preview"
          class="admin-image-preview landscape hidden"
          src=""
          alt="Activity gallery preview"
        >
      </div>

      <label>
        <span>Caption</span>

        <input
          id="m-activity-gallery-caption"
          type="text"
          placeholder="Optional caption"
        >
      </label>

      <label>
        <span>Alternative text</span>

        <input
          id="m-activity-gallery-alt"
          type="text"
          placeholder="Describe the image"
        >
      </label>

      <div class="admin-form-grid two-column">
        <label>
          <span>Starting display order</span>

          <input
  id="m-activity-gallery-order"
  type="number"
  value="0"
  min="0"
>
        </label>

        <label>
          <span>Active</span>

          <select
            id="m-activity-gallery-active"
          >
            <option value="1">
              Yes
            </option>

            <option value="0">
              No
            </option>
          </select>
        </label>
      </div>

      <div
        id="modalFormMessage"
        class="form-message"
      ></div>

      <div class="modal-actions">
        <button
          class="btn-ghost"
          id="activityGalleryFormCancel"
          type="button"
        >
          Clear form
        </button>

        <button
          class="btn-primary"
          id="activityGallerySaveButton"
          type="submit"
        >
          Upload image
        </button>
      </div>
    `,
    async (event) => {
      event.preventDefault();

      const message =
        document.getElementById(
          'modalFormMessage'
        );

      const galleryId =
        document.getElementById(
          'm-activity-gallery-id'
        ).value;

      const existingUrl =
        document.getElementById(
          'm-activity-gallery-existing-url'
        ).value;

            const saveButton =
        document.getElementById(
          'activityGallerySaveButton'
        );

      const fileInput =
        document.getElementById(
          'm-activity-gallery-file'
        );

      const files =
        Array.from(
          fileInput.files || []
        );

      const caption =
        document
          .getElementById(
            'm-activity-gallery-caption'
          )
          .value.trim() ||
        null;

      const altText =
        document
          .getElementById(
            'm-activity-gallery-alt'
          )
          .value.trim() ||
        null;

      const startingOrder =
        Number(
          document
            .getElementById(
              'm-activity-gallery-order'
            )
            .value || 0
        );

      const isActive =
        Number(
          document
            .getElementById(
              'm-activity-gallery-active'
            )
            .value
        );

      /*
        Edit satu gallery image sedia ada.
      */
      if (galleryId) {
        if (files.length > 1) {
          setMessage(
            message,
            'When editing, select only one replacement image.',
            'error'
          );

          return;
        }

        let imageUrl =
          existingUrl || '';

        try {
          setMessage(message, '');

          setButtonLoading(
            saveButton,
            true,
            'Saving…'
          );

          if (files[0]) {
            const upload =
              await authedApi
                .uploadImage(
                  files[0],
                  'activities'
                );

            imageUrl =
              upload.url;
          }

          if (!imageUrl) {
            throw new Error(
              'A gallery image is required.'
            );
          }

          await authedApi
            .updateActivityGalleryItem(
              galleryId,
              {
                image_url:
                  imageUrl,

                caption,

                alt_text:
                  altText,

                sort_order:
                  startingOrder,

                is_active:
                  isActive,
              }
            );

          await openActivityGalleryManager(
            activity.id
          );
          showKpToast({
  title:
    'Gallery image updated',

  message:
    'The activity gallery image has been updated successfully.',

  duration: 5000,
});
showKpToast({
  title:
    'Gallery images added',

  message:
    `${uploadedImages.length} image(s) added successfully.`,

  duration: 5000,
});
        } catch (error) {
          if (
            !handleAuthError(
              error
            )
          ) {
            setMessage(
              message,
              error.message ||
                'Unable to update gallery image.',
              'error'
            );
          }

          setButtonLoading(
            saveButton,
            false,
            'Save changes'
          );
        }

        return;
      }

      /*
        Tambah banyak gambar baru sekali gus.
      */
      if (!files.length) {
        setMessage(
          message,
          'Please select at least one image.',
          'error'
        );

        return;
      }

      try {
        setMessage(
          message,
          `Uploading ${files.length} image(s)…`
        );

        setButtonLoading(
          saveButton,
          true,
          `Uploading 0/${files.length}…`
        );

        const uploadedImages = [];

        /*
          Upload secara berurutan supaya progress
          lebih tepat dan tidak membebankan server.
        */
        for (
          let index = 0;
          index < files.length;
          index += 1
        ) {
          const file =
            files[index];

          const upload =
            await authedApi
              .uploadImage(
                file,
                'activities'
              );

          uploadedImages.push({
            image_url:
              upload.url,

            sort_order:
              startingOrder +
              index,
          });

          setButtonLoading(
            saveButton,
            true,
            `Uploading ${
              index + 1
            }/${files.length}…`
          );
        }

        for (
          const uploadedImage
          of uploadedImages
        ) {
          await authedApi
            .createActivityGalleryItem(
              activity.id,
              {
                image_url:
                  uploadedImage
                    .image_url,

                caption:
                  null,

                alt_text:
                  null,

                sort_order:
                  uploadedImage
                    .sort_order,

                is_active:
                  isActive,
              }
            );
        }

        await openActivityGalleryManager(
          activity.id
        );
      } catch (error) {
        if (
          !handleAuthError(
            error
          )
        ) {
          setMessage(
            message,
            error.message ||
              'Unable to upload gallery images.',
            'error'
          );
        }

        setButtonLoading(
          saveButton,
          false,
          'Upload images'
        );
      }
    }
  );

  bindImagePreview(
    'm-activity-gallery-file',
    'm-activity-gallery-preview'
  );

  document
    .getElementById(
      'activityGalleryFormCancel'
    )
    ?.addEventListener(
      'click',
      clearActivityGalleryForm
    );

  document
    .querySelectorAll(
      '[data-edit-activity-gallery]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const image =
            gallery.find(
              (item) =>
                String(item.id) ===
                String(
                  button.dataset
                    .editActivityGallery
                )
            );

          if (!image) {
            return;
          }

          document.getElementById(
            'activityGalleryFormHeading'
          ).textContent =
            'Edit gallery image';

          document.getElementById(
            'm-activity-gallery-id'
          ).value =
            image.id;

          document.getElementById(
            'm-activity-gallery-existing-url'
          ).value =
            image.image_url || '';

          document.getElementById(
            'm-activity-gallery-caption'
          ).value =
            image.caption || '';

          document.getElementById(
            'm-activity-gallery-alt'
          ).value =
            image.alt_text || '';

          document.getElementById(
            'm-activity-gallery-order'
          ).value =
            image.sort_order || 0;

          document.getElementById(
            'm-activity-gallery-active'
          ).value =
            Number(
              image.is_active
            )
              ? '1'
              : '0';

          const fileInput =
            document.getElementById(
              'm-activity-gallery-file'
            );

          fileInput.value = '';
          fileInput.multiple = false;

          const preview =
            document.getElementById(
              'm-activity-gallery-preview'
            );

          preview.src =
            resolveImageUrl(
              image.image_url
            );

          preview.alt =
            image.alt_text ||
            image.caption ||
            'Activity gallery preview';

          preview.classList.remove(
            'hidden'
          );

          document.getElementById(
            'activityGallerySaveButton'
          ).textContent =
            'Save changes';

          document
            .getElementById(
              'm-activity-gallery-caption'
            )
            .focus();
        }
      );
    });

  document
  .querySelectorAll(
    '[data-delete-activity-gallery]'
  )
  .forEach((button) => {
    button.addEventListener(
      'click',
      async () => {
        const image =
          gallery.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset
                  .deleteActivityGallery
              )
          );

        const confirmed =
          await confirmDelete({
            title:
              'Delete gallery image?',

            message:
              image?.caption
                ? `${image.caption} will be permanently removed from this activity.`
                : 'This image will be permanently removed from the activity gallery.',
          });

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {
          await authedApi
            .deleteActivityGalleryItem(
              button.dataset
                .deleteActivityGallery
            );

          await openActivityGalleryManager(
            activity.id
          );

          showKpToast({
            title:
              'Gallery image deleted',

            message:
              'The image has been permanently removed.',

            duration: 5000,
          });
        } catch (error) {
          if (
            !handleAuthError(error)
          ) {
            showKpToast({
              title:
                'Unable to delete image',

              message:
                error.message ||
                'Please try again.',

              duration: 7000,
            });
          }
        } finally {
          button.disabled = false;
        }
      }
    );
  });
}

function clearActivityGalleryForm() {
  const heading =
    document.getElementById(
      'activityGalleryFormHeading'
    );

  const saveButton =
    document.getElementById(
      'activityGallerySaveButton'
    );

  if (heading) {
    heading.textContent =
      'Add gallery image';
  }

  if (saveButton) {
    saveButton.textContent =
      'Upload image';
  }

  [
    'm-activity-gallery-id',
    'm-activity-gallery-existing-url',
    'm-activity-gallery-caption',
    'm-activity-gallery-alt',
  ].forEach((id) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.value = '';
    }
  });

  const fileInput =
    document.getElementById(
      'm-activity-gallery-file'
    );

  if (fileInput) {
  fileInput.value = '';
  fileInput.multiple = true;
}

  const order =
    document.getElementById(
      'm-activity-gallery-order'
    );

  if (order) {
    order.value = '0';
  }

  const active =
    document.getElementById(
      'm-activity-gallery-active'
    );

  if (active) {
    active.value = '1';
  }

  const preview =
    document.getElementById(
      'm-activity-gallery-preview'
    );

  if (preview) {
    preview.removeAttribute(
      'src'
    );

    preview.alt =
      'Activity gallery preview';

    preview.classList.add(
      'hidden'
    );
  }

  setMessage(
    document.getElementById(
      'modalFormMessage'
    ),
    ''
  );
}

// -----------------------------------------------------------------------------
// USER MANAGEMENT — SUPERADMIN ONLY
// -----------------------------------------------------------------------------

async function loadAdminUsers() {
  const tbody =
    document.getElementById(
      'adminUsersTableBody'
    );

  if (
    !tbody ||
    !authedApi ||
    !isSuperadmin()
  ) {
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td
        colspan="7"
        class="loading-row"
      >
        Loading users…
      </td>
    </tr>
  `;

  try {
    const [
      stats,
      usersResponse,
    ] = await Promise.all([
      authedApi
        .getAdminUserStats(),

      authedApi
        .getAllAdminUsers(),
    ]);

    adminUsersCache =
      Array.isArray(
        usersResponse.data
      )
        ? usersResponse.data
        : [];

    renderAdminUserStats(
      stats || {}
    );

    renderFilteredAdminUsers();
  } catch (error) {
    if (
      handleAuthError(error)
    ) {
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="empty-row"
        >
          ${escapeHtml(
            error.message ||
            'Unable to load administrator users.'
          )}
        </td>
      </tr>
    `;
  }
}

function renderAdminUserStats(
  stats
) {
  setText(
    'adminStatsTotal',
    Number(
      stats.total_users || 0
    )
  );

  setText(
    'adminStatsActive',
    Number(
      stats.active_users || 0
    )
  );

  setText(
    'adminStatsPending',
    Number(
      stats.pending_approval || 0
    )
  );

  setText(
    'adminStatsManagers',
    Number(
      stats.managers || 0
    )
  );

  setText(
    'adminStatsAdmins',
    Number(
      stats.admins || 0
    )
  );

  setText(
    'adminStatsSignedIn',
    Number(
      stats.signed_in_users || 0
    )
  );

  setText(
    'adminStatsNeverSignedIn',
    Number(
      stats.never_signed_in || 0
    )
  );
}

function renderFilteredAdminUsers() {
  const tbody =
    document.getElementById(
      'adminUsersTableBody'
    );

  const pager =
    document.getElementById(
      'adminUsersPager'
    );

  if (!tbody) {
    return;
  }

  const search =
    document
      .getElementById(
        'adminUserSearchInput'
      )
      ?.value
      .trim()
      .toLowerCase() || '';

  const roleFilter =
    document
      .getElementById(
        'adminUserRoleFilter'
      )
      ?.value || '';

  const statusFilter =
    document
      .getElementById(
        'adminUserStatusFilter'
      )
      ?.value || '';

  const filteredUsers =
    adminUsersCache.filter(
      (user) => {
        const role =
          normalizeAdminRole(
            user.role
          );

        const status =
          getAdminUserStatus(
            user
          );

        const combinedText = [
          user.username,
          user.email,
          role,
          user.account_status,
          user.auth_provider,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !search ||
          combinedText.includes(
            search
          );

        const matchesRole =
          !roleFilter ||
          role === roleFilter;

        const matchesStatus =
          !statusFilter ||
          status === statusFilter;

        return (
          matchesSearch &&
          matchesRole &&
          matchesStatus
        );
      }
    );

  const result =
    paginateClientItems(
      filteredUsers,
      adminUserState.page,
      adminUserState.limit
    );

  adminUserState.page =
    result.pagination.page;

  if (!result.items.length) {
    renderAdminUsersTable([]);

    if (pager) {
      pager.innerHTML = '';
    }

    return;
  }

  renderAdminUsersTable(
    result.items
  );

  renderPager(
    pager,
    result.pagination,
    (page) => {
      adminUserState.page =
        page;

      renderFilteredAdminUsers();
    }
  );
}

function renderAdminUsersTable(
  users
) {
  const tbody =
    document.getElementById(
      'adminUsersTableBody'
    );

  if (!tbody) {
    return;
  }

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="empty-row"
        >
          No administrator users found.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    users
      .map((user) => {
        const role =
          normalizeAdminRole(
            user.role
          );

        const status =
          getAdminUserStatus(
            user
          );

        const isCurrentUser =
          Number(user.id) ===
          Number(currentAdmin?.id);

        const isProtected =
          role ===
            'superadmin' ||
          isCurrentUser;

        return `
          <tr data-user-id="${Number(
            user.id
          )}">
            <td>
              <strong>
                ${escapeHtml(
                  user.username ||
                  'Unnamed user'
                )}
              </strong>

              <div class="cell-subtext">
                ${escapeHtml(
                  user.email ||
                  'No email'
                )}
              </div>

              ${
                isCurrentUser
                  ? `
                    <div class="cell-subtext">
                      Current account
                    </div>
                  `
                  : ''
              }
            </td>

            <td>
              ${
                isProtected
                  ? `
                    <span class="status-pill status-confirmed">
                      ${escapeHtml(
                        formatAdminRole(
                          role
                        )
                      )}
                    </span>
                  `
                  : `
                    <select
                      class="admin-user-role-select"
                      data-user-role-id="${Number(
                        user.id
                      )}"
                      aria-label="Change role for ${escapeAttribute(
                        user.email ||
                        user.username ||
                        'administrator'
                      )}"
                    >
                      <option
                        value="admin"
                        ${
                          role ===
                          'admin'
                            ? 'selected'
                            : ''
                        }
                      >
                        Admin / CA
                      </option>

                      <option
                        value="manager"
                        ${
                          role ===
                          'manager'
                            ? 'selected'
                            : ''
                        }
                      >
                        Manager
                      </option>
                    </select>
                  `
              }
            </td>

            <td>
              ${escapeHtml(
                formatAuthProvider(
                  user.auth_provider
                )
              )}
            </td>

            <td>
              <span class="status-pill ${getAdminStatusClass(
                status
              )}">
                ${escapeHtml(
                  formatAdminStatus(
                    status
                  )
                )}
              </span>
            </td>

            <td>
              ${escapeHtml(
                formatAdminDateTime(
                  user.last_login_at,
                  'Never'
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                formatAdminDateTime(
                  user.created_at,
                  '—'
                )
              )}
            </td>

            <td>
              ${renderAdminUserActions(
                user,
                status,
                isProtected
              )}
            </td>
          </tr>
        `;
      })
      .join('');

  bindAdminUserActions();
}

function renderAdminUserActions(
  user,
  status,
  isProtected
) {
  if (isProtected) {
    return `
      <span class="cell-subtext">
        Protected
      </span>
    `;
  }

  if (
    String(
      user.account_status || ''
    ).toLowerCase() !==
    'active'
  ) {
    return `
      <span class="cell-subtext">
        Complete approval first
      </span>
    `;
  }

  if (status === 'inactive') {
    return `
      <button
        class="btn-small"
        type="button"
        data-action="reactivate-admin"
        data-id="${Number(user.id)}"
      >
        Reactivate
      </button>
    `;
  }

  return `
    <button
      class="btn-small danger"
      type="button"
      data-action="deactivate-admin"
      data-id="${Number(user.id)}"
    >
      Deactivate
    </button>
  `;
}

function bindAdminUserActions() {
  document
    .querySelectorAll(
      '.admin-user-role-select'
    )
    .forEach((select) => {
      select.dataset.previous =
        select.value;

      select.addEventListener(
        'change',
        async () => {
          const userId =
            Number(
              select.dataset
                .userRoleId
            );

          const previousRole =
            select.dataset.previous;

          const nextRole =
            select.value;

          const confirmed =
  await confirmStatusChange({
    title:
      `Change role to ${formatAdminRole(
        nextRole
      )}?`,

    message:
      `This will change the dashboard permissions available to this administrator.`,

    confirmText:
      'Change role',
  });

          if (!confirmed) {
            select.value =
              previousRole;

            return;
          }

          select.disabled = true;

          try {
            await authedApi
              .changeAdminRole(
                userId,
                nextRole
              );

            await loadAdminUsers();
            showKpToast({
  title:
    'Administrator role updated',

  message:
    `Role changed to ${formatAdminRole(
      nextRole
    )}.`,

  duration: 5000,
});
          } catch (error) {
            select.value =
              previousRole;

            if (
              !handleAuthError(
                error
              )
            ) {
              showKpToast({
  title:
    'Unable to change role',

  message:
    error.message ||
    'Please try again.',

  duration: 7000,
});
            }
          } finally {
            select.disabled =
              false;
          }
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="deactivate-admin"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
            const confirmed =
  await confirmStatusChange({
    title:
      'Deactivate administrator?',

    message:
      'This account will no longer be able to access the admin dashboard until it is reactivated.',

    confirmText:
      'Deactivate',
  });

          if (!confirmed) {
            return;
          }

          try {
            await authedApi
              .deactivateAdmin(
                button.dataset.id
              );

            await loadAdminUsers();
            showKpToast({
  title:
    'Administrator deactivated',

  message:
    'Dashboard access has been disabled for this account.',

  duration: 5000,
});
          } catch (error) {
            if (
              !handleAuthError(
                error
              )
            ) {
              showKpToast({
  title:
    'Unable to deactivate user',

  message:
    error.message ||
    'Please try again.',

  duration: 7000,
});
            }
          }
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="reactivate-admin"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          const confirmed =
  await confirmStatusChange({
    title:
      'Reactivate administrator?',

    message:
      'This account will regain access to the admin dashboard according to its assigned role.',

    confirmText:
      'Reactivate',
  });

          if (!confirmed) {
            return;
          }

          try {
            await authedApi
              .reactivateAdmin(
                button.dataset.id
              );

            await loadAdminUsers();
            showKpToast({
  title:
    'Administrator reactivated',

  message:
    'Dashboard access has been restored.',

  duration: 5000,
});
          } catch (error) {
            if (
              !handleAuthError(
                error
              )
            ) {
              showKpToast({
  title:
    'Unable to reactivate user',

  message:
    error.message ||
    'Please try again.',

  duration: 7000,
});
            }
          }
        }
      );
    });
}

function getAdminUserStatus(user) {
  const accountStatus =
    String(
      user.account_status || ''
    )
      .trim()
      .toLowerCase();

  if (
    accountStatus === 'active' &&
    Number(user.is_active) !== 1
  ) {
    return 'inactive';
  }

  return (
    accountStatus ||
    'unknown'
  );
}

function formatAdminRole(role) {
  const labels = {
    superadmin:
      'Superadmin',

    manager:
      'Manager',

    admin:
      'Admin / CA',
  };

  return (
    labels[
      normalizeAdminRole(role)
    ] ||
    'Admin / CA'
  );
}

function formatAdminStatus(status) {
  const labels = {
    active:
      'Active',

    inactive:
      'Deactivated',

    pending_approval:
      'Pending Approval',

    pending_verification:
      'Pending Verification',

    rejected:
      'Rejected',

    unknown:
      'Unknown',
  };

  return (
    labels[status] ||
    formatCategory(status)
  );
}

function getAdminStatusClass(status) {
  const classes = {
    active:
      'status-completed',

    inactive:
      'status-cancelled',

    pending_approval:
      'status-pending',

    pending_verification:
      'status-pending',

    rejected:
      'status-cancelled',
  };

  return (
    classes[status] ||
    'status-pending'
  );
}

function formatAuthProvider(provider) {
  const value =
    String(
      provider || 'local'
    )
      .trim()
      .toLowerCase();

  if (value === 'google') {
    return 'Google';
  }

  return 'Email / Password';
}

function formatAdminDateTime(
  value,
  fallback = '—'
) {
  if (!value) {
    return fallback;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return fallback;
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date);
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

function openKpActionModal({
  eyebrow = 'Confirm action',
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
} = {}) {
  return new Promise((resolve) => {
    const modal =
      document.getElementById(
        'kpActionModal'
      );

    const backdrop =
      modal?.querySelector(
        '.kp-action-modal__backdrop'
      );

    const dialog =
      modal?.querySelector(
        '.kp-action-modal__dialog'
      );

    const iconEl =
      modal?.querySelector(
        '.kp-action-modal__icon'
      );

    const eyebrowEl =
      document.getElementById(
        'kpActionModalEyebrow'
      );

    const titleEl =
      document.getElementById(
        'kpActionModalTitle'
      );

    const messageEl =
      document.getElementById(
        'kpActionModalMessage'
      );

    const confirmBtn =
      document.getElementById(
        'kpActionModalConfirm'
      );

    const cancelBtn =
      document.getElementById(
        'kpActionModalCancel'
      );

    if (
      !modal ||
      !dialog ||
      !confirmBtn ||
      !cancelBtn
    ) {
      resolve(false);
      return;
    }

    const allowedVariants = [
      'default',
      'warning',
      'danger',
    ];

    const resolvedVariant =
      allowedVariants.includes(
        variant
      )
        ? variant
        : 'default';

    dialog.dataset.variant =
      resolvedVariant;

    if (iconEl) {
      const icons = {
        default: '✓',
        warning: '!',
        danger: '!',
      };

      iconEl.textContent =
        icons[resolvedVariant];
    }

    if (eyebrowEl) {
      eyebrowEl.textContent =
        eyebrow;
    }

    if (titleEl) {
      titleEl.textContent =
        title;
    }

    if (messageEl) {
      messageEl.textContent =
        message;
    }

    confirmBtn.textContent =
      confirmText;

    cancelBtn.textContent =
      cancelText;

    modal.hidden = false;

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    function cleanup(result) {
      modal.hidden = true;

      modal.setAttribute(
        'aria-hidden',
        'true'
      );

      document.body.style.overflow =
        previousOverflow;

      delete dialog.dataset.variant;

      confirmBtn.removeEventListener(
        'click',
        onConfirm
      );

      cancelBtn.removeEventListener(
        'click',
        onCancel
      );

      backdrop?.removeEventListener(
        'click',
        onCancel
      );

      document.removeEventListener(
        'keydown',
        onKeydown
      );

      resolve(result);
    }

    function onConfirm() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        cleanup(false);
      }
    }

    confirmBtn.addEventListener(
      'click',
      onConfirm
    );

    cancelBtn.addEventListener(
      'click',
      onCancel
    );

    backdrop?.addEventListener(
      'click',
      onCancel
    );

    document.addEventListener(
      'keydown',
      onKeydown
    );

    setTimeout(() => {
      confirmBtn.focus();
    }, 30);
  });
}

function confirmDelete({
  title = 'Delete this item?',
  message =
    'This action cannot be undone.',
  confirmText = 'Delete',
} = {}) {
  return openKpActionModal({
    eyebrow: 'Confirm deletion',
    title,
    message,
    confirmText,
    cancelText: 'Cancel',
    variant: 'danger',
  });
}

function confirmStatusChange({
  title,
  message,
  confirmText = 'Continue',
} = {}) {
  return openKpActionModal({
    eyebrow: 'Confirm change',
    title,
    message,
    confirmText,
    cancelText: 'Cancel',
    variant: 'warning',
  });
}

function paginateClientItems(
  items,
  requestedPage = 1,
  limit = 10
) {
  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  const safeLimit =
    Math.max(
      1,
      Number(limit) || 10
    );

  const total =
    safeItems.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / safeLimit
      )
    );

  const page =
    Math.min(
      Math.max(
        1,
        Number(requestedPage) || 1
      ),
      totalPages
    );

  const startIndex =
    (page - 1) *
    safeLimit;

  return {
    items:
      safeItems.slice(
        startIndex,
        startIndex +
          safeLimit
      ),

    pagination: {
      page,
      limit:
        safeLimit,
      total,
      totalPages,
      hasNext:
        page < totalPages,
      hasPrevious:
        page > 1,
    },
  };
}

function getPagerItems(
  currentPage,
  totalPages,
  {
    siblingCount = 2,
    edgeWindow = 5,
  } = {}
) {
  const pages = new Set([
    1,
    totalPages,
  ]);

  for (
    let page =
      currentPage - siblingCount;
    page <=
    currentPage + siblingCount;
    page += 1
  ) {
    if (
      page >= 1 &&
      page <= totalPages
    ) {
      pages.add(page);
    }
  }

  if (
    currentPage <=
    edgeWindow - 1
  ) {
    for (
      let page = 1;
      page <=
      Math.min(
        edgeWindow,
        totalPages
      );
      page += 1
    ) {
      pages.add(page);
    }
  }

  if (
    currentPage >=
    totalPages - edgeWindow + 2
  ) {
    for (
      let page = Math.max(
        1,
        totalPages - edgeWindow + 1
      );
      page <= totalPages;
      page += 1
    ) {
      pages.add(page);
    }
  }

  const sortedPages =
    Array.from(pages)
      .sort((a, b) => a - b);

  return sortedPages.reduce(
    (items, page, index) => {
      const previousPage =
        sortedPages[index - 1];

      if (index > 0) {
        const gap =
          page - previousPage;

        if (gap === 2) {
          items.push(
            previousPage + 1
          );
        } else if (gap > 2) {
          items.push('ellipsis');
        }
      }

      items.push(page);

      return items;
    },
    []
  );
}

function renderPagerPageItems(
  items,
  currentPage
) {
  return items
    .map((item) => {
      if (item === 'ellipsis') {
        return `
          <span
            class="pager-ellipsis"
            aria-hidden="true"
          >
            …
          </span>
        `;
      }

      const isCurrent =
        item === currentPage;

      return `
        <button
          class="pager-page-button${
            isCurrent
              ? ' is-current'
              : ''
          }"
          type="button"
          data-page="${item}"
          aria-label="${
            isCurrent
              ? `Current page, ${item}`
              : `Go to page ${item}`
          }"
          ${
            isCurrent
              ? 'aria-current="page"'
              : ''
          }
        >
          ${item}
        </button>
      `;
    })
    .join('');
}

function renderPager(
  container,
  pagination,
  onPage
) {
  if (!container || !pagination) return;

  const totalPages = Math.max(
    1,
    Math.trunc(
      Number(
        pagination.totalPages || 1
      )
    ) || 1
  );

  const page = Math.min(
    totalPages,
    Math.max(
      1,
      Math.trunc(
        Number(
          pagination.page || 1
        )
      ) || 1
    )
  );

  const total = Math.max(
    0,
    Number(pagination.total || 0)
  );

  const limit = Math.max(
    1,
    Number(pagination.limit || 20)
  );

  const start = total ? ((page - 1) * limit) + 1 : 0;
  const end = total ? Math.min(page * limit, total) : 0;

  const desktopPageItems =
    getPagerItems(
      page,
      totalPages
    );

  const mobilePageItems =
    getPagerItems(
      page,
      totalPages,
      {
        siblingCount: 0,
        edgeWindow: 3,
      }
    );

  container.innerHTML = `
    <span class="booking-showing-info">
      Showing ${start}–${end} of ${total}
    </span>

    <div class="pager-actions">
      <button
        class="pager-nav-button"
        type="button"
        data-page="${page - 1}"
        ${page <= 1 ? 'disabled' : ''}
      >
        Previous
      </button>

      <div class="pager-pages pager-pages--desktop">
        ${renderPagerPageItems(
          desktopPageItems,
          page
        )}
      </div>

      <div class="pager-pages pager-pages--mobile">
        ${renderPagerPageItems(
          mobilePageItems,
          page
        )}
      </div>

      <button
        class="pager-nav-button"
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

function showKpToast({
  title = 'Success',
  message = '',
  actionText = '',
  onAction = null,
  duration = 6000,
} = {}) {
  const toast =
    document.getElementById(
      'kpToast'
    );

  const titleEl =
    document.getElementById(
      'kpToastTitle'
    );

  const messageEl =
    document.getElementById(
      'kpToastMessage'
    );

  const actionBtn =
    document.getElementById(
      'kpToastAction'
    );

  const dismissBtn =
    document.getElementById(
      'kpToastDismiss'
    );

  if (
    !toast ||
    !titleEl ||
    !messageEl ||
    !actionBtn ||
    !dismissBtn
  ) {
    return;
  }

  titleEl.textContent =
    title;

  messageEl.textContent =
    message;

  actionBtn.textContent =
    actionText;

  actionBtn.hidden =
    !actionText ||
    typeof onAction !==
      'function';

  toast.hidden = false;

  let timer = null;

  const closeToast = () => {
    toast.hidden = true;

    if (timer) {
      clearTimeout(timer);
    }

    actionBtn.onclick = null;
    dismissBtn.onclick = null;
  };

  actionBtn.onclick = () => {
    closeToast();

    if (
      typeof onAction ===
      'function'
    ) {
      onAction();
    }
  };

  dismissBtn.onclick =
    closeToast;

  if (duration > 0) {
    timer = setTimeout(
      closeToast,
      duration
    );
  }
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
