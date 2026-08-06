'use strict';

document.addEventListener(
  'DOMContentLoaded',
  initServicesV2Page
);

const serviceState = {
  categories: [],
  subcategories: [],
  services: [],
  selectedCategoryId: null,
  selectedSubcategoryId: null,
  query: '',
};

async function initServicesV2Page() {
  const categoryContainer =
    document.getElementById(
      'serviceCategoryCards'
    );

  const servicesGrid =
    document.getElementById('servicesGrid');

  if (!categoryContainer || !servicesGrid) {
    return;
  }

  bindServicePageEvents();

  try {
    const [
      categoriesResponse,
      subcategoriesResponse,
      servicesResponse,
    ] = await Promise.all([
      KPApi.getServiceCategories(),
      KPApi.getServiceSubcategories(),
      KPApi.getServiceCatalog(),
    ]);

    serviceState.categories =
      Array.isArray(categoriesResponse)
        ? categoriesResponse.filter(
            (category) =>
              Number(category.is_active) === 1
          )
        : [];

    serviceState.subcategories =
      Array.isArray(subcategoriesResponse)
        ? subcategoriesResponse.filter(
            (subcategory) =>
              Number(subcategory.is_active) === 1
          )
        : [];

    serviceState.services =
      Array.isArray(servicesResponse)
        ? servicesResponse.filter(
            (service) =>
              Number(service.is_active) === 1
          )
        : [];

    serviceState.selectedCategoryId =
      getInitialCategoryId();

    renderServicesV2Page();
  } catch (error) {
    console.error(
      'Unable to load Services V2:',
      error
    );

    categoryContainer.innerHTML = `
      <div class="services-empty error">
        Service categories could not be loaded.
        Please confirm the backend is running.
      </div>
    `;

    servicesGrid.innerHTML = `
      <div class="services-empty error">
        The service catalogue is temporarily
        unavailable.
      </div>
    `;

    setText(
      'serviceCount',
      'Unable to load services'
    );
  }
}

function bindServicePageEvents() {
  document
    .getElementById('serviceCategoryCards')
    ?.addEventListener('click', (event) => {
      const button = event.target.closest(
        '[data-category-id]'
      );

      if (!button) {
        return;
      }

      const categoryId = Number(
        button.dataset.categoryId
      );

      if (!Number.isInteger(categoryId)) {
        return;
      }

      serviceState.selectedCategoryId =
        categoryId;

      serviceState.selectedSubcategoryId =
        null;

        updateSelectedCategoryUrl(
  categoryId
);

      renderServicesV2Page();

      document
        .getElementById(
          'selectedServiceCategoryTitle'
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    });

  document
    .getElementById(
      'serviceSubcategories'
    )
    ?.addEventListener('click', (event) => {
      const button = event.target.closest(
        '[data-subcategory-id]'
      );

      if (!button) {
        return;
      }

      const value =
        button.dataset.subcategoryId;

      serviceState.selectedSubcategoryId =
        value === ''
          ? null
          : Number(value);

      renderSubcategoryFilters();
      applyServiceFilters();
    });

  document
    .getElementById('serviceSearch')
    ?.addEventListener('input', (event) => {
      serviceState.query =
        String(event.target.value || '')
          .trim()
          .toLowerCase();

      applyServiceFilters();
    });

  document
    .getElementById(
      'clearServiceFilters'
    )
    ?.addEventListener('click', () => {
      clearServiceFilters();
    });

  document
    .getElementById('servicesGrid')
    ?.addEventListener('click', (event) => {
      const resetButton = event.target.closest(
        '[data-reset-service-filters]'
      );

      if (!resetButton) {
        return;
      }

      clearServiceFilters();
    });
}

function getInitialCategoryId() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const requestedCategorySlug =
    String(
      params.get('category') || ''
    )
      .trim()
      .toLowerCase();

  if (requestedCategorySlug) {
    const matchedCategory =
      serviceState.categories.find(
        (category) =>
          String(category.slug || '')
            .trim()
            .toLowerCase() ===
          requestedCategorySlug
      );

    if (matchedCategory) {
      return Number(
        matchedCategory.id
      );
    }
  }

  const firstService =
    serviceState.services[0];

  if (
    firstService &&
    Number(firstService.category_id)
  ) {
    return Number(
      firstService.category_id
    );
  }

  const firstCategory =
    serviceState.categories[0];

  return firstCategory
    ? Number(firstCategory.id)
    : null;
}

function updateSelectedCategoryUrl(
  categoryId
) {
  const category =
    serviceState.categories.find(
      (item) =>
        Number(item.id) ===
        Number(categoryId)
    );

  const url =
    new URL(
      window.location.href
    );

  if (category?.slug) {
    url.searchParams.set(
      'category',
      category.slug
    );
  } else {
    url.searchParams.delete(
      'category'
    );
  }

  window.history.replaceState(
    {},
    '',
    url
  );
}

