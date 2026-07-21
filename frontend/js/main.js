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

            <li>
              <a
                data-page-link="services.html"
                href="services.html"
              >
                Services
              </a>
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
              <a href="https://wa.link/s5e9zp" target="_blank" rel="noopener">Puchong — 019-387 0448</a>
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
              <span class="wa-icon" aria-hidden="true">WA</span>
              <span><b>Klinik Putrijaya Cheras</b><small>018-314 4588</small></span>
            </a>
            <a class="branch-whatsapp-card" href="https://wa.link/edexo9" target="_blank" rel="noopener">
              <span class="wa-icon" aria-hidden="true">WA</span>
              <span><b>Klinik Putrijaya Sungai Besi</b><small>019-347 0448</small></span>
            </a>
            <a class="branch-whatsapp-card" href="https://wa.link/s5e9zp" target="_blank" rel="noopener">
              <span class="wa-icon" aria-hidden="true">WA</span>
              <span><b>Klinik Putrijaya Puchong</b><small>019-387 0448</small></span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function setActiveNavigation() {
    document.querySelectorAll('[data-page-link]').forEach((link) => {
      const isActive = link.dataset.pageLink === PAGE_FILE;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });

    document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
      const hasActiveChild = Boolean(dropdown.querySelector('.nav-dropdown-menu .is-active'));
      dropdown.classList.toggle('has-active-child', hasActiveChild);
    });
  }

  function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const dropdowns = document.querySelectorAll('.nav-dropdown');

    navToggle?.addEventListener('click', () => {
      const open = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });

    function closeAllDropdowns(exceptDropdown) {
      dropdowns.forEach((other) => {
        if (other !== exceptDropdown) {
          other.classList.remove('is-open');
          other.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Click (not hover) opens/closes a dropdown, on both mobile and desktop.
    dropdowns.forEach((dropdown) => {
      const button = dropdown.querySelector('.nav-dropdown-toggle');
      button?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const alreadyOpen = dropdown.classList.contains('is-open');
        closeAllDropdowns(dropdown);

        const willOpen = !alreadyOpen;
        dropdown.classList.toggle('is-open', willOpen);
        button.setAttribute('aria-expanded', String(willOpen));
      });
    });

    // Clicking anywhere outside an open dropdown closes it.
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.nav-dropdown')) {
        closeAllDropdowns();
      }
    });

    // Escape closes any open dropdown too.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    document.querySelectorAll('.nav-menu a').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu?.classList.remove('is-open');
        navToggle?.setAttribute('aria-expanded', 'false');
        closeAllDropdowns();
      });
    });
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

  setActiveNavigation();
  initNavigation();
  initBranchModal();
});
})();   