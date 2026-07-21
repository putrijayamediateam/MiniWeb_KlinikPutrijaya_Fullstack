document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.activity-card').forEach((card) => {
    const track = card.querySelector('.gallery-track');
    const previous = card.querySelector('.gallery-btn.prev');
    const next = card.querySelector('.gallery-btn.next');
    if (!track || !previous || !next) return;

    const count = () => track.querySelectorAll('img').length;
    const current = () => Math.round(track.scrollLeft / track.clientWidth);

    function goTo(index) {
      track.scrollTo({
        left: track.clientWidth * index,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }

    next.addEventListener('click', () => {
      goTo(current() >= count() - 1 ? 0 : current() + 1);
    });

    previous.addEventListener('click', () => {
      goTo(current() <= 0 ? count() - 1 : current() - 1);
    });
  });
});