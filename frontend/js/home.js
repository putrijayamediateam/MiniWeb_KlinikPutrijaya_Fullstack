// Homepage interactions: panel scroller, database-driven service list and care chips, and visit-step tabs.

document.addEventListener("DOMContentLoaded", () => {
  initPanelScroller();
  initServiceCategories();
  initStepTabs();
});

function initPanelScroller() {
  const scroller =
    document.querySelector(
      '[data-panel-scroller]'
    );

  const track =
    scroller?.querySelector(
      '.panel-track'
    );

  if (
    !scroller ||
    !track ||
    track.dataset.cloned === 'true'
  ) {
    return;
  }

  /*
    Gandakan logo sekali sahaja untuk
    menghasilkan loop berterusan.
  */
  track.insertAdjacentHTML(
    'beforeend',
    track.innerHTML
  );

  track.dataset.cloned = 'true';

  const reduceMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  const speed =
    reduceMotion ? 0 : 0.55;

  let animationFrameId = null;
  let resumeTimer = null;

  let isInteracting = false;
  let startPointerX = 0;
  let startScrollLeft = 0;

  /*
    Nilai berasingan ini penting untuk Safari.
    Ia menyimpan pergerakan pecahan seperti
    0.55px tanpa dibundarkan kepada kosong.
  */
  let virtualScrollLeft = 1;

  function getLoopWidth() {
    return track.scrollWidth / 2;
  }

  function normalizePosition() {
    const loopWidth =
      getLoopWidth();

    if (!loopWidth) {
      return;
    }

    if (
      virtualScrollLeft >=
      loopWidth
    ) {
      virtualScrollLeft -=
        loopWidth;
    }

    if (
      virtualScrollLeft <= 0
    ) {
      virtualScrollLeft +=
        loopWidth;
    }

    scroller.scrollLeft =
      virtualScrollLeft;
  }

  function pauseAutoScroll() {
    isInteracting = true;

    window.clearTimeout(
      resumeTimer
    );
  }

  function resumeAutoScroll(
    delay = 700
  ) {
    window.clearTimeout(
      resumeTimer
    );

    resumeTimer =
      window.setTimeout(
        () => {
          virtualScrollLeft =
            scroller.scrollLeft;

          isInteracting =
            false;
        },
        delay
      );
  }

  function startInteraction(
    pointerX
  ) {
    pauseAutoScroll();

    startPointerX =
      pointerX;

    startScrollLeft =
      scroller.scrollLeft;

    virtualScrollLeft =
      startScrollLeft;

    scroller.classList.add(
      'is-dragging'
    );
  }

  function moveInteraction(
    pointerX
  ) {
    if (!isInteracting) {
      return;
    }

    const distance =
      pointerX -
      startPointerX;

    virtualScrollLeft =
      startScrollLeft -
      distance;

    normalizePosition();
  }

  function endInteraction() {
    scroller.classList.remove(
      'is-dragging'
    );

    virtualScrollLeft =
      scroller.scrollLeft;

    resumeAutoScroll();
  }

  function autoScroll() {
    if (
      !isInteracting &&
      speed > 0
    ) {
      virtualScrollLeft +=
        speed;

      normalizePosition();
    }

    animationFrameId =
      window.requestAnimationFrame(
        autoScroll
      );
  }

  scroller.addEventListener(
    'mousedown',
    (event) => {
      event.preventDefault();

      startInteraction(
        event.pageX
      );
    }
  );

  window.addEventListener(
    'mousemove',
    (event) => {
      if (!isInteracting) {
        return;
      }

      event.preventDefault();

      moveInteraction(
        event.pageX
      );
    }
  );

  window.addEventListener(
    'mouseup',
    () => {
      if (isInteracting) {
        endInteraction();
      }
    }
  );

  scroller.addEventListener(
    'touchstart',
    (event) => {
      const touch =
        event.touches[0];

      if (!touch) {
        return;
      }

      startInteraction(
        touch.pageX
      );
    },
    {
      passive: true,
    }
  );

  scroller.addEventListener(
    'touchmove',
    (event) => {
      const touch =
        event.touches[0];

      if (
        !touch ||
        !isInteracting
      ) {
        return;
      }

      moveInteraction(
        touch.pageX
      );
    },
    {
      passive: true,
    }
  );

  scroller.addEventListener(
    'touchend',
    endInteraction,
    {
      passive: true,
    }
  );

  scroller.addEventListener(
    'touchcancel',
    endInteraction,
    {
      passive: true,
    }
  );

  scroller.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      pauseAutoScroll();

      virtualScrollLeft +=
        event.deltaY ||
        event.deltaX;

      normalizePosition();
      resumeAutoScroll(900);
    },
    {
      passive: false,
    }
  );

  /*
    Selaraskan semula selepas resize
    atau pertukaran orientasi phone.
  */
  window.addEventListener(
    'resize',
    () => {
      virtualScrollLeft =
        scroller.scrollLeft ||
        1;

      normalizePosition();
    }
  );

  scroller.scrollLeft = 1;
  virtualScrollLeft = 1;

  autoScroll();

  /*
    Hentikan animation frame jika elemen
    dibuang daripada halaman.
  */
  window.addEventListener(
    'pagehide',
    () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(
          animationFrameId
        );
      }

      window.clearTimeout(
        resumeTimer
      );
    },
    {
      once: true,
    }
  );
}

