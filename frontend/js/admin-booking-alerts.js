// New-booking alerts for the admin dashboard: polls for bookings newer than the
// last one seen, plays a chime and badges the tab title. Bookings come from the
// normal authenticated API, so branch-limited accounts only hear their branches.

(function () {
  'use strict';

  const POLL_INTERVAL_MS = 30000;
  const SOUND_KEY = 'kp_booking_alert_sound';

  let timer = null;
  let fetchLatest = null;
  let onNewBookings = null;
  let lastSeenId = null;
  let checking = false;
  let unreadCount = 0;
  let audioContext = null;
  let baseTitle = document.title;

  function readSoundSetting() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (error) {
      return true;
    }
  }

  let soundOn = readSoundSetting();

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
      return context.resume().catch(() => {});
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

  function updateTitle() {
    document.title = unreadCount ? `(${unreadCount}) ${baseTitle}` : baseTitle;
  }

  function clearUnread() {
    if (!unreadCount) return;

    unreadCount = 0;
    updateTitle();
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

      const fresh = bookings.filter((booking) => Number(booking.id) > lastSeenId);

      if (!fresh.length) return;

      lastSeenId = newestId;

      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        unreadCount += fresh.length;
        updateTitle();
      }

      const played = soundOn ? playChime() : false;

      if (onNewBookings) {
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
    onNewBookings = options.onNewBookings;
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
    lastSeenId = null;
    clearUnread();
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
  }

  ['pointerdown', 'keydown'].forEach((eventName) => {
    document.addEventListener(eventName, unlockAudio, { passive: true });
  });

  window.addEventListener('focus', clearUnread);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') clearUnread();
  });

  window.KPBookingAlerts = {
    start,
    stop,
    check,
    isSoundOn: () => soundOn,
    setSoundOn,
    isAudioReady,
    playChime,
    unlockAudio,
  };
})();
