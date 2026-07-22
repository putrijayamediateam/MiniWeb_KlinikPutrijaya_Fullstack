'use strict';

document.addEventListener('DOMContentLoaded', initServiceDetail);

async function initServiceDetail() {
  const root = document.getElementById('serviceDetailRoot');
  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    renderError(root, 'No service was selected.');
    return;
  }

  try {
    const service = await KPApi.getServiceBySlug(slug);
    document.title = `${service.title} | Klinik Putrijaya`;
    renderService(root, service);
    initLightbox();
  } catch (error) {
    renderError(root, error.status === 404
      ? 'This service is not available.'
      : 'Could not load this service. Please confirm the backend is running.');
  }
}

function renderService(root, service) {
  const heroImage = resolveImageUrl(service.hero_image_url);
  const gallery = Array.isArray(service.gallery) ? service.gallery : [];
  const prices = Array.isArray(service.prices) ? service.prices : [];

  root.innerHTML = `
    <section class="service-detail-hero ${heroImage ? 'has-image' : ''}"
      ${heroImage ? `style="--service-hero:url('${escapeAttribute(heroImage)}')"` : ''}>
      <div class="service-detail-overlay"></div>
      <div class="wrap service-detail-hero-content">
        <a class="back-link" href="services.html">← All services</a>
        <p class="service-detail-kicker">${escapeHtml(service.kicker || formatCategory(service.category_key))}</p>
        <h1>${escapeHtml(service.title)}</h1>
        <p>${escapeHtml(service.description || '')}</p>
        <div class="service-detail-actions">
          <a class="btn-primary" href="appointment.html?service_id=${encodeURIComponent(service.id)}">Book appointment</a>
          <a class="btn-ghost" href="contact.html">Contact clinic</a>
        </div>
      </div>
    </section>

    <section class="service-detail-main">
      <div class="wrap service-detail-layout">
        <div class="service-detail-content">
          ${contentSection('About this service', service.full_description, false)}
          ${contentSection('Who this service may be suitable for', service.suitable_for, true)}
          ${contentSection('What is included', service.included_items, true)}
          ${contentSection('Preparation before your visit', service.preparation, true)}
          ${contentSection('Aftercare and follow-up', service.aftercare, true)}

          <section class="service-info-card service-pricing-section" id="prices">
            <div class="section-title-row">
              <div>
                <span class="eyebrow">Packages</span>
                <h2>Price list</h2>
              </div>
              <span class="price-note">Final charges may depend on clinical assessment.</span>
            </div>
            ${renderPrices(prices)}
          </section>

          ${gallery.length ? `
            <section class="service-info-card" id="gallery">
              <div class="section-title-row">
                <div>
                  <span class="eyebrow">Inside the service</span>
                  <h2>Gallery</h2>
                </div>
              </div>
              <div class="service-gallery-grid">
                ${gallery.map((image, index) => galleryItem(image, index)).join('')}
              </div>
            </section>
          ` : ''}
        </div>

        <aside class="service-detail-sidebar">
          <div class="service-booking-card">
            <p class="service-detail-kicker">Book a visit</p>
            <h2>${escapeHtml(service.title)}</h2>
            <p>Select your preferred branch, date and time through our appointment form.</p>
            <a class="btn-primary full" href="appointment.html?service_id=${encodeURIComponent(service.id)}">Request appointment</a>
            <a class="sidebar-link" href="services.html">Browse other services</a>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function contentSection(title, content, asList) {
  if (!content) return '';
  return `
    <section class="service-info-card">
      <h2>${escapeHtml(title)}</h2>
      ${asList ? renderLines(content) : renderParagraphs(content)}
    </section>
  `;
}

function renderParagraphs(content) {
  return String(content)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');
}

function renderLines(content) {
  const lines = String(content)
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  if (!lines.length) return '';
  return `<ul class="service-detail-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}

function renderPrices(prices) {
  if (!prices.length) {
    return `
      <div class="price-empty">
        Contact the selected branch for the latest approved price.
      </div>
    `;
  }

  return `
    <div class="price-list">
      ${prices.map((item) => `
        <article class="price-item">
          <div>
            <h3>${escapeHtml(item.package_name)}</h3>
            ${item.package_description ? `<p>${escapeHtml(item.package_description)}</p>` : ''}
          </div>
          <div class="price-value">
            ${item.original_price ? `<del>${formatMoney(item.original_price)}</del>` : ''}
            <strong>${formatMoney(item.price)}</strong>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function galleryItem(image, index) {
  const url = resolveImageUrl(image.image_url);
  return `
    <button class="service-gallery-item" type="button"
      data-gallery-index="${index}"
      data-gallery-url="${escapeAttribute(url)}"
      data-gallery-caption="${escapeAttribute(image.caption || '')}"
      data-gallery-alt="${escapeAttribute(image.alt_text || image.caption || 'Klinik Putrijaya service gallery image')}">
      <img src="${escapeAttribute(url)}" alt="${escapeAttribute(image.alt_text || image.caption || 'Klinik Putrijaya service gallery image')}">
      ${image.caption ? `<span>${escapeHtml(image.caption)}</span>` : ''}
    </button>
  `;
}

function initLightbox() {
  const lightbox = document.getElementById('serviceLightbox');
  const image = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  const closeButton = lightbox?.querySelector('.lightbox-close');

  if (!lightbox || !image || !caption) return;

  document.querySelectorAll('.service-gallery-item').forEach((button) => {
    button.addEventListener('click', () => {
      image.src = button.dataset.galleryUrl;
      image.alt = button.dataset.galleryAlt || '';
      caption.textContent = button.dataset.galleryCaption || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    });
  });

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    image.src = '';
  }

  closeButton?.addEventListener('click', close);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) close();
  });
}

function renderError(root, message) {
  root.innerHTML = `
    <section class="service-error">
      <div class="wrap">
        <h1>Service unavailable</h1>
        <p>${escapeHtml(message)}</p>
        <a class="btn-primary" href="services.html">Back to services</a>
      </div>
    </section>
  `;
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
