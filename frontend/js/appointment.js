'use strict';

document.addEventListener('DOMContentLoaded', initAppointmentForm);

function initAppointmentForm() {
  const form = document.getElementById('bookingForm');
  if (!form) return;

  const branchSelect = document.getElementById('bk-branch');
  const doctorSelect = document.getElementById('bk-doctor');
  const serviceSelect = document.getElementById('bk-service');
  const messageBox = document.getElementById('bookingMessage');
  const submitButton = document.getElementById('bookingSubmitBtn');
  const requestedServiceId = new URLSearchParams(window.location.search).get('service_id');

  doctorSelect.disabled = true;
  doctorSelect.innerHTML = '<option value="">Please select branch first</option>';

  Promise.all([
    KPApi.getBranches(),
    KPApi.getServices(),
  ]).then(([branches, services]) => {
    branchSelect.innerHTML = [
      '<option value="">Select a branch</option>',
      ...branches.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`),
    ].join('');

    serviceSelect.innerHTML = [
      '<option value="">Not sure / general consultation</option>',
      ...services.map((service) => `<option value="${service.id}">${escapeHtml(service.title)}</option>`),
    ].join('');

    if (requestedServiceId && services.some((service) => String(service.id) === String(requestedServiceId))) {
      serviceSelect.value = String(requestedServiceId);
    }
  }).catch((error) => {
    setFormMessage(messageBox, error.message || 'Unable to load appointment options.', 'error');
  });

  branchSelect.addEventListener('change', async () => {
    const branchId = branchSelect.value;
    if (!branchId) {
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
      return;
    }

    doctorSelect.disabled = true;
    doctorSelect.innerHTML = '<option value="">Loading doctors…</option>';

    try {
      const doctors = await KPApi.getDoctors({ branch: branchId });
      doctorSelect.innerHTML = [
        '<option value="">Any available doctor</option>',
        ...doctors.map((doctor) => `<option value="${doctor.id}">${escapeHtml(doctor.name)}</option>`),
      ].join('');
      doctorSelect.disabled = false;
    } catch (error) {
      doctorSelect.innerHTML = '<option value="">Could not load doctors</option>';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormMessage(messageBox, '');

    const payload = {
      branch_id: Number(form.branch_id.value) || null,
      doctor_id: form.doctor_id.value ? Number(form.doctor_id.value) : null,
      service_id: form.service_id.value ? Number(form.service_id.value) : null,
      patient_name: form.patient_name.value.trim(),
      phone: form.phone.value.trim(),
      ic_number: form.ic_number?.value.trim() || null,
      preferred_date: form.preferred_date.value,
      preferred_time: form.preferred_time.value,
      reason: form.reason?.value.trim() || null,
    };

    if (!payload.branch_id || !payload.patient_name || !payload.phone || !payload.preferred_date || !payload.preferred_time) {
      setFormMessage(messageBox, 'Please fill in all required fields (*).', 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    try {
      const response = await KPApi.createBooking(payload);
      setFormMessage(
        messageBox,
        `${response.message} Reference: ${response.reference}`,
        'success'
      );
      form.reset();
      doctorSelect.disabled = true;
      doctorSelect.innerHTML = '<option value="">Please select branch first</option>';
    } catch (error) {
      setFormMessage(messageBox, error.message || 'Unable to send appointment request.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Request appointment';
    }
  });
}

function setFormMessage(element, message, type = '') {
  if (!element) return;
  element.textContent = message || '';
  element.className = `kp-form-message${type ? ` ${type}` : ''}`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}
