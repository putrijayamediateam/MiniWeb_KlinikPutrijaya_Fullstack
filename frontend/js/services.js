const DEFAULT_SERVICE_META = {
  women: {
    kicker: 'Women’s Health',
    title: 'Women’s & Maternity Care',
    description: 'Dedicated services for women, pregnancy care and reproductive health support.',
  },
  general: {
    kicker: 'General Care',
    title: 'Family & General Medicine',
    description: 'Everyday healthcare services for children, adults and families.',
  },
  treatment: {
    kicker: 'Treatments',
    title: 'Procedures & Minor Care',
    description: 'Clinic-based treatment and minor procedures delivered by the medical team.',
  },
  special: {
    kicker: 'Special Services',
    title: 'Wellness & Certification',
    description: 'Special healthcare support for wellness, travel, certification and selected programmes.',
  },
};

const CATEGORY_ORDER = ['women', 'general', 'treatment', 'special'];

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('serviceModal');
  if (!modal) return;

  const kicker = document.getElementById('serviceModalKicker');
  const title = document.getElementById('serviceModalTitle');
  const description = document.getElementById('serviceModalDesc');
  const list = document.getElementById('serviceModalList');
  const servicesGrid = document.querySelector('.services-grid');
  let lastTrigger = null;
  let serviceCatalog = [];

  function renderServiceCards(services) {
    const grouped = services.reduce((acc, service) => {
      const category = service.category_key || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {});

    const categories = [
      ...CATEGORY_ORDER.filter((category) => grouped[category] || DEFAULT_SERVICE_META[category]),
      ...Object.keys(grouped).filter((category) => !CATEGORY_ORDER.includes(category)),
    ];

    if (!servicesGrid) return;

    servicesGrid.innerHTML = categories.map((category) => {
      const entries = grouped[category] || [];
      const primary = entries[0] || null;
      const meta = DEFAULT_SERVICE_META[category] || {};
      const cardKicker = primary?.kicker || meta.kicker || 'Service';
      const cardTitle = primary?.title || meta.title || 'Service';
      const cardDesc = primary?.description || meta.description || 'Service details coming soon.';

      return `
        <button class="service-card" type="button" data-service="${category}">
          <span class="service-kicker">${KPUtils.escapeHtml(cardKicker)}</span>
          <h2>${KPUtils.escapeHtml(cardTitle)}</h2>
          <p>${KPUtils.escapeHtml(cardDesc)}</p>
          <span class="service-more">View services →</span>
        </button>
      `;
    }).join('');

    servicesGrid.querySelectorAll('[data-service]').forEach((card) => {
      card.addEventListener('click', () => openModal(card.dataset.service, card));
    });
  }

  function openModal(type, trigger) {
    const data = serviceCatalog.filter((service) => (service.category_key || 'general') === type);
    if (!data.length) return;

    const meta = DEFAULT_SERVICE_META[type] || {};
    const primary = data[0] || {};

    lastTrigger = trigger;
    kicker.textContent = primary.kicker || meta.kicker || 'Service';
    title.textContent = primary.title || meta.title || 'Service';
    description.textContent = primary.description || meta.description || '';
    list.innerHTML = data.map((service) => `
      <div class="service-modal-item">
        <strong>${KPUtils.escapeHtml(service.title || 'Service')}</strong>
        ${service.description ? `<p>${KPUtils.escapeHtml(service.description)}</p>` : ''}
      </div>
    `).join('');

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('service-modal-open');
    modal.querySelector('.modal-close')?.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('service-modal-open');
    lastTrigger?.focus();
  }

  document.querySelectorAll('[data-close-service-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  try {
    const services = await KPApi.getServices();
    serviceCatalog = (services || []).filter((service) => service.is_active !== false);
    renderServiceCards(serviceCatalog);
  } catch (err) {
    console.error('Failed to load services:', err);
    renderServiceCards([]);
  }
});