function renderServicesV2Page() {
  renderCategoryCards();
  renderSelectedCategory();
  renderSubcategoryFilters();
  applyServiceFilters();
}

function renderCategoryCards() {
  const container =
    document.getElementById(
      'serviceCategoryCards'
    );

  if (!container) {
    return;
  }

  if (!serviceState.categories.length) {
    container.innerHTML = `
      <div class="services-empty">
        No service categories are currently
        available.
      </div>
    `;

    return;
  }

  container.innerHTML =
    serviceState.categories
      .map((category, index) => {
        const categoryId =
          Number(category.id);

        const serviceCount =
          getCategoryServiceCount(
            categoryId
          );

        const isSelected =
          categoryId ===
          Number(
            serviceState.selectedCategoryId
          );

        return `
  <button
    class="service-category-pill ${
      isSelected
        ? 'is-active'
        : ''
    }"
    type="button"
    data-category-id="${categoryId}"
    data-category-slug="${escapeAttribute(
      category.slug
    )}"
    aria-pressed="${
      isSelected
        ? 'true'
        : 'false'
    }"
  >
    <span class="service-category-pill-label">
      ${escapeHtml(
        category.name
      )}
    </span>

    <span
      class="service-category-pill-count"
      aria-label="${serviceCount} services"
    >
      ${serviceCount}
    </span>
  </button>
`;
      })
      .join('');
}

function renderSelectedCategory() {
  const category =
    getSelectedCategory();

  if (!category) {
    setText(
      'selectedServiceCategoryTitle',
      'No category selected'
    );

    setText(
      'servicesCategoryDescription',
      'Choose a service category to continue.'
    );

    return;
  }

  setText(
    'servicesCategoryEyebrow',
    'Selected category'
  );

  setText(
    'selectedServiceCategoryTitle',
    category.name
  );

  setText(
    'servicesCategoryDescription',
    category.short_description ||
      'Explore the services available in this category.'
  );
}

function renderSubcategoryFilters() {
  const container =
    document.getElementById(
      'serviceSubcategories'
    );

  if (!container) {
    return;
  }

  const categoryId = Number(
    serviceState.selectedCategoryId
  );

  const subcategories =
    serviceState.subcategories.filter(
      (subcategory) =>
        Number(subcategory.category_id) ===
        categoryId
    );

  const allCount =
    getCategoryServiceCount(categoryId);

  const allIsActive =
    serviceState.selectedSubcategoryId ===
    null;

  const buttons = [
    `
      <button
        type="button"
        class="service-subcategory-button ${
          allIsActive ? 'is-active' : ''
        }"
        data-subcategory-id=""
        aria-pressed="${
          allIsActive ? 'true' : 'false'
        }"
      >
        <span>All services</span>
        <small>${allCount}</small>
      </button>
    `,
    ...subcategories.map(
      (subcategory) => {
        const subcategoryId =
          Number(subcategory.id);

        const isActive =
          subcategoryId ===
          Number(
            serviceState.selectedSubcategoryId
          );

        const count =
          getSubcategoryServiceCount(
            subcategoryId
          );

        return `
          <button
            type="button"
            class="service-subcategory-button ${
              isActive ? 'is-active' : ''
            }"
            data-subcategory-id="${subcategoryId}"
            aria-pressed="${
              isActive ? 'true' : 'false'
            }"
          >
            <span>
              ${escapeHtml(
                subcategory.name
              )}
            </span>

            <small>${count}</small>
          </button>
        `;
      }
    ),
  ];

  container.innerHTML =
    buttons.join('');
}

