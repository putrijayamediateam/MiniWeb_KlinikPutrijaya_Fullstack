// New-booking alerts for the admin dashboard. Polls for bookings newer than
// the last one seen, then keeps nagging until a staff member acknowledges:
// - a chime that repeats on every check (30 s) while bookings are waiting,
// - a banner at the top of the dashboard with "View" and "OK, seen it",
// - a flashing tab title and a red dot on the tab icon,
// - a desktop pop-up (browser notification) when the page is not in front.
// A waiting booking also stops nagging once its status is no longer pending,
// so a colleague handling it on another PC quietens everyone.
// Bookings come from the normal authenticated API, so branch-limited
// accounts are only alerted about their branches.

(function () {
  'use strict';

  const POLL_INTERVAL_MS = 30000;
  const FLASH_INTERVAL_MS = 1000;
  const SOUND_KEY = 'kp_booking_alert_sound';

  let timer = null;
  let flashTimer = null;
  let flashOn = false;
  let fetchLatest = null;
  let onNewBookings = null;
  let onOpen = null;
  let describe = (booking) => `Booking #${booking.id}`;
  let lastSeenId = null;
  let checking = false;
  let audioContext = null;
  let baseTitle = document.title;

  // Bookings not yet acknowledged, newest first.
  let waiting = [];
  let popups = [];

  const faviconLink = document.getElementById('adminFavicon');
  const faviconHref = faviconLink ? faviconLink.href : '';
  let faviconBadge = '';

  function readSoundSetting() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (error) {
      return true;
    }
  }

  let soundOn = readSoundSetting();

  /* ---------- sound ---------- */

  function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!audioContext && AudioContextClass) {
      audioContext = new AudioContextClass();
    }

    return audioContext;
  }

  // Browsers only allow sound after the user has clicked or typed on the page.
  function unlockAudio() {
    const context = getAudioContext();

    if (context && context.state === 'suspended') {
      return context.resume().then(renderBanner).catch(() => {});
    }

    return Promise.resolve();
  }

  function isAudioReady() {
    return Boolean(audioContext && audioContext.state === 'running');
  }

  // One mallet note: the fundamental plus a quieter 4th harmonic, struck
  // quickly and decaying like a marimba bar.
  function playMalletNote(context, frequency, startAt, duration) {
    [[1, 0.3], [4, 0.06]].forEach(([multiple, peak]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * multiple;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.05);
    });
  }

  // Rising marimba "ta-da-ding" (C6, E6, G6), played twice so it is
  // noticeable at a busy counter.
  function playChime() {
    if (!isAudioReady()) return false;

    const now = audioContext.currentTime;

    [0, 1.1].forEach((offset) => {
      playMalletNote(audioContext, 1046.5, now + offset, 0.45);
      playMalletNote(audioContext, 1318.5, now + offset + 0.13, 0.45);
      playMalletNote(audioContext, 1568, now + offset + 0.26, 0.8);
    });

    return true;
  }

  /* ---------- desktop pop-ups ---------- */

  function popupState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  // Must be called from a click: browsers ignore permission requests otherwise.
  function requestPopups() {
    if (popupState() !== 'default') return Promise.resolve(popupState());
    return Notification.requestPermission().catch(() => popupState());
  }

  function showPopup(title, body, tag) {
    if (popupState() !== 'granted') return;

    try {
      const popup = new Notification(title, {
        body,
        tag,
        icon: faviconHref || undefined,
        requireInteraction: true,
      });

      popup.onclick = () => {
        window.focus();
        openWaiting();
      };

      popups.push(popup);
    } catch (error) {
      // Some browsers only allow pop-ups from a service worker; the banner,
      // title and chime still work.
    }
  }

  function testPopup() {
    showPopup('Pop-up alerts are on', 'New appointment requests will appear here.', 'kp-booking-test');
  }

  function closePopups() {
    popups.forEach((popup) => popup.close());
    popups = [];
  }

  /* ---------- tab title + icon ---------- */

  function isInFront() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  function setFaviconBadge(on) {
    if (!faviconLink || !faviconHref) return;

    if (!on) {
      faviconLink.href = faviconHref;
      return;
    }

    if (faviconBadge) {
      faviconLink.href = faviconBadge;
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 32, 32);
      context.fillStyle = '#e11d48';
      context.beginPath();
      context.arc(24, 8, 8, 0, 2 * Math.PI);
      context.fill();
      faviconBadge = canvas.toDataURL('image/png');
      if (waiting.length) faviconLink.href = faviconBadge;
    };
    image.src = faviconHref;
  }

  function renderTitle() {
    const count = waiting.length;

    if (!count) {
      document.title = baseTitle;
      return;
    }

    document.title = flashOn ? `(${count}) 🔔 New booking!` : `(${count}) ${baseTitle}`;
  }

  function updateFlashing() {
    const shouldFlash = waiting.length > 0 && !isInFront();

    if (shouldFlash && !flashTimer) {
      flashTimer = window.setInterval(() => {
        flashOn = !flashOn;
        renderTitle();
      }, FLASH_INTERVAL_MS);
    } else if (!shouldFlash && flashTimer) {
      window.clearInterval(flashTimer);
      flashTimer = null;
      flashOn = false;
    }

    renderTitle();
    setFaviconBadge(waiting.length > 0);
  }

  /* ---------- banner ---------- */

  function bannerButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function renderBanner() {
    const banner = document.getElementById('bookingAlertBanner');
    if (!banner) return;

    if (!waiting.length) {
      banner.hidden = true;
      banner.replaceChildren();
      return;
    }

    const text = document.createElement('div');
    text.className = 'booking-alert-banner-text';

    const title = document.createElement('strong');
    title.textContent = waiting.length === 1
      ? 'New appointment request waiting'
      : `${waiting.length} new appointment requests waiting`;

    const detail = document.createElement('span');
    detail.textContent = waiting.length === 1
      ? describe(waiting[0])
      : `Latest: ${describe(waiting[0])}`;

    text.append(title, detail);

    const actions = document.createElement('div');
    actions.className = 'booking-alert-banner-actions';

    if (soundOn && !isAudioReady()) {
      actions.append(bannerButton('Turn on sound', 'booking-alert-banner-btn', () => {
        unlockAudio().then(playChime);
      }));
    }

    actions.append(
      bannerButton('View', 'booking-alert-banner-btn is-primary', openWaiting),
      bannerButton('OK, seen it', 'booking-alert-banner-btn', acknowledge)
    );

    banner.replaceChildren(text, actions);
    banner.hidden = false;
  }

  /* ---------- waiting list ---------- */

  function render() {
    renderBanner();
    updateFlashing();
  }

  function acknowledge() {
    waiting = [];
    closePopups();
    render();
  }

  function openWaiting() {
    const ids = waiting.map((booking) => booking.id);
    acknowledge();
    if (onOpen) onOpen(ids);
  }

  async function check() {
    if (checking || !fetchLatest) return;

    checking = true;

    try {
      const bookings = (await fetchLatest()) || [];
      const ids = bookings.map((booking) => Number(booking.id)).filter(Boolean);
      const newestId = ids.length ? Math.max(...ids) : 0;

      // The first check only records where "new" starts.
      if (lastSeenId === null) {
        lastSeenId = newestId;
        return;
      }

      // Someone already confirmed/cancelled it: stop nagging about it.
      const statusById = new Map(bookings.map((booking) => [Number(booking.id), booking.status]));
      waiting = waiting.filter((booking) => {
        const status = statusById.get(Number(booking.id));
        return status === undefined || status === 'pending';
      });

      const fresh = bookings.filter((booking) => Number(booking.id) > lastSeenId);

      if (fresh.length) {
        lastSeenId = newestId;
        waiting = [...fresh, ...waiting];

        if (!isInFront()) {
          fresh.forEach((booking) => {
            showPopup('New appointment request', describe(booking), `kp-booking-${booking.id}`);
          });
        }
      }

      // Chime for new bookings, and again on every check until acknowledged.
      const played = waiting.length && soundOn ? playChime() : false;

      render();

      if (fresh.length && onNewBookings) {
        onNewBookings(fresh, { played, soundOn });
      }
    } catch (error) {
      // A failed check is retried on the next interval; auth errors are
      // handled by the caller's fetch function.
    } finally {
      checking = false;
    }
  }

  function start(options) {
    stop();

    fetchLatest = options.fetchLatest;
    onNewBookings = options.onNewBookings || null;
    onOpen = options.onOpen || null;
    if (options.describe) describe = options.describe;
    lastSeenId = null;
    baseTitle = document.title.replace(/^\(\d+\)\s*/, '');

    check();
    timer = window.setInterval(check, POLL_INTERVAL_MS);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
    }

    timer = null;
    fetchLatest = null;
    onNewBookings = null;
    onOpen = null;
    lastSeenId = null;
    acknowledge();
  }

  function setSoundOn(value) {
    soundOn = Boolean(value);

    try {
      localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    } catch (error) {
      // Preference is kept for this page only.
    }

    if (soundOn) {
      unlockAudio();
    }

    renderBanner();
  }

  ['pointerdown', 'keydown'].forEach((eventName) => {
    document.addEventListener(eventName, unlockAudio, { passive: true });
  });

  window.addEventListener('focus', updateFlashing);
  window.addEventListener('blur', updateFlashing);
  document.addEventListener('visibilitychange', updateFlashing);

  window.KPBookingAlerts = {
    start,
    stop,
    check,
    acknowledge,
    getWaiting: () => waiting.slice(),
    isSoundOn: () => soundOn,
    setSoundOn,
    isAudioReady,
    playChime,
    unlockAudio,
    popupState,
    requestPopups,
    testPopup,
  };
})();
