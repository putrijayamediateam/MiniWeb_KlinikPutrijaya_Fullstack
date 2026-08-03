'use strict';

document.addEventListener(
  'DOMContentLoaded',
  initAppointmentForm
);

async function initAppointmentForm() {
  const form = document.getElementById(
    'bookingForm'
  );

  if (!form) {
    return;
  }

  const branchSelect =
    document.getElementById('bk-branch');

  const doctorSelect =
    document.getElementById('bk-doctor');

  const serviceSelect =
    document.getElementById('bk-service');

    const identityTypeSelect =
  document.getElementById(
    'bk-identity-type'
  );

const identityNumberInput =
  document.getElementById(
    'bk-identity-number'
  );

const identityNumberLabel =
  document.getElementById(
    'bk-identity-number-label'
  );

  const messageBox =
    document.getElementById(
      'bookingMessage'
    );

  const submitButton =
    document.getElementById(
      'bookingSubmitBtn'
    );

  const urlParams =
    new URLSearchParams(
      window.location.search
    );

  const requestedServiceId =
    urlParams.get('service_id');

  const requestedBranchId =
    urlParams.get('branch_id');

  let branchesCache = [];
  let servicesCache = [];

  updateIdentityField(
  identityTypeSelect,
  identityNumberInput,
  identityNumberLabel
);

identityTypeSelect.addEventListener(
  'change',
  () => {
    updateIdentityField(
      identityTypeSelect,
      identityNumberInput,
      identityNumberLabel
    );
  }
);

  branchSelect.disabled = true;
  branchSelect.innerHTML = `
    <option value="">
      Loading branches...
    </option>
  `;

  serviceSelect.disabled = true;
  serviceSelect.innerHTML = `
    <option value="">
      Loading services...
    </option>
  `;

  resetDoctorSelect();

  try {
    const [
      branchesResponse,
      servicesResponse,
    ] = await Promise.all([
      KPApi.getBranches(),
      KPApi.getServiceCatalog(),
    ]);

    branchesCache =
      Array.isArray(branchesResponse)
        ? branchesResponse
        : [];

    servicesCache =
      Array.isArray(servicesResponse)
        ? servicesResponse
        : [];

    renderBranchOptions(
      branchSelect,
      branchesCache
    );

    renderServiceOptions(
      serviceSelect,
      servicesCache
    );

    branchSelect.disabled = false;
    serviceSelect.disabled = false;

    const validRequestedService =
      servicesCache.find(
        (service) =>
          String(service.id) ===
          String(requestedServiceId)
      );

    const validRequestedBranch =
      branchesCache.find(
        (branch) =>
          String(branch.id) ===
          String(requestedBranchId)
      );

    if (validRequestedService) {
      serviceSelect.value =
        String(validRequestedService.id);
    }

    let initialBranchId = '';

    if (validRequestedBranch) {
      initialBranchId =
        String(validRequestedBranch.id);
    } else if (
      validRequestedService &&
      Array.isArray(
        validRequestedService.branches
      ) &&
      validRequestedService.branches
        .length === 1
    ) {
      initialBranchId = String(
        validRequestedService.branches[0].id
      );
    }

    if (initialBranchId) {
      branchSelect.value =
        initialBranchId;

      await loadDoctorsForBranch(
        initialBranchId,
        doctorSelect
      );
    }
  } catch (error) {
    console.error(
      'Unable to load appointment options:',
      error
    );

    branchSelect.innerHTML = `
      <option value="">
        Could not load branches
      </option>
    `;

    serviceSelect.innerHTML = `
      <option value="">
        Could not load services
      </option>
    `;

    setFormMessage(
      messageBox,
      error.message ||
        'Unable to load appointment options.',
      'error'
    );
  }

  branchSelect.addEventListener(
    'change',
    async () => {
      const branchId =
        branchSelect.value;

      if (!branchId) {
        resetDoctorSelect();
        return;
      }

      await loadDoctorsForBranch(
        branchId,
        doctorSelect
      );
    }
  );

  serviceSelect.addEventListener(
    'change',
    async () => {
      const selectedService =
        servicesCache.find(
          (service) =>
            String(service.id) ===
            String(serviceSelect.value)
        );

      if (
        !selectedService ||
        !Array.isArray(
          selectedService.branches
        ) ||
        !selectedService.branches.length
      ) {
        return;
      }

      const availableBranchIds =
        selectedService.branches.map(
          (branch) =>
            String(branch.id)
        );

      const currentBranchId =
        String(branchSelect.value || '');

      if (
        currentBranchId &&
        availableBranchIds.includes(
          currentBranchId
        )
      ) {
        return;
      }

      if (
        availableBranchIds.length === 1
      ) {
        branchSelect.value =
          availableBranchIds[0];

        await loadDoctorsForBranch(
          availableBranchIds[0],
          doctorSelect
        );

        return;
      }

      branchSelect.value = '';
      resetDoctorSelect();
    }
  );

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      setFormMessage(
        messageBox,
        ''
      );

      const payload = {
  branch_id:
    Number(
      form.branch_id.value
    ) || null,

  doctor_id:
    form.doctor_id.value
      ? Number(
          form.doctor_id.value
        )
      : null,

  service_id:
    form.service_id.value
      ? Number(
          form.service_id.value
        )
      : null,

  patient_name:
    form.patient_name.value.trim(),

  gender:
    form.elements.gender.value,

  phone:
    form.phone.value.trim(),

  identity_type:
    form.identity_type.value,

  identity_number:
    form.identity_number.value.trim(),

  preferred_date:
    form.preferred_date.value,

  preferred_time:
    form.preferred_time.value,

  reason:
    form.reason?.value.trim() ||
    null,
};

      if (
  !payload.branch_id ||
  !payload.patient_name ||
  !payload.gender ||
  !payload.phone ||
  !payload.identity_type ||
  !payload.identity_number ||
  !payload.preferred_date ||
  !payload.preferred_time
) {
  setFormMessage(
    messageBox,
    'Please fill in all required fields (*).',
    'error'
  );

  return;
}

if (
  !['male', 'female'].includes(
    payload.gender
  )
) {
  setFormMessage(
    messageBox,
    'Please select a valid gender.',
    'error'
  );

  return;
}

if (
  !['ic', 'passport'].includes(
    payload.identity_type
  )
) {
  setFormMessage(
    messageBox,
    'Please select IC or Passport.',
    'error'
  );

  return;
}

if (
  payload.identity_number.length < 4 ||
  payload.identity_number.length > 50
) {
  setFormMessage(
    messageBox,
    'Please enter a valid IC or Passport number.',
    'error'
  );

  return;
}

      submitButton.disabled = true;
      submitButton.textContent =
        'Sending...';

      try {
        const response =
          await KPApi.createBooking(
            payload
          );

          if (window.KPAnalytics) {
  window.KPAnalytics.track(
    'booking_success',
    {
      branch_id:
        payload.branch_id,

      service_id:
        payload.service_id,

      event_key:
        response.reference
          ? `booking_success:${response.reference}`
          : null,
    }
  );
} else {
  KPApi.trackPerformance({
    event_type:
      'booking_success',

    branch_id:
      payload.branch_id,

    service_id:
      payload.service_id,

    event_key:
      response.reference
        ? `booking_success:${response.reference}`
        : null,

    page_path:
      window.location.pathname,
  }).catch(() => {});
}

        setFormMessage(
          messageBox,
          `${response.message} Reference: ${response.reference}`,
          'success'
        );

        form.reset();

updateIdentityField(
  identityTypeSelect,
  identityNumberInput,
  identityNumberLabel
);

resetDoctorSelect();
      } catch (error) {
        setFormMessage(
          messageBox,
          error.message ||
            'Unable to send appointment request.',
          'error'
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent =
          'Request appointment';
      }
    }
  );
}