function applyServiceFilters() {
  const categoryId = Number(
    serviceState.selectedCategoryId
  );

  const subcategoryId =
    serviceState.selectedSubcategoryId;

  const query = serviceState.query;

  const filteredServices =
    serviceState.services.filter(
      (service) => {
        const matchesCategory =
          Number(service.category_id) ===
          categoryId;

        const matchesSubcategory =
          subcategoryId === null ||
          Number(service.subcategory_id) ===
            Number(subcategoryId);

        const searchableText = [
          service.title,
          service.kicker,
          service.description,
          service.keywords,
          service.result_time,
          service.category_name,
          service.subcategory_name,
          ...(Array.isArray(
            service.branches
          )
            ? service.branches.map(
                (branch) => branch.name
              )
            : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        return (
          matchesCategory &&
          matchesSubcategory &&
          matchesSearch
        );
      }
    );

  renderServiceCards(filteredServices);

  setText(
    'serviceCount',
    `${filteredServices.length} ${
      filteredServices.length === 1
        ? 'service'
        : 'services'
    } found`
  );
}

function renderServiceCards(services) {
  const grid =
    document.getElementById('servicesGrid');

  if (!grid) {
    return;
  }

  if (!services.length) {
    grid.innerHTML = `
      <div class="services-empty">
        <strong>
          No matching services found.
        </strong>

        <p>
          Try another subcategory or clear the
          current search.
        </p>

        <button
          type="button"
          class="services-empty-reset"
          data-reset-service-filters
        >
          Clear filters
        </button>
      </div>
    `;

    return;
  }

  grid.innerHTML = services
    .map((service) => {
      const heroImage =
        resolveImageUrl(
          service.hero_image_url
        );

      const branches =
        Array.isArray(service.branches)
          ? service.branches
          : [];

      const branchTags =
        branches.length
          ? branches
              .map(
                (branch) => `
                  <span class="service-branch-tag">
                    ${escapeHtml(
                      formatBranchName(
                        branch.name
                      )
                    )}
                  </span>
                `
              )
              .join('')
          : `
              <span class="service-branch-tag muted">
                Contact clinic for availability
              </span>
            `;

      const media = heroImage
        ? `
            <img
              src="${escapeAttribute(
                heroImage
              )}"
              alt="${escapeAttribute(
                `${service.title} at Klinik Putrijaya`
              )}"
              loading="lazy"
              data-service-card-image
            >
          `
        : `
            <div
              class="service-v2-placeholder-mark"
              aria-hidden="true"
            >
              KP
            </div>
          `;

      return `
        <article class="service-v2-card">
          <a
            class="service-v2-card-link"
            href="service-detail.html?slug=${encodeURIComponent(
              service.slug
            )}"
            aria-label="View ${escapeAttribute(
              service.title
            )} details"
          >
            <div
              class="service-v2-card-media ${
                heroImage
                  ? ''
                  : 'is-placeholder'
              }"
            >
              ${media}

              <div class="service-v2-card-badges">
                <span class="service-v2-category-badge">
                  ${escapeHtml(
                    service.subcategory_name ||
                      service.category_name
                  )}
                </span>

                ${
                  Number(service.is_featured)
                    ? `
                        <span class="service-featured-badge">
                          Featured
                        </span>
                      `
                    : ''
                }
              </div>
            </div>

            <div class="service-v2-card-body">
              ${
                service.kicker
                  ? `
                      <p class="service-v2-kicker">
                        ${escapeHtml(
                          service.kicker
                        )}
                      </p>
                    `
                  : ''
              }

              <h3>
                ${escapeHtml(service.title)}
              </h3>

              <p class="service-v2-description">
                ${escapeHtml(
                  service.description ||
                    'View more information about this Klinik Putrijaya service.'
                )}
              </p>

              <div class="service-v2-meta">
                ${
                  service.result_time
                    ? `
                        <span>
                          <small>Result time</small>
                          <strong>
                            ${escapeHtml(
                              service.result_time
                            )}
                          </strong>
                        </span>
                      `
                    : ''
                }

                <span>
                  <small>Availability</small>
                  <strong>
                    ${branches.length}
                    ${
                      branches.length === 1
                        ? 'branch'
                        : 'branches'
                    }
                  </strong>
                </span>
              </div>

              <div class="service-v2-branches">
                <small>Available at</small>

                <div>
                  ${branchTags}
                </div>
              </div>

              <div class="service-v2-card-footer">
                <span>View service</span>
                <span aria-hidden="true">
                  &rarr;
                </span>
              </div>
            </div>
          </a>
        </article>
      `;
    })
    .join('');

  installCardImageFallbacks();
}

function clearServiceFilters() {
  serviceState.selectedSubcategoryId =
    null;

  serviceState.query = '';

  const searchInput =
    document.getElementById(
      'serviceSearch'
    );

  if (searchInput) {
    searchInput.value = '';
  }

  renderSubcategoryFilters();
  applyServiceFilters();
}

function getSelectedCategory() {
  return (
    serviceState.categories.find(
      (category) =>
        Number(category.id) ===
        Number(
          serviceState.selectedCategoryId
        )
    ) || null
  );
}

function getCategoryServiceCount(
  categoryId
) {
  return serviceState.services.filter(
    (service) =>
      Number(service.category_id) ===
      Number(categoryId)
  ).length;
}

function getSubcategoryServiceCount(
  subcategoryId
) {
  return serviceState.services.filter(
    (service) =>
      Number(service.subcategory_id) ===
      Number(subcategoryId)
  ).length;
}

function installCardImageFallbacks() {
  document
    .querySelectorAll(
      '[data-service-card-image]'
    )
    .forEach((image) => {
      image.addEventListener(
        'error',
        () => {
          const media = image.closest(
            '.service-v2-card-media'
          );

          if (!media) {
            return;
          }

          media.classList.add(
            'is-placeholder'
          );

          media.insertAdjacentHTML(
            'afterbegin',
            `
              <div
                class="service-v2-placeholder-mark"
                aria-hidden="true"
              >
                KP
              </div>
            `
          );

          image.remove();
        },
        { once: true }
      );
    });
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

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value == null ? '' : String(value);
  }
}

function escapeHtml(value) {
  const div =
    document.createElement('div');

  div.textContent =
    value == null ? '' : String(value);

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