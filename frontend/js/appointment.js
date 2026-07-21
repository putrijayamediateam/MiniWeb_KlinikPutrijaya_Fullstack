document.addEventListener('DOMContentLoaded', initBookingForm);

function initBookingForm() {
  const form = document.getElementById('bookingForm');
  if (!form) return;

  const branchSelect = document.getElementById('bk-branch');
  const doctorSelect = document.getElementById('bk-doctor');
  const serviceSelect = document.getElementById('bk-service');
  const dateInput = document.getElementById('bk-date');
  const messageBox = document.getElementById('bookingMessage');
  const submitButton = document.getElementById('bookingSubmitBtn');

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  dateInput.min = localToday;

  doctorSelect.disabled = true;
  doctorSelect.innerHTML = '<option value="">Please select branch first</option>';

  Promise.allSettled([KPApi.getBranches(), KPApi.getServices()]).then(([branchesResult, servicesResult]) => {
    if (branchesResult.status === 'fulfilled') {
      branchSelect.innerHTML = '<option value="">Select a branch</option>' + branchesResult.value
        .map((branch) => `<option value="${branch.id}">${KPUtils.escapeHtml(branch.name)}</option>`)
        .join('');
    } else {
      branchSelect.innerHTML = '<option value="">Could not load branches</option>';
    }

    if (servicesResult.status === 'fulfilled') {
      serviceSelect.innerHTML = '<option value="">Not sure / general consultation</option>' + servicesResult.value
        .map((service) => `<option value="${service.id}">${KPUtils.escapeHtml(service.title)}</option>`)
        .join('');
    }
  });

  branchSelect.addEventListener('change', async () => {
    const branchId = branchSelect.value;
    const branchName = branchSelect.options[branchSelect.selectedIndex]?.textContent.trim();

    if (!branchId) {
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
      return;
    }

    doctorSelect.disabled = true;
    doctorSelect.innerHTML = '<option value="">Loading doctors…</option>';

    try {
      const allDoctors = await KPApi.getDoctors();
      const doctors = allDoctors.filter((doctor) => (
        String(doctor.branch_id) === String(branchId) || doctor.branch_name === branchName
      ));

      if (!doctors.length) {
        doctorSelect.innerHTML = '<option value="">No doctor currently listed for this branch</option>';
        return;
      }

      doctorSelect.innerHTML = '<option value="">Any available doctor</option>' + doctors
        .map((doctor) => `<option value="${doctor.id}">${KPUtils.escapeHtml(doctor.name)}</option>`)
        .join('');
      doctorSelect.disabled = false;
    } catch (_) {
      doctorSelect.innerHTML = '<option value="">Could not load doctors</option>';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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

    if (!payload.branch_id || !payload.patient_name || !payload.phone || !payload.preferred_date || !payload.preferred_time) {
      messageBox.textContent = 'Please fill in all required fields (*).';
      messageBox.className = 'kp-form-message error';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    try {
      const response = await KPApi.createBooking(payload);
      messageBox.textContent = response?.message || 'Appointment request sent. Our team will contact you to confirm the slot.';
      messageBox.className = 'kp-form-message success';
      form.reset();
      dateInput.min = localToday;
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
    } catch (error) {
      messageBox.textContent = error.message || 'Something went wrong. Please try again.';
      messageBox.className = 'kp-form-message error';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Request appointment';
    }
  });
}