function updateIdentityField(
  typeSelect,
  numberInput,
  numberLabel
) {
  if (
    !typeSelect ||
    !numberInput ||
    !numberLabel
  ) {
    return;
  }

  const identityType =
    String(
      typeSelect.value || ''
    ).trim();

  numberInput.value = '';

  if (identityType === 'ic') {
    numberLabel.textContent =
      'Malaysian IC number *';

    numberInput.placeholder =
      'Example: 990101-14-5678';

    numberInput.inputMode =
      'numeric';

    numberInput.disabled = false;
    return;
  }

  if (identityType === 'passport') {
    numberLabel.textContent =
      'Passport number *';

    numberInput.placeholder =
      'Enter passport number';

    numberInput.inputMode =
      'text';

    numberInput.disabled = false;
    return;
  }

  numberLabel.textContent =
    'IC / Passport number *';

  numberInput.placeholder =
    'Select identification type first';

  numberInput.inputMode =
    'text';

  numberInput.disabled = true;
}

function renderBranchOptions(
  select,
  branches
) {
  select.innerHTML = [
    `
      <option value="">
        Select a branch
      </option>
    `,
    ...branches.map(
      (branch) => `
        <option value="${Number(
          branch.id
        )}">
          ${escapeHtml(branch.name)}
        </option>
      `
    ),
  ].join('');
}

