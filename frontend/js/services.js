// ============================================================
// Klinik Putrijaya - Public Services Page
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('serviceModal');
  const servicesGrid = document.querySelector('.services-grid');

  if (!modal || !servicesGrid) {
    return;
  }

  const modalKicker =
    document.getElementById('serviceModalKicker');

  const modalTitle =
    document.getElementById('serviceModalTitle');

  const modalDescription =
    document.getElementById('serviceModalDesc');

  const modalList =
    document.getElementById('serviceModalList');

  let serviceCatalog = [];
  let lastTrigger = null;

  function escapeHtml(value) {
    if (window.KPUtils?.escapeHtml) {
      return window.KPUtils.escapeHtml(value);
    }

    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);

    return element.innerHTML;
  }

  function getServiceDetails(service) {
    if (!service?.details) {
      return [];
    }

    return String(service.details)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function renderServiceCards(services) {
    servicesGrid.innerHTML = '';

    if (!services.length) {
      servicesGrid.innerHTML = `
        <div class="services-empty">
          No services are available right now.
        </div>
      `;

      return;
    }

    servicesGrid.innerHTML = services.map((service) => `
      <button
        class="service-card"
        type="button"
        data-service-id="${service.id}"
      >
        <span class="service-kicker">
          ${escapeHtml(service.kicker || 'Service')}
        </span>

        <h2>
          ${escapeHtml(service.title || 'Service')}
        </h2>

        <p>
          ${escapeHtml(
            service.description ||
            'View the available healthcare services.'
          )}
        </p>

        <span class="service-more">
          View services →
        </span>
      </button>
    `).join('');

    servicesGrid
      .querySelectorAll('[data-service-id]')
      .forEach((card) => {
        card.addEventListener('click', () => {
          openModal(card.dataset.serviceId, card);
        });
      });
  }

  function openModal(serviceId, trigger) {
    const service = serviceCatalog.find(
      (item) => String(item.id) === String(serviceId)
    );

    if (!service) {
      return;
    }

    const details = getServiceDetails(service);

    lastTrigger = trigger;

    modalKicker.textContent =
      service.kicker || 'Service';

    modalTitle.textContent =
      service.title || 'Service';

    modalDescription.textContent =
      service.description || '';

    if (details.length) {
      modalList.innerHTML = details.map((item) => `
        <div class="service-modal-item">
          ${escapeHtml(item)}
        </div>
      `).join('');
    } else {
      modalList.innerHTML = `
        <div class="service-modal-item">
          Service details will be updated soon.
        </div>
      `;
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.classList.add(
      'service-modal-open'
    );

    modal
      .querySelector('.modal-close')
      ?.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove(
      'service-modal-open'
    );

    lastTrigger?.focus();
  }

  document
    .querySelectorAll('[data-close-service-modal]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        closeModal
      );
    });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      modal.classList.contains('is-open')
    ) {
      closeModal();
    }
  });

  servicesGrid.innerHTML = `
    <div class="services-empty">
      Loading services…
    </div>
  `;

  try {
    const services =
      await KPApi.getServices();

    serviceCatalog =
      Array.isArray(services)
        ? services
        : [];

    renderServiceCards(serviceCatalog);
  } catch (error) {
    console.error(
      'Failed to load services:',
      error
    );

    serviceCatalog = [];

    servicesGrid.innerHTML = `
      <div class="services-empty">
        Unable to load services right now.
      </div>
    `;
  }
});