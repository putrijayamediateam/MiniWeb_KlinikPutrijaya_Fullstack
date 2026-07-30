'use strict';

document.addEventListener(
  'DOMContentLoaded',
  initServiceDetailV2
);

async function initServiceDetailV2() {
  const root = document.getElementById(
    'serviceDetailRoot'
  );

  const slug = new URLSearchParams(
    window.location.search
  ).get('slug');

  if (!root) {
    return;
  }

  if (!slug) {
    renderServiceError(
      root,
      'No service was selected.'
    );

    return;
  }

  try {
    const [
      service,
      catalogueResponse,
    ] = await Promise.all([
      KPApi.getServiceCatalogBySlug(slug),
      KPApi.getServiceCatalog(),
    ]);

    const catalogue = Array.isArray(
      catalogueResponse
    )
      ? catalogueResponse
      : [];

    const relatedServices = catalogue
      .filter(
        (item) =>
          Number(item.id) !==
            Number(service.id) &&
          Number(item.category_id) ===
            Number(service.category_id)
      )
      .slice(0, 3);

    updateServiceMetadata(service);

    renderServiceDetail(
      root,
      service,
      relatedServices
    );

    initServiceHeroFallback();
    initServiceLightbox();
  } catch (error) {
    console.error(
      'Unable to load service detail:',
      error
    );

    renderServiceError(
      root,
      error.status === 404
        ? 'This service is not currently available.'
        : 'The service information could not be loaded. Please confirm that the backend is running.'
    );
  }
}

function updateServiceMetadata(service) {
  document.title =
    `${service.title} | Klinik Putrijaya`;

  const descriptionMeta =
    document.querySelector(
      'meta[name="description"]'
    );

  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      'content',
      service.description ||
        `Learn more about ${service.title} at Klinik Putrijaya.`
    );
  }
}

