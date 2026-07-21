// Homepage interactions: panel scroller, counters and Little Shield poster slider.

document.addEventListener("DOMContentLoaded", () => {
  initPanelScroller();
  initCounters();
  initPosterSlider();
});

function initPanelScroller() {
  const scroller = document.querySelector("[data-panel-scroller]");
  const track = scroller?.querySelector(".panel-track");

  if (!scroller || !track || track.dataset.cloned === "true") return;

  track.insertAdjacentHTML("beforeend", track.innerHTML);
  track.dataset.cloned = "true";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let isDragging = false;
  let autoScrollPaused = false;
  let startX = 0;
  let startScrollLeft = 0;
  let wheelTimer = null;
  const speed = reduceMotion ? 0 : 0.6;

  const halfWidth = () => track.scrollWidth / 2;

  function normalizeScroll() {
    const half = halfWidth();
    if (!half) return;

    if (scroller.scrollLeft >= half) scroller.scrollLeft -= half;
    if (scroller.scrollLeft <= 0) scroller.scrollLeft += half;
  }

  function autoScroll() {
    if (!isDragging && !autoScrollPaused && speed > 0) {
      scroller.scrollLeft += speed;
      normalizeScroll();
    }
    window.requestAnimationFrame(autoScroll);
  }

  scroller.scrollLeft = 1;

  scroller.addEventListener("mousedown", (event) => {
    isDragging = true;
    autoScrollPaused = true;
    startX = event.pageX;
    startScrollLeft = scroller.scrollLeft;
    scroller.classList.add("is-dragging");
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    scroller.classList.remove("is-dragging");
    window.setTimeout(() => { autoScrollPaused = false; }, 500);
  });

  scroller.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    event.preventDefault();
    scroller.scrollLeft = startScrollLeft - (event.pageX - startX);
    normalizeScroll();
  });

  scroller.addEventListener("touchstart", (event) => {
    isDragging = true;
    autoScrollPaused = true;
    startX = event.touches[0].pageX;
    startScrollLeft = scroller.scrollLeft;
  }, { passive: true });

  scroller.addEventListener("touchmove", (event) => {
    if (!isDragging) return;
    scroller.scrollLeft = startScrollLeft - (event.touches[0].pageX - startX);
    normalizeScroll();
  }, { passive: true });

  scroller.addEventListener("touchend", () => {
    isDragging = false;
    window.setTimeout(() => { autoScrollPaused = false; }, 500);
  });

  scroller.addEventListener("wheel", (event) => {
    event.preventDefault();
    autoScrollPaused = true;
    scroller.scrollLeft += event.deltaY || event.deltaX;
    normalizeScroll();

    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { autoScrollPaused = false; }, 800);
  }, { passive: false });

  autoScroll();
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
