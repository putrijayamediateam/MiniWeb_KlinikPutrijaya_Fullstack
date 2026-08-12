// ============================================================
// Klinik Putrijaya - Shared header, footer and branch modal
// Header structure agreed:
// Home | About ▼ | Services | Community ▼ | Contact | Book a visit
// ============================================================

(() => {
  'use strict';

  const PAGE_FILE = window.location.pathname.split('/').pop() || 'index.html';

  function headerMarkup() {
  return `
    <header class="site-header">
      <nav class="wrap site-nav" aria-label="Main navigation">

        <a
          class="brand"
          href="index.html"
          aria-label="Klinik Putrijaya home"
        >
          <img
            src="images/logoklinik.png"
            alt="Klinik Putrijaya logo"
          >
        </a>

        <button
          class="nav-toggle"
          type="button"
          aria-label="Open navigation menu"
          aria-controls="primary-menu"
          aria-expanded="false"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div class="nav-menu" id="primary-menu">
          <ul class="nav-links">

            <li>
              <a
                data-page-link="index.html"
                href="index.html"
              >
                Home
              </a>
            </li>

            <li class="nav-dropdown">
              <button
                class="nav-dropdown-toggle"
                type="button"
                aria-expanded="false"
              >
                <span>About</span>
                <span
                  class="nav-chevron"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              <div class="nav-dropdown-menu">
                <a
                  data-page-link="about.html"
                  href="about.html"
                >
                  About Us
                </a>

                <a
                  data-page-link="branches.html"
                  href="branches.html"
                >
                  Our Branches
                </a>

                <a
                  data-page-link="doctors.html"
                  href="doctors.html"
                >
                  Resident Doctors
                </a>
              </div>
            </li>

            <li class="nav-dropdown nav-services-dropdown">
  <button
    class="nav-dropdown-toggle"
    type="button"
    aria-expanded="false"
  >
    <span>Services</span>

    <span
      class="nav-chevron"
      aria-hidden="true"
    >
      ▼
    </span>
  </button>

 <div class="nav-dropdown-menu nav-services-menu">
</div>
</li>

            <li>
              <a
                data-page-link="promotions.html"
                href="promotions.html"
              >
                Promotions
              </a>
            </li>

            <li class="nav-dropdown">
              <button
                class="nav-dropdown-toggle"
                type="button"
                aria-expanded="false"
              >
                <span>Community</span>
                <span
                  class="nav-chevron"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              <div class="nav-dropdown-menu">
                <a
                  data-page-link="activities.html"
                  href="activities.html"
                >
                  Activities &amp; CSR
                </a>

                <a
                  data-page-link="little-shield.html"
                  href="little-shield.html"
                >
                  Little Shield Programme
                </a>

                <a
                  data-page-link="feedback.html"
                  href="feedback.html"
                >
                  Patient Feedback
                </a>
              </div>
            </li>

          </ul>

          <button
            class="nav-cta branch-modal-trigger"
            type="button"
          >
            Contact Us
          </button>
        </div>
      </nav>
    </header>
  `;
}

async function hydrateServiceCategoryLinks() {
  const menu =
    document.querySelector(
      '.nav-services-menu'
    );

  if (!menu) {
    return;
  }

  try {
    const apiBase =
      window.KPApi?.baseUrl ||
      (
        ['localhost', '127.0.0.1']
          .includes(
            window.location.hostname
          )
          ? 'http://localhost:4000/api'
          : 'https://backend-production-d730.up.railway.app/api'
      );

    const response =
      await fetch(
        `${apiBase}/service-categories`
      );

    if (!response.ok) {
      throw new Error(
        'Unable to load service categories.'
      );
    }

    const categories =
      await response.json();

    if (!Array.isArray(categories)) {
      throw new Error(
        'Invalid service categories response.'
      );
    }

    const activeCategories =
      categories
        .filter(
          (category) =>
            Number(category.is_active) === 1 &&
            category.name &&
            category.slug
        )
        .sort(
          (first, second) => {
            const orderDifference =
              Number(
                first.sort_order || 0
              ) -
              Number(
                second.sort_order || 0
              );

            if (orderDifference !== 0) {
              return orderDifference;
            }

            return String(first.name)
              .localeCompare(
                String(second.name)
              );
          }
        );

    menu.innerHTML =
  activeCategories
    .map(
      (category) => `
        <a
          data-service-category-link="${escapeSharedAttribute(
            category.slug
          )}"
          href="services.html?category=${encodeURIComponent(
            category.slug
          )}"
        >
          ${escapeSharedHtml(
            category.name
          )}
        </a>
      `
    )
    .join('');
  } catch (error) {
    console.warn(
      'Could not load service menu:',
      error
    );

    menu.innerHTML = '';
  }
}

function escapeSharedHtml(value) {
  const element =
    document.createElement('div');

  element.textContent =
    value == null
      ? ''
      : String(value);

  return element.innerHTML;
}

function escapeSharedAttribute(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

  function footerMarkup() {
    return `
      <footer>
        <div class="wrap">
          <div class="footer-grid">
            <div>
              <img class="footer-logo" src="images/logoklinik.png" alt="Klinik Putrijaya">
              <p class="footer-summary">Your Wellness, Our Priority. A trusted family clinic group in Cheras, Sungai Besi and Puchong.</p>
            </div>
            <div>
              <h4>Explore</h4>
              <a href="about.html">About</a>
              <a href="branches.html">Branches</a>
              <a href="doctors.html">Doctors</a>
              <a href="services.html">Services</a>
            </div>
            <div>
              <h4>Community</h4>
              <a href="activities.html">Activities &amp; CSR</a>
              <a href="little-shield.html">Little Shield</a>
              <a href="feedback.html">Patient Feedback</a>
            </div>
            <div>
              <h4>Branches</h4>
              <a href="https://wa.link/ohje1h" target="_blank" rel="noopener">Cheras — 018-314 4588</a>
              <a href="https://wa.link/edexo9" target="_blank" rel="noopener">Sungai Besi — 019-347 0448</a>
              <a href="https://wa.link/c6jnt3" target="_blank" rel="noopener">Puchong — 019-387 0448</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 Klinik Putrijaya. All rights reserved.</span>
            <span>Bumiputera-owned family &amp; general practice clinic group, Malaysia</span>
            <a href="admin.html" class="admin-footer-link">Staff login</a>
          </div>
        </div>
      </footer>
    `;
  }

  function branchModalMarkup() {
    return `
      <div class="branch-modal" id="branchModal" aria-hidden="true">
        <div class="branch-modal-backdrop" data-close-branch-modal></div>
        <div class="branch-modal-panel" role="dialog" aria-modal="true" aria-labelledby="branchModalTitle">
          <button class="branch-modal-close" type="button" aria-label="Close popup" data-close-branch-modal>×</button>
          <div class="branch-modal-head">
            <span class="branch-modal-kicker">Book / Chat With Us</span>
            <h3 id="branchModalTitle">Choose your preferred branch</h3>
            <p>Tap any branch below to continue on WhatsApp.</p>
          </div>
          <div class="branch-whatsapp-list">
            <a class="branch-whatsapp-card" href="https://wa.link/ohje1h" target="_blank" rel="noopener">
              <span class="wa-icon" aria-hidden="true">
  <svg
    viewBox="0 0 32 32"
    focusable="false"
  >
    <path
      d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Zm5.87-8.01c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
    />
  </svg>
</span>
              <span><b>Klinik Putrijaya Cheras</b><small>018-314 4588</small></span>
            </a>
            <a class="branch-whatsapp-card" href="https://wa.link/edexo9" target="_blank" rel="noopener">
              <span class="wa-icon" aria-hidden="true">
  <svg
    viewBox="0 0 32 32"
    focusable="false"
  >
    <path
      d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Zm5.87-8.01c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
    />
  </svg>
</span>
              <span><b>Klinik Putrijaya Sungai Besi</b><small>019-347 0448</small></span>
            </a>
            <a class="branch-whatsapp-card" href="https://wa.link/c6jnt3" target="_blank" rel="noopener">
              <span class="wa-icon" aria-hidden="true">
  <svg
    viewBox="0 0 32 32"
    focusable="false"
  >
    <path
      d="M16.02 3C8.85 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.73 6.5L3 29l6.67-1.7A12.9 12.9 0 0 0 16.02 29c7.17 0 13-5.83 13-13s-5.83-13-13-13Zm0 23.7c-2.02 0-3.99-.57-5.69-1.66l-.41-.26-3.95 1.01 1.05-3.84-.28-.43A10.67 10.67 0 0 1 5.32 16c0-5.9 4.8-10.7 10.7-10.7s10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7Zm5.87-8.01c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
    />
  </svg>
</span>
              <span><b>Klinik Putrijaya Puchong</b><small>019-387 0448</small></span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function setActiveNavigation() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const selectedCategory =
    String(
      params.get('category') || ''
    )
      .trim()
      .toLowerCase();

  const isServicesPage =
    PAGE_FILE === 'services.html' ||
    PAGE_FILE ===
      'service-detail.html';

  document
    .querySelectorAll(
      '[data-page-link]'
    )
    .forEach((link) => {
      const linkedPage =
        link.dataset.pageLink;

      const isActive =
        linkedPage === PAGE_FILE ||
        (
          linkedPage ===
            'services.html' &&
          isServicesPage &&
          !selectedCategory
        );

      link.classList.toggle(
        'is-active',
        isActive
      );

      if (isActive) {
        link.setAttribute(
          'aria-current',
          'page'
        );
      } else {
        link.removeAttribute(
          'aria-current'
        );
      }
    });

  document
    .querySelectorAll(
      '[data-service-category-link]'
    )
    .forEach((link) => {
      const linkCategory =
        String(
          link.dataset
            .serviceCategoryLink || ''
        )
          .trim()
          .toLowerCase();

      const isActive =
        isServicesPage &&
        Boolean(selectedCategory) &&
        linkCategory ===
          selectedCategory;

      link.classList.toggle(
        'is-active',
        isActive
      );

      if (isActive) {
        link.setAttribute(
          'aria-current',
          'page'
        );
      } else {
        link.removeAttribute(
          'aria-current'
        );
      }
    });

  document
    .querySelectorAll(
      '.nav-dropdown'
    )
    .forEach((dropdown) => {
      const hasActiveChild =
        Boolean(
          dropdown.querySelector(
            '.nav-dropdown-menu .is-active'
          )
        );

      dropdown.classList.toggle(
        'has-active-child',
        hasActiveChild
      );
    });
}

  function initNavigation() {
  const navToggle =
    document.querySelector(
      '.nav-toggle'
    );

  const navMenu =
    document.querySelector(
      '.nav-menu'
    );

  const dropdowns =
    Array.from(
      document.querySelectorAll(
        '.nav-dropdown'
      )
    );

  const desktopQuery =
    window.matchMedia(
      '(min-width: 881px) and ' +
      '(hover: hover) and ' +
      '(pointer: fine)'
    );

  let closeTimer = null;

  function isDesktopHover() {
    return desktopQuery.matches;
  }

  function closeDropdown(
    dropdown
  ) {
    dropdown.classList.remove(
      'is-open'
    );

    dropdown
      .querySelector(
        '.nav-dropdown-toggle'
      )
      ?.setAttribute(
        'aria-expanded',
        'false'
      );
  }

  function closeAllDropdowns(
    exceptDropdown = null
  ) {
    if (closeTimer) {
      window.clearTimeout(
        closeTimer
      );

      closeTimer = null;
    }

    dropdowns.forEach(
      (dropdown) => {
        if (
          dropdown !==
          exceptDropdown
        ) {
          closeDropdown(
            dropdown
          );
        }
      }
    );
  }

  function openDropdown(
    dropdown
  ) {
    closeAllDropdowns(
      dropdown
    );

    dropdown.classList.add(
      'is-open'
    );

    dropdown
      .querySelector(
        '.nav-dropdown-toggle'
      )
      ?.setAttribute(
        'aria-expanded',
        'true'
      );
  }

  function scheduleDropdownClose(
    dropdown
  ) {
    if (closeTimer) {
      window.clearTimeout(
        closeTimer
      );
    }

    closeTimer =
      window.setTimeout(
        () => {
          closeDropdown(
            dropdown
          );

          closeTimer = null;
        },
        140
      );
  }

  function closeMobileMenu() {
    navMenu?.classList.remove(
      'is-open'
    );

    navToggle?.setAttribute(
      'aria-expanded',
      'false'
    );

    navToggle?.setAttribute(
      'aria-label',
      'Open navigation menu'
    );

    document.body.classList.remove(
      'menu-open'
    );

    closeAllDropdowns();
  }

  navToggle?.addEventListener(
    'click',
    () => {
      const shouldOpen =
        !navMenu?.classList.contains(
          'is-open'
        );

      navMenu?.classList.toggle(
        'is-open',
        shouldOpen
      );

      navToggle.setAttribute(
        'aria-expanded',
        String(shouldOpen)
      );

      navToggle.setAttribute(
        'aria-label',
        shouldOpen
          ? 'Close navigation menu'
          : 'Open navigation menu'
      );

      document.body.classList.toggle(
        'menu-open',
        shouldOpen
      );

      if (!shouldOpen) {
        closeAllDropdowns();
      }
    }
  );

  dropdowns.forEach(
    (dropdown) => {
      const button =
        dropdown.querySelector(
          '.nav-dropdown-toggle'
        );

      const menu =
        dropdown.querySelector(
          '.nav-dropdown-menu'
        );

      if (!button || !menu) {
        return;
      }

      dropdown.addEventListener(
        'mouseenter',
        () => {
          if (
            isDesktopHover()
          ) {
            openDropdown(
              dropdown
            );
          }
        }
      );

      dropdown.addEventListener(
        'mouseleave',
        () => {
          if (
            isDesktopHover()
          ) {
            scheduleDropdownClose(
              dropdown
            );
          }
        }
      );

      menu.addEventListener(
        'mouseenter',
        () => {
          if (
            isDesktopHover()
          ) {
            openDropdown(
              dropdown
            );
          }
        }
      );

      menu.addEventListener(
        'mouseleave',
        () => {
          if (
            isDesktopHover()
          ) {
            scheduleDropdownClose(
              dropdown
            );
          }
        }
      );

      button.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          const isOpen =
            dropdown.classList.contains(
              'is-open'
            );

          if (isOpen) {
            closeDropdown(
              dropdown
            );
          } else {
            openDropdown(
              dropdown
            );
          }
        }
      );

      button.addEventListener(
        'focus',
        () => {
          openDropdown(
            dropdown
          );
        }
      );

      dropdown.addEventListener(
        'focusout',
        (event) => {
          const nextElement =
            event.relatedTarget;

          if (
            nextElement &&
            dropdown.contains(
              nextElement
            )
          ) {
            return;
          }

          closeDropdown(
            dropdown
          );
        }
      );
    }
  );

  document.addEventListener(
    'click',
    (event) => {
      if (
        !event.target.closest(
          '.nav-dropdown'
        )
      ) {
        closeAllDropdowns();
      }

      if (
        !isDesktopHover() &&
        navMenu?.classList.contains(
          'is-open'
        ) &&
        !event.target.closest(
          '.site-nav'
        )
      ) {
        closeMobileMenu();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key !==
        'Escape'
      ) {
        return;
      }

      closeAllDropdowns();

      if (
        navMenu?.classList.contains(
          'is-open'
        )
      ) {
        closeMobileMenu();
        navToggle?.focus();
      }
    }
  );

  document
    .querySelectorAll(
      '.nav-menu a'
    )
    .forEach((link) => {
      link.addEventListener(
        'click',
        () => {
          if (
            !isDesktopHover()
          ) {
            closeMobileMenu();
          }
        }
      );
    });

  function resetNavigation() {
    closeMobileMenu();
  }

  if (
    typeof desktopQuery
      .addEventListener ===
    'function'
  ) {
    desktopQuery.addEventListener(
      'change',
      resetNavigation
    );
  } else {
    desktopQuery.addListener(
      resetNavigation
    );
  }
}

  function initBranchModal() {
    const modal = document.getElementById('branchModal');
    const triggers = document.querySelectorAll('.branch-modal-trigger');
    const closeButtons = document.querySelectorAll('[data-close-branch-modal]');
    let lastTrigger = null;

    if (!modal) return;

    function openModal(trigger) {
      lastTrigger = trigger || null;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('branch-modal-open');
      modal.querySelector('.branch-modal-close')?.focus();
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('branch-modal-open');
      lastTrigger?.focus();
    }

    triggers.forEach((trigger) => trigger.addEventListener('click', () => openModal(trigger)));
    closeButtons.forEach((button) => button.addEventListener('click', closeModal));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
  const headerHost = document.getElementById('site-header');

  if (headerHost) {
    headerHost.innerHTML = headerMarkup();
  }

  const footerHost = document.getElementById('site-footer');

  if (footerHost) {
    footerHost.innerHTML = footerMarkup();
  }

  if (!document.getElementById('branchModal')) {
    document.body.insertAdjacentHTML(
      'beforeend',
      branchModalMarkup()
    );
  }

  /* =========================================================
   Website performance tracker
   ========================================================= */

(function loadPerformanceTracker() {
  if (
    document.querySelector(
      'script[data-kp-performance]'
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      'script'
    );

  script.src =
  'js/analytics.js?v=20260729-2';

  script.defer = true;

  script.dataset.kpPerformance =
    'true';

  document.head.appendChild(
    script
  );
})();

  hydrateServiceCategoryLinks()
  .finally(() => {
    setActiveNavigation();
  });

initNavigation();
initBranchModal();
});
})();   