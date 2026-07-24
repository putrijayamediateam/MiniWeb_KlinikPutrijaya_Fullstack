'use strict';

// Public Services page.
// Every service card deliberately uses that service record's own
// hero_image_url, which is also used on its service detail page.

document.addEventListener('DOMContentLoaded', initServicesPage);

let allServices = [];

async function initServicesPage() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  try {
    const response = await KPApi.getServices();
    allServices = Array.isArray(response) ? response : [];
    populateCategoryFilter(allServices);
    renderServices(allServices);
  } catch (error) {
    grid.innerHTML = `
      <div class="services-empty error">
        Could not load services. Please confirm the backend is running on port 4000.
      </div>
    `;
  }

  document.getElementById('serviceSearch')?.addEventListener('input', applyFilters);
  document.getElementById('serviceCategory')?.addEventListener('change', applyFilters);
}

function populateCategoryFilter(services) {
  const select = document.getElementById('serviceCategory');
  if (!select) return;

  const categories = [...new Set(
    services
      .map((service) => String(service.category_key || '').trim())
      .filter(Boolean)
  )].sort((a, b) => formatCategory(a).localeCompare(formatCategory(b)));

  select.innerHTML = [
    '<option value="">All categories</option>',
    ...categories.map((category) => (
      `<option value="${escapeAttribute(category)}">${escapeHtml(formatCategory(category))}</option>`
    )),
  ].join('');
}

function applyFilters() {
  const query = document.getElementById('serviceSearch')?.value.trim().toLowerCase() || '';
  const category = document.getElementById('serviceCategory')?.value || '';

  const filtered = allServices.filter((service) => {
    const matchesCategory = !category || service.category_key === category;
    const searchable = [
      service.title,
      service.kicker,
      service.description,
      service.category_key,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return matchesCategory && (!query || searchable.includes(query));
  });

  renderServices(filtered);
}

function renderServices(services) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  if (!services.length) {
    grid.innerHTML = '<div class="services-empty">No services match your search.</div>';
    return;
  }

  grid.innerHTML = services.map((service) => {
    const heroImage = resolveImageUrl(service.hero_image_url);
    const price = service.starting_price == null
      ? 'View price list'
      : `From ${formatMoney(service.starting_price)}`;

    const media = heroImage
      ? `
        <div class="service-card-media">
          <img
            src="${escapeAttribute(heroImage)}"
            alt="${escapeAttribute(`${service.title} at Klinik Putrijaya`)}"
            loading="lazy"
            data-service-card-image
          >
          <span class="service-category">${escapeHtml(formatCategory(service.category_key))}</span>
        </div>
      `
      : `
        <div class="service-card-media placeholder">
          <span class="service-category">${escapeHtml(formatCategory(service.category_key))}</span>
        </div>
      `;

    return `
      <article class="service-card">
        <a
          class="service-card-link"
          href="service-detail.html?slug=${encodeURIComponent(service.slug)}"
          aria-label="View ${escapeAttribute(service.title)} service details"
        >
          ${media}

          <div class="service-card-body">
            ${service.kicker ? `<p class="service-kicker">${escapeHtml(service.kicker)}</p>` : ''}
            <h3>${escapeHtml(service.title)}</h3>
            <p class="service-card-description">
              ${escapeHtml(service.description || 'View detailed information about this service.')}
            </p>

            <div class="service-card-footer">
              <span class="service-price">${escapeHtml(price)}</span>
              <span class="service-more">View details →</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('');

  installCardImageFallbacks();
}

function installCardImageFallbacks() {
  document.querySelectorAll('[data-service-card-image]').forEach((image) => {
    image.addEventListener('error', () => {
      const media = image.closest('.service-card-media');
      media?.classList.add('placeholder');
      image.remove();
    }, { once: true });
  });
}

function resolveImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  try {
    const backendOrigin = new URL(KPApi.baseUrl).origin;
    return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
  } catch (error) {
    return url;
  }
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