function renderServiceDetail(
  root,
  service,
  relatedServices
) {
  const branches = Array.isArray(
    service.branches
  )
    ? service.branches
    : [];

  const gallery = Array.isArray(
    service.gallery
  )
    ? service.gallery
    : [];

  const heroImage = resolveImageUrl(
    service.hero_image_url
  );

  root.innerHTML = `
    <section
      class="service-v2-hero"
      aria-labelledby="servicePageTitle"
    >
      <div class="wrap">
        <nav
          class="service-breadcrumb"
          aria-label="Breadcrumb"
        >
          <a href="services.html">
            Services
          </a>

          <span aria-hidden="true">
            /
          </span>

          <span>
            ${escapeHtml(
              service.category_name ||
                'Healthcare Services'
            )}
          </span>

          <span aria-hidden="true">
            /
          </span>

          <span>
            ${escapeHtml(
              service.subcategory_name ||
                service.title
            )}
          </span>
        </nav>

        <div class="service-v2-hero-grid">
          <div class="service-v2-hero-content">
            ${
              service.kicker
                ? `
                    <div class="service-v2-kicker">
                      ${escapeHtml(
                        service.kicker
                      )}
                    </div>
                  `
                : ''
            }

            <h1 id="servicePageTitle">
              ${escapeHtml(service.title)}
            </h1>

            <p class="service-v2-hero-description">
              ${escapeHtml(
                service.description ||
                  'Learn more about this Klinik Putrijaya service.'
              )}
            </p>

            <div class="service-v2-summary">
              ${
                service.result_time
                  ? `
                      <div class="service-summary-item">
                        <small>
                          Result time
                        </small>

                        <strong>
                          ${escapeHtml(
                            service.result_time
                          )}
                        </strong>
                      </div>
                    `
                  : ''
              }

              <div class="service-summary-item">
                <small>
                  Service category
                </small>

                <strong>
                  ${escapeHtml(
                    service.subcategory_name ||
                      service.category_name ||
                      'General healthcare'
                  )}
                </strong>
              </div>

              <div class="service-summary-item">
                <small>
                  Available at
                </small>

                <strong>
                  ${branches.length}
                  ${
                    branches.length === 1
                      ? 'branch'
                      : 'branches'
                  }
                </strong>
              </div>
            </div>

            <div class="service-v2-hero-actions">
              <a
                class="btn-primary"
                href="appointment.html?service_id=${encodeURIComponent(
                  service.id
                )}"
              >
                Request appointment
              </a>
            </div>
          </div>

          <div
            class="service-v2-hero-media ${
              heroImage
                ? ''
                : 'is-placeholder'
            }"
          >
            ${
              heroImage
                ? `
                    <img
                      src="${escapeAttribute(
                        heroImage
                      )}"
                      alt="${escapeAttribute(
                        `${service.title} at Klinik Putrijaya`
                      )}"
                      data-service-detail-hero
                    >
                  `
                : `
                    <div
                      class="service-v2-hero-placeholder"
                      aria-hidden="true"
                    >
                      <span>KP</span>

                      <small>
                        Klinik Putrijaya
                      </small>
                    </div>
                  `
            }

            ${
              Number(service.is_featured)
                ? `
                    <span class="service-detail-featured">
                      Featured service
                    </span>
                  `
                : ''
            }
          </div>
        </div>
      </div>
    </section>

    <section class="service-v2-main">
      <div class="wrap service-v2-layout">
        <div class="service-v2-content">
          ${renderContentSection(
            'About this service',
            service.full_description,
            false,
            'Service overview'
          )}

          <div class="service-v2-information-grid">
            ${renderContentSection(
              'Suitable for',
              service.suitable_for,
              true,
              'Who may benefit'
            )}

            ${renderContentSection(
              'What is included',
              service.included_items,
              true,
              'During your visit'
            )}
          </div>

          <div class="service-v2-information-grid">
            ${renderContentSection(
              'Preparation',
              service.preparation,
              true,
              'Before your visit'
            )}

            ${renderContentSection(
              'Aftercare',
              service.aftercare,
              true,
              'After your visit'
            )}
          </div>

          ${
            gallery.length
              ? renderGallerySection(gallery)
              : ''
          }
        </div>

        <aside class="service-v2-sidebar">
          <section class="service-branch-card">
            <div class="eyebrow">
              Available locations
            </div>

            <h2>
              Choose your preferred branch
            </h2>

            <p>
              Contact the branch directly for
              appointment availability and further
              service information.
            </p>

            <div class="service-branch-list">
              ${
                branches.length
                  ? branches
                      .map(
                        (branch) =>
                          renderBranchCard(
                            branch,
                            service
                          )
                      )
                      .join('')
                  : `
                      <div class="service-branch-empty">
                        Please contact Klinik Putrijaya
                        to confirm branch availability.
                      </div>
                    `
              }
            </div>
          </section>

          <a
            class="service-sidebar-back"
            href="services.html"
          >
            ← Browse other services
          </a>
        </aside>
      </div>
    </section>

    ${
      relatedServices.length
        ? renderRelatedServices(
            relatedServices
          )
        : ''
    }
  `;
}

function renderContentSection(
  title,
  content,
  asList,
  eyebrow
) {
  if (!content) {
    return '';
  }

  return `
    <section class="service-v2-info-card">
      <div class="eyebrow">
        ${escapeHtml(eyebrow)}
      </div>

      <h2>
        ${escapeHtml(title)}
      </h2>

      ${
        asList
          ? renderServiceLines(content)
          : renderServiceParagraphs(content)
      }
    </section>
  `;
}

function renderServiceParagraphs(content) {
  return String(content)
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        paragraph.trim()
    )
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p>
          ${escapeHtml(
            paragraph
          ).replaceAll('\n', '<br>')}
        </p>
      `
    )
    .join('');
}

function renderServiceLines(content) {
  const lines = String(content)
    .split('\n')
    .map((line) =>
      line
        .replace(/^[-•*]\s*/, '')
        .trim()
    )
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  return `
    <ul class="service-v2-list">
      ${lines
        .map(
          (line) => `
            <li>
              <span aria-hidden="true">
                ✓
              </span>

              <p>
                ${escapeHtml(line)}
              </p>
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

function renderBranchCard(
  branch,
  service
) {
  const branchName = formatBranchName(
    branch.name
  );

  const whatsappLink =
  buildServiceWhatsAppLink(
    branch,
    service
  );

  const phone = String(
    branch.phone || ''
  ).trim();

  const phoneLink = phone
    ? `tel:${phone.replace(
        /[^\d+]/g,
        ''
      )}`
    : '';

  const appointmentLink =
    `appointment.html?service_id=${encodeURIComponent(
      service.id
    )}&branch_id=${encodeURIComponent(
      branch.id
    )}`;

  return `
    <article
  class="service-branch-item"
  data-branch-id="${Number(
    branch.id
  )}"
  data-service-id="${Number(
    service.id
  )}"
