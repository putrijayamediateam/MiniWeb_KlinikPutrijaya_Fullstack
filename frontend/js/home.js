// Homepage interactions: panel scroller, counters and Little Shield poster slider.

document.addEventListener("DOMContentLoaded", () => {
  initPanelScroller();
  initCounters();
  initPosterSlider();
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

function initCounters() {
  const counters = document.querySelectorAll(".counter");
  const statBar = document.querySelector(".stat-bar");
  if (!counters.length) return;

  let hasAnimated = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateCounter(counter, delay = 0) {
    const target = Number(counter.dataset.target);
    const suffix = counter.dataset.suffix || "";

    if (reduceMotion) {
      counter.textContent = `${target}${suffix}`;
      return;
    }

    window.setTimeout(() => {
      const duration = 2000;
      const startTime = performance.now();

      function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = `${Math.floor(target * eased)}${suffix}`;

        if (progress < 1) {
          window.requestAnimationFrame(update);
        } else {
          counter.textContent = `${target}${suffix}`;
          counter.classList.add("is-final");
          window.setTimeout(() => counter.classList.remove("is-final"), 450);
        }
      }

      window.requestAnimationFrame(update);
    }, delay);
  }

  function startCounters() {
    if (hasAnimated) return;
    hasAnimated = true;
    counters.forEach((counter, index) => animateCounter(counter, index * 160));
  }

  if ("IntersectionObserver" in window && statBar) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        startCounters();
        observer.disconnect();
      }
    }, { threshold: 0.35 });

    observer.observe(statBar);
  } else {
    startCounters();
  }
}

function initPosterSlider() {
  const slider = document.querySelector(".poster-slider");
  const track = slider?.querySelector(".poster-track");
  const previous = slider?.querySelector(".poster-btn.prev");
  const next = slider?.querySelector(".poster-btn.next");

  if (!slider || !track || !previous || !next) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = null;
  let paused = false;

  const total = () => track.querySelectorAll("img").length;
  const current = () => Math.round(track.scrollLeft / track.clientWidth);

  function goTo(index) {
    track.scrollTo({
      left: track.clientWidth * index,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function goNext() {
    goTo(current() >= total() - 1 ? 0 : current() + 1);
  }

  function goPrevious() {
    goTo(current() <= 0 ? total() - 1 : current() - 1);
  }

  function start() {
    window.clearInterval(timer);
    if (reduceMotion) return;
    timer = window.setInterval(() => {
      if (!paused) goNext();
    }, 3000);
  }

  next.addEventListener("click", () => {
    goNext();
    start();
  });

  previous.addEventListener("click", () => {
    goPrevious();
    start();
  });

  slider.addEventListener("mouseenter", () => {
    paused = true;
    window.clearInterval(timer);
  });

  slider.addEventListener("mouseleave", () => {
    paused = false;
    start();
  });

  slider.addEventListener("touchstart", () => {
    paused = true;
    window.clearInterval(timer);
  }, { passive: true });

  slider.addEventListener("touchend", () => {
    paused = false;
    start();
  });

  start();
}