// Same API base rule as js/api.js, which this page does not load.
function homeApiBase() {
  if (window.KP_API_BASE) {
    return window.KP_API_BASE;
  }

  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:4000/api'
    : 'https://backend-production-d730.up.railway.app/api';
}

const HOME_ARROW_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function homeServiceRow(name, description, href) {
  const row = document.createElement('a');
  row.className = 'home-service-row';
  row.href = href;

  const text = document.createElement('span');
  text.className = 'home-service-text';

  const title = document.createElement('span');
  title.className = 'home-service-name';
  title.textContent = name;
  text.append(title);

  if (description) {
    const desc = document.createElement('span');
    desc.className = 'home-service-desc';
    desc.textContent = description;
    text.append(desc);
  }

  const arrow = document.createElement('span');
  arrow.className = 'home-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = HOME_ARROW_ICON;

  row.append(text, arrow);
  return row;
}

// Service categories are database-driven: never hardcode them here.
async function initServiceCategories() {
  const list = document.querySelector('[data-home-service-list]');
  const chips = document.querySelector('[data-home-care-chips]');

  if (!list && !chips) return;

  try {
    const response = await fetch(`${homeApiBase()}/service-categories`);

    if (!response.ok) {
      throw new Error(`Service categories request failed (${response.status}).`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid service categories response.');
    }

    const categories = data
      .filter((category) => Number(category.is_active) === 1 && category.name && category.slug)
      .sort((first, second) => (
        Number(first.sort_order || 0) - Number(second.sort_order || 0) ||
        String(first.name).localeCompare(String(second.name))
      ))
      .slice(0, 6);

    if (!categories.length) return;

    const categoryHref = (category) => `services.html?category=${encodeURIComponent(category.slug)}`;

    if (chips) {
      chips.replaceChildren(...categories.map((category) => {
        const chip = document.createElement('a');
        chip.href = categoryHref(category);
        chip.textContent = category.name;
        return chip;
      }));
      chips.hidden = false;
    }

    if (list) {
      list.replaceChildren(
        ...categories.map((category) => homeServiceRow(
          category.name,
          category.short_description,
          categoryHref(category)
        )),
        homeServiceRow('Semua rawatan', 'Lihat senarai penuh rawatan kami', 'services.html')
      );
    }
  } catch (error) {
    // The static "Semua rawatan" link stays in place and the chips stay hidden.
    console.warn('Could not load service categories:', error);
  }
}

function initStepTabs() {
  const container = document.querySelector('[data-home-steps]');
  const tabs = container ? Array.from(container.querySelectorAll('[role="tab"]')) : [];

  if (!tabs.length) return;

  function select(nextTab, moveFocus) {
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });

    if (moveFocus) nextTab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab, false));

    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };

      if (event.key in keys) {
        event.preventDefault();
        select(tabs[(index + keys[event.key] + tabs.length) % tabs.length], true);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        select(event.key === 'Home' ? tabs[0] : tabs[tabs.length - 1], true);
      }
    });
  });
}