>
      <div class="service-branch-item-heading">
        <div>
          <small>
            Klinik Putrijaya
          </small>

          <h3>
            ${escapeHtml(branchName)}
          </h3>
        </div>

        <span aria-hidden="true">
          KP
        </span>
      </div>

      ${
        branch.address
          ? `
              <p class="service-branch-address">
                ${escapeHtml(
                  branch.address
                )}
              </p>
            `
          : ''
      }

      ${
        phone
          ? `
              <a
                class="service-branch-phone"
                href="${escapeAttribute(
                  phoneLink
                )}"
              >
                ${escapeHtml(phone)}
              </a>
            `
          : ''
      }

      <div class="service-branch-actions">
        ${
          whatsappLink
            ? `
                <a
  class="service-whatsapp-button"
  href="${escapeAttribute(
    whatsappLink
  )}"
  target="_blank"
  rel="noopener"
  aria-label="WhatsApp Klinik Putrijaya ${escapeAttribute(
    branchName
  )}"
  title="WhatsApp ${escapeAttribute(
    branchName
  )}"
>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2 22l5.2-1.57A9.9 9.9 0 1 0 12.04 2Zm0 17.98a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.09.93.96-3-.2-.31a8.06 8.06 0 1 1 6.76 3.69Zm4.43-6.06c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.2.87 2.35.99 2.51.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.59 1.63-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.47-.28Z"
    />
  </svg>
</a>
              `
            : ''
        }

        <a
          class="service-appointment-button"
          href="${appointmentLink}"
        >
          Book here
        </a>
      </div>
    </article>
  `;
}

function renderGallerySection(gallery) {
  return `
    <section class="service-v2-info-card">
      <div class="service-v2-section-heading">
        <div>
          <div class="eyebrow">
            Inside the service
          </div>

          <h2>
            Gallery
          </h2>
        </div>

        <p>
          Select an image to view it in full size.
        </p>
      </div>

      <div class="service-v2-gallery">
        ${gallery
          .map(
            (image, index) =>
              renderGalleryItem(
                image,
                index
              )
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderGalleryItem(
  image,
  index
) {
  const url = resolveImageUrl(
    image.image_url
  );

  const alt =
    image.alt_text ||
    image.caption ||
    'Klinik Putrijaya service gallery image';

  return `
    <button
      class="service-v2-gallery-item"
      type="button"
      data-gallery-index="${index}"
      data-gallery-url="${escapeAttribute(
        url
      )}"
      data-gallery-caption="${escapeAttribute(
        image.caption || ''
      )}"
      data-gallery-alt="${escapeAttribute(
        alt
      )}"
    >
      <img
        src="${escapeAttribute(url)}"
        alt="${escapeAttribute(alt)}"
        loading="lazy"
      >

      ${
        image.caption
          ? `
              <span>
                ${escapeHtml(
                  image.caption
                )}
              </span>
            `
          : ''
      }
    </button>
  `;
}

function renderRelatedServices(
  services
) {
  return `
    <section
      class="service-related-section"
      aria-labelledby="relatedServicesTitle"
    >
      <div class="wrap">
        <div class="service-related-heading">
          <div>
            <div class="eyebrow">
              Continue exploring
            </div>

            <h2 id="relatedServicesTitle">
              Related services
            </h2>
          </div>

          <a href="services.html">
            View all services →
          </a>
        </div>

        <div class="service-related-grid">
          ${services
            .map(
              (service) =>
                renderRelatedServiceCard(
                  service
                )
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderRelatedServiceCard(
  service
) {
  const heroImage = resolveImageUrl(
    service.hero_image_url
  );

  return `
    <article class="service-related-card">
      <a
        href="service-detail.html?slug=${encodeURIComponent(
          service.slug
        )}"
      >
        <div
          class="service-related-media ${
            heroImage
              ? ''
              : 'is-placeholder'
          }"
        >
          ${
            heroImage
              ? `
                  <img
                    src="${escapeAttribute(
                      heroImage
                    )}"
                    alt="${escapeAttribute(
                      service.title
                    )}"
                    loading="lazy"
                  >
                `
              : `
                  <span aria-hidden="true">
                    KP
                  </span>
                `
          }
        </div>

        <div class="service-related-body">
          <small>
            ${escapeHtml(
              service.subcategory_name ||
                service.category_name ||
                'Healthcare service'
            )}
          </small>

          <h3>
            ${escapeHtml(service.title)}
          </h3>

          <p>
            ${escapeHtml(
              service.description ||
                'Explore this Klinik Putrijaya service.'
            )}
          </p>

          <strong>
            View service →
          </strong>
        </div>
      </a>
    </article>
  `;
}

function initServiceHeroFallback() {
  const image = document.querySelector(
    '[data-service-detail-hero]'
  );

  if (!image) {
    return;
  }

  image.addEventListener(
    'error',
    () => {
      const media = image.closest(
        '.service-v2-hero-media'
      );

      if (!media) {
        return;
      }

      media.classList.add(
        'is-placeholder'
      );

      image.remove();

      media.insertAdjacentHTML(
        'afterbegin',
        `
          <div
            class="service-v2-hero-placeholder"
            aria-hidden="true"
          >
            <span>KP</span>

            <small>
              Klinik Putrijaya
            </small>
          </div>
        `
      );
    },
    { once: true }
  );
}

function initServiceLightbox() {
  const lightbox =
    document.getElementById(
      'serviceLightbox'
    );

  const image =
    document.getElementById(
      'lightboxImage'
    );

  const caption =
    document.getElementById(
      'lightboxCaption'
    );

  const closeButton =
    lightbox?.querySelector(
      '.lightbox-close'
    );

  if (
    !lightbox ||
    !image ||
    !caption
  ) {
    return;
  }

  document
    .querySelectorAll(
      '.service-v2-gallery-item'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          image.src =
            button.dataset.galleryUrl;

          image.alt =
            button.dataset.galleryAlt ||
            '';

          caption.textContent =
            button.dataset
              .galleryCaption || '';

          lightbox.classList.add(
            'is-open'
          );

          lightbox.setAttribute(
            'aria-hidden',
            'false'
          );

          document.body.classList.add(
            'service-lightbox-open'
          );

          closeButton?.focus();
        }
      );
    });

  function closeLightbox() {
    lightbox.classList.remove(
      'is-open'
    );

    lightbox.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.classList.remove(
      'service-lightbox-open'
    );

    image.src = '';
    image.alt = '';
    caption.textContent = '';
  }

  closeButton?.addEventListener(
    'click',
    closeLightbox
  );

  lightbox.addEventListener(
    'click',
    (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape' &&
        lightbox.classList.contains(
          'is-open'
        )
      ) {
        closeLightbox();
      }
    }
  );
}

function renderServiceError(
  root,
  message
) {
  root.innerHTML = `
    <section class="service-detail-error">
      <div class="wrap">
        <div class="service-error-card">
          <div class="eyebrow">
            Service unavailable
          </div>

          <h1>
            We could not display this service
          </h1>

          <p>
            ${escapeHtml(message)}
          </p>

          <a
            class="btn-primary"
            href="services.html"
          >
            Back to services
          </a>
        </div>
      </div>
    </section>
  `;
}

function buildServiceWhatsAppLink(
  branch,
  service
) {
  const branchName = String(
    branch.name ||
      'Klinik Putrijaya'
  ).trim();

  const serviceTitle = String(
    service.title ||
      'servis klinik'
  ).trim();

  const message =
    `Hi ${branchName}, saya berminat untuk mendapatkan maklumat lanjut mengenai servis ${serviceTitle}. Boleh bantu saya?`;

  let phoneNumber = String(
    branch.phone || ''
  ).replace(/\D/g, '');

  /*
    Tukar nombor Malaysia:

    0193870448
    menjadi
    60193870448
  */
  if (phoneNumber.startsWith('0')) {
    phoneNumber =
      `6${phoneNumber}`;
  }

  if (phoneNumber) {
    return (
      `https://wa.me/${phoneNumber}` +
      `?text=${encodeURIComponent(message)}`
    );
  }

  /*
    Fallback jika nombor telefon
    tiada dalam database.
  */
  return String(
    branch.whatsapp_link || ''
  ).trim();
}

function formatBranchName(value) {
  return String(value || '')
    .replace(
      /^Klinik Putrijaya\s*/i,
      ''
    )
    .trim();
}

function resolveImageUrl(url) {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    const backendOrigin =
      new URL(KPApi.baseUrl).origin;

    return `${backendOrigin}${
      url.startsWith('/') ? '' : '/'
    }${url}`;
  } catch (error) {
    return url;
  }
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

function escapeAttribute(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}