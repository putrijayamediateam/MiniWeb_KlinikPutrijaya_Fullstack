// ============================================================
// Klinik Putrijaya - Promotions Carousel
// ============================================================

(() => {
  'use strict';

  const API_BASE = String(
  window.KP_API_BASE ||
  (
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:4000/api'
      : 'https://backend-production-d730.up.railway.app/api'
  )
).replace(/\/$/, '');

  const BACKEND_ORIGIN =
    new URL(API_BASE).origin;

  const carousel =
    document.querySelector(
      '.promo-carousel'
    );

  const track =
    document.getElementById(
      'promoTrack'
    );

  const dotsContainer =
    document.querySelector(
      '.promo-dots'
    );

  const prevButton =
    document.querySelector(
      '.promo-btn.prev'
    );

  const nextButton =
    document.querySelector(
      '.promo-btn.next'
    );

  if (
    !carousel ||
    !track ||
    !dotsContainer
  ) {
    return;
  }

  const reduceMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  let promotions = [];
  let slides = [];
  let dots = [];
  let currentIndex = 0;
  let timer = null;
  let touchStartX = 0;
  let touchEndX = 0;

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  function escapeHtml(value) {
    const div =
      document.createElement('div');

    div.textContent =
      value == null
        ? ''
        : String(value);

    return div.innerHTML;
  }

  function resolveImageUrl(imageUrl) {
    if (!imageUrl) {
      return '';
    }

    const cleanUrl = String(imageUrl)
      .trim()
      .replace(/\\/g, '/');

    // Already a complete URL
    if (
      /^https?:\/\//i.test(
        cleanUrl
      )
    ) {
      return cleanUrl;
    }

    // Handles:
    // images/poster.jpg
    // /images/poster.jpg
    return (
      `${BACKEND_ORIGIN}/` +
      cleanUrl.replace(/^\/+/, '')
    );
  }

  function showCarouselButtons(show) {
    if (prevButton) {
      prevButton.hidden = !show;
    }

    if (nextButton) {
      nextButton.hidden = !show;
    }

    dotsContainer.hidden = !show;
  }

  // ----------------------------------------------------------
  // Render promotions
  // ----------------------------------------------------------

  function renderPromotions(items) {
    promotions =
      Array.isArray(items)
        ? items
        : [];

    slides = [];
    dots = [];
    currentIndex = 0;

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    if (!promotions.length) {
      showCarouselButtons(false);

      track.innerHTML = `
        <div class="promo-empty">
          No promotions available right now.
        </div>
      `;

      return;
    }

    showCarouselButtons(
      promotions.length > 1
    );

    promotions.forEach(
      (item, index) => {
        const slide =
          document.createElement(
            'article'
          );

        slide.className =
          'promo-slide';

        const imageUrl =
          resolveImageUrl(
            item.image_url
          );

        const details = item.details
          ? String(item.details)
              .split(/\r?\n/)
              .map((line) =>
                line.trim()
              )
              .filter(Boolean)
          : [];

        slide.innerHTML = `
          <div class="promo-visual"></div>

          <div class="promo-slide-content">
            <span class="promo-pill">
              ${escapeHtml(
                item.badge ||
                'Promotion'
              )}
            </span>

            <h3>
              ${escapeHtml(
                item.title || ''
              )}
            </h3>

            ${
              item.description
                ? `
                  <p>
                    ${escapeHtml(
                      item.description
                    )}
                  </p>
                `
                : ''
            }

            ${
              details.length
                ? `
                  <ul>
                    ${details
                      .map(
                        (line) =>
                          `<li>${escapeHtml(
                            line
                          )}</li>`
                      )
                      .join('')}
                  </ul>
                `
                : ''
            }

            ${
              item.cta_label &&
              item.cta_link
                ? `
                  <a
                    class="btn-primary"
                    href="${escapeHtml(
                      item.cta_link
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ${escapeHtml(
                      item.cta_label
                    )}
                  </a>
                `
                : ''
            }
          </div>
        `;

        const visual =
          slide.querySelector(
            '.promo-visual'
          );

        if (visual && imageUrl) {
          visual.style.backgroundImage =
            `url("${imageUrl}")`;

          visual.classList.add(
            'has-image'
          );
        }

        track.appendChild(slide);
        slides.push(slide);

        const dot =
          document.createElement(
            'button'
          );

        dot.className =
          'promo-dot';

        dot.type = 'button';

        dot.setAttribute(
          'aria-label',
          `Go to slide ${index + 1}`
        );

        dot.addEventListener(
          'click',
          () => {
            goTo(index);
            startAutoplay();
          }
        );

        dotsContainer.appendChild(
          dot
        );

        dots.push(dot);
      }
    );

    goTo(0);
    startAutoplay();
  }

  // ----------------------------------------------------------
  // Carousel movement
  // ----------------------------------------------------------

  function updateDots() {
    dots.forEach(
      (dot, index) => {
        const isCurrent =
          index === currentIndex;

        dot.classList.toggle(
          'is-active',
          isCurrent
        );

        dot.setAttribute(
          'aria-current',
          isCurrent
            ? 'true'
            : 'false'
        );
      }
    );
  }

  function goTo(index) {
    if (!slides.length) {
      return;
    }

    const safeIndex =
      (
        index +
        slides.length
      ) % slides.length;

    currentIndex = safeIndex;

    track.scrollTo({
      left:
        track.clientWidth *
        safeIndex,

      behavior: reduceMotion
        ? 'auto'
        : 'smooth',
    });

    updateDots();
  }

  function goNext() {
    goTo(currentIndex + 1);
  }

  function goPrevious() {
    goTo(currentIndex - 1);
  }

  // ----------------------------------------------------------
  // Autoplay
  // ----------------------------------------------------------

  function startAutoplay() {
    window.clearInterval(timer);

    if (
      reduceMotion ||
      promotions.length < 2
    ) {
      return;
    }

    timer =
      window.setInterval(() => {
        goNext();
      }, 4000);
  }

  function pauseAutoplay() {
    window.clearInterval(timer);
  }

  // ----------------------------------------------------------
  // Buttons
  // ----------------------------------------------------------

  prevButton?.addEventListener(
    'click',
    () => {
      goPrevious();
      startAutoplay();
    }
  );

  nextButton?.addEventListener(
    'click',
    () => {
      goNext();
      startAutoplay();
    }
  );

  // ----------------------------------------------------------
  // Mouse interaction
  // ----------------------------------------------------------

  carousel.addEventListener(
    'mouseenter',
    pauseAutoplay
  );

  carousel.addEventListener(
    'mouseleave',
    startAutoplay
  );

  // ----------------------------------------------------------
  // Mobile swipe
  // ----------------------------------------------------------

  carousel.addEventListener(
    'touchstart',
    (event) => {
      touchStartX =
        event.changedTouches[0]
          .clientX;

      pauseAutoplay();
    },
    {
      passive: true,
    }
  );

  carousel.addEventListener(
    'touchend',
    (event) => {
      touchEndX =
        event.changedTouches[0]
          .clientX;

      const difference =
        touchStartX - touchEndX;

      if (difference > 50) {
        goNext();
      } else if (
        difference < -50
      ) {
        goPrevious();
      }

      startAutoplay();
    },
    {
      passive: true,
    }
  );

  window.addEventListener(
    'resize',
    () => {
      goTo(currentIndex);
    }
  );

  // ----------------------------------------------------------
  // Load promotion data
  // ----------------------------------------------------------

  fetch(
    `${API_BASE}/promotions`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load promotions (${response.status}).`
        );
      }

      return response.json();
    })
    .then((items) => {
      renderPromotions(items);
    })
    .catch((error) => {
      console.error(
        'Promotion loading error:',
        error
      );

      renderPromotions([]);
    });
})();