'use strict';

document.addEventListener('DOMContentLoaded', initServicesPage);

let allServices = [];

async function initServicesPage() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  try {
    allServices = await KPApi.getServices();
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
    services.map((service) => service.category_key).filter(Boolean)
  )].sort();

  select.innerHTML = [
    '<option value="">All categories</option>',
    ...categories.map((category) => (
      `<option value="${escapeHtml(category)}">${escapeHtml(formatCategory(category))}</option>`
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
    ].filter(Boolean).join(' ').toLowerCase();

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
    const imageUrl = resolveImageUrl(service.hero_image_url);
    const price = service.starting_price == null
      ? 'View price list'
      : `From ${formatMoney(service.starting_price)}`;

    return `
      <article class="service-card">
        <a class="service-card-link" href="service-detail.html?slug=${encodeURIComponent(service.slug)}">
          <div class="service-card-media ${imageUrl ? '' : 'placeholder'}"
               ${imageUrl ? `style="background-image:url('${escapeAttribute(imageUrl)}')"` : ''}>
            <span class="service-category">${escapeHtml(formatCategory(service.category_key))}</span>
          </div>

          <div class="service-card-body">
            ${service.kicker ? `<p class="service-kicker">${escapeHtml(service.kicker)}</p>` : ''}
            <h3>${escapeHtml(service.title)}</h3>
            <p>${escapeHtml(service.description || 'View detailed information about this service.')}</p>

            <div class="service-card-footer">
              <span class="service-price">${escapeHtml(price)}</span>
              <span class="service-more">View details →</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('');
}

function resolveImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const backendOrigin = new URL(KPApi.baseUrl).origin;
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
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
