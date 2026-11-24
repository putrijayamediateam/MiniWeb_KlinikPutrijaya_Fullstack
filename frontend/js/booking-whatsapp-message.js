// Builds the WhatsApp message staff send to a patient from the Bookings
// inbox. The wording follows the booking status and reads like a person
// typing it: Puan/Encik by gender, first name only, the date said the way
// people say it ("esok", "Jumaat ni") and no booking reference.
// Pure functions only; no DOM access. Also loadable in Node for checks.

(function (root) {
  'use strict';

  const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const MONTHS = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
  ];

  // Words that start the father's name in Malaysian names.
  const PATRONYMIC = /^(bin|binti|bt|bte|bnt|b|a\/l|a\/p|al|ap|s\/o|d\/o)\.?$/i;

  function titleCase(word) {
    // Capitalise after a hyphen too ("AL-AMIN" -> "Al-Amin"); after an apostrophe stays small ("Nur'ain").
    return String(word || '').toLowerCase().replace(/(^|-)(\p{L})/gu, (match, mark, letter) => mark + letter.toUpperCase());
  }

  // "NADZIRAH BINTI YAHYA" -> "Nadzirah"; "Nur Aisyah binti Ali" -> "Nur Aisyah".
  function callingName(fullName) {
    const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    const cut = words.findIndex((word, index) => index > 0 && PATRONYMIC.test(word));
    const given = cut > 0 ? words.slice(0, cut) : words;
    return given.slice(0, cut > 0 ? 2 : 3).map(titleCase).join(' ');
  }

  // Branch names in the database may already include "Klinik Putrijaya".
  function clinicName(branchName) {
    const branch = String(branchName || '').replace(/^\s*klinik\s+putrijaya\s*/i, '').trim();
    return branch ? `Klinik Putrijaya ${branch}` : 'Klinik Putrijaya';
  }

  function honorific(gender) {
    if (gender === 'female') return 'Puan';
    if (gender === 'male') return 'Encik';
    return '';
  }

  function dateParts(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function daysBetween(fromDate, toDate) {
    return Math.round((toDate - fromDate) / 86400000);
  }

  // "hari ni", "esok", "hari Jumaat ni, 11 Disember" or "Jumaat, 11 Disember".
  function spokenDay(appointmentDate, today) {
    const date = dateParts(appointmentDate);
    const now = dateParts(today);
    if (!date) return '';

    const label = `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
    if (!now) return label;

    const diff = daysBetween(now, date);
    if (diff === 0) return 'hari ni';
    if (diff === 1) return 'esok';
    if (diff === -1) return 'semalam';
    if (diff > 1 && diff < 7) return `hari ${DAYS[date.getUTCDay()]} ni, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
    return label;
  }

  // "18:30" -> "6.30 petang"; "09:00" -> "9 pagi".
  function spokenTime(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    if (!match) return '';

    const hours = Number(match[1]);
    const minutes = match[2];
    const hour12 = ((hours + 11) % 12) + 1;
    let period = 'malam';
    if (hours < 12) period = 'pagi';
    else if (hours < 14) period = 'tengah hari';
    else if (hours < 19) period = 'petang';

    return `${minutes === '00' ? hour12 : `${hour12}.${minutes}`} ${period}`;
  }

  // Phone as typed by the patient -> digits for wa.me (country code, no "+").
  // "+65 9123 4567" / "0065..." keep their own country code; Malaysian
  // numbers ("012-345 6789", "6012...", "12-345 6789") become 60...
  function whatsappNumber(phone) {
    const raw = String(phone || '').trim();
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (raw.startsWith('+')) return digits;
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('60')) return digits;
    if (digits.startsWith('0')) return `6${digits}`;
    return `60${digits}`;
  }

  /**
   * @param {object} booking  patient_name, gender, branch_name, status,
   *                          preferred_date (YYYY-MM-DD), preferred_time (HH:MM)
   * @param {string} today    clinic date, YYYY-MM-DD
   */
  function buildMessage(booking, today) {
    const title = honorific(booking.gender);
    const name = callingName(booking.patient_name);
    const who = [title, name].filter(Boolean).join(' ');
    const you = title ? title.toLowerCase() : 'tuan/puan';
    const clinic = clinicName(booking.branch_name);
    const day = spokenDay(booking.preferred_date, today);
    // "esok" / "hari ni" / "semalam" read on their own; a full date needs "pada".
    const onDay = !day || /^(hari |esok|semalam)/.test(day) ? day : `pada ${day}`;
    const time = spokenTime(booking.preferred_time);
    const when = [onDay, time && `pukul ${time}`].filter(Boolean).join(', ');
    const greeting = who ? `Assalamualaikum ${who}` : 'Assalamualaikum';
    const appointment = dateParts(booking.preferred_date);
    const now = dateParts(today);
    const isPast = Boolean(appointment && now && appointment < now);

    // A pending or confirmed booking whose day has gone: offer a new slot
    // instead of asking them to come or reminding them of a past date.
    if (isPast && (booking.status === 'pending' || booking.status === 'confirmed')) {
      return (
        `${greeting}, saya dari ${clinic}. Temujanji ${you} ${when} dah lepas. ` +
        `Kalau ${you} masih nak datang, bagitahu je masa yang sesuai, nanti kami aturkan semula ya.`
      );
    }

    switch (booking.status) {
      case 'confirmed':
        return (
          `${who ? `Hi ${who}` : 'Hi'}, ${clinic} ni. Nak ingatkan, ${you} ada temujanji ` +
          `${when} ya. Kalau ada apa-apa perubahan, WhatsApp je kami. ` +
          `Jumpa ${day === 'esok' ? 'esok' : 'nanti'} 😊`
        );

      case 'completed':
        return (
          `${greeting}, terima kasih sebab datang ke ${clinic}` +
          `${day === 'hari ni' ? ' tadi' : ''}. Semoga cepat sembuh ya. ` +
          `Kalau ada apa-apa soalan lepas rawatan, WhatsApp je kami.`
        );

      case 'cancelled':
        return (
          `${greeting}, saya dari ${clinic}. Temujanji ${you} ${when} dah dibatalkan. ` +
          `Kalau ${you} nak buat temujanji baru, bagitahu je masa yang sesuai, nanti kami aturkan ya.`
        );

      case 'pending':
      default:
        return (
          `${greeting}, saya dari ${clinic}. ${titleCase(you)} ada buat temujanji dengan kami ` +
          `${when} kan? Saya nak confirmkan, ${you} boleh datang ya?`
        );
    }
  }

  const api = { buildMessage, whatsappNumber, callingName, clinicName, spokenDay, spokenTime };

  root.KPBookingWhatsApp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