function renderServiceOptions(
  select,
  services
) {
  const sortedServices = [
    ...services,
  ].sort((first, second) => {
    const firstCategory =
      String(
        first.category_name || ''
      );

    const secondCategory =
      String(
        second.category_name || ''
      );

    const categoryComparison =
      firstCategory.localeCompare(
        secondCategory
      );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    return String(
      first.title || ''
    ).localeCompare(
      String(second.title || '')
    );
  });

  select.innerHTML = [
    `
      <option value="">
        Not sure / general consultation
      </option>
    `,
    ...sortedServices.map(
      (service) => {
        const categoryLabel =
          service.subcategory_name ||
          service.category_name ||
          '';

        const optionLabel =
          categoryLabel
            ? `${service.title} — ${categoryLabel}`
            : service.title;

        return `
          <option value="${Number(
            service.id
          )}">
            ${escapeHtml(optionLabel)}
          </option>
        `;
      }
    ),
  ].join('');
}

async function loadDoctorsForBranch(
  branchId,
  doctorSelect
) {
  doctorSelect.disabled = true;

  doctorSelect.innerHTML = `
    <option value="">
      Loading doctors...
    </option>
  `;

  try {
    const doctorsResponse =
      await KPApi.getDoctors({
        branch: branchId,
      });

    const doctors =
      Array.isArray(doctorsResponse)
        ? doctorsResponse
        : [];

    doctorSelect.innerHTML = [
      `
        <option value="">
          Any available doctor
        </option>
      `,
      ...doctors.map(
        (doctor) => `
          <option value="${Number(
            doctor.id
          )}">
            ${escapeHtml(doctor.name)}
          </option>
        `
      ),
    ].join('');

    doctorSelect.disabled = false;
  } catch (error) {
    console.error(
      'Unable to load doctors:',
      error
    );

    doctorSelect.innerHTML = `
      <option value="">
        Could not load doctors
      </option>
    `;

    doctorSelect.disabled = true;
  }
}

function resetDoctorSelect() {
  const doctorSelect =
    document.getElementById('bk-doctor');

  if (!doctorSelect) {
    return;
  }

  doctorSelect.disabled = true;

  doctorSelect.innerHTML = `
    <option value="">
      Please select branch first
    </option>
  `;
}

function setFormMessage(
  element,
  message,
  type = ''
) {
  if (!element) {
    return;
  }

  element.textContent =
    message || '';

  element.className =
    `kp-form-message${
      type ? ` ${type}` : ''
    }`;
}

function escapeHtml(value) {
  const div =
    document.createElement('div');

  div.textContent =
    value == null
      ? ''
      : String(value);

  return div.innerHTML;
}