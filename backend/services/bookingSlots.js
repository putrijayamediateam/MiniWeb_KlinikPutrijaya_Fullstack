'use strict';

/*
  Appointment time slots.

  Each branch offers 30-minute slots from opening time until the last
  slot that ends at closing time. A slot can hold one booking per
  branch per day; cancelled bookings free their slot again.

  Branch hours live here (matched on the branch slug, or its name as a
  fallback). Update this table when a branch changes its hours.
*/

const SLOT_MINUTES = 30;
const BOOKING_WINDOW_DAYS = 90;
const CLINIC_TIME_ZONE = 'Asia/Kuala_Lumpur';

const BRANCH_HOURS = {
  cheras: { opens: '08:00', closes: '23:00' },
  'sungai-besi': { opens: '08:00', closes: '22:00' },
  puchong: { opens: '08:00', closes: '22:00' },
};

const DEFAULT_HOURS = { opens: '08:00', closes: '22:00' };

function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function hoursForBranch(branch) {
  const slug = String(branch?.slug || '').trim().toLowerCase();

  if (BRANCH_HOURS[slug]) {
    return BRANCH_HOURS[slug];
  }

  const name = String(branch?.name || '').toLowerCase();
  const matched = Object.keys(BRANCH_HOURS).find((key) => name.includes(key.replace('-', ' ')));

  return matched ? BRANCH_HOURS[matched] : DEFAULT_HOURS;
}

/** Slot start times ("HH:MM") for a branch. */
function slotTimesForBranch(branch) {
  const { opens, closes } = hoursForBranch(branch);
  const times = [];

  for (let start = toMinutes(opens); start + SLOT_MINUTES <= toMinutes(closes); start += SLOT_MINUTES) {
    times.push(toTime(start));
  }

  return times;
}

/** "HH:MM" from "HH:MM" or "HH:MM:SS"; null when invalid. */
function normalizeTime(value) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value || '').trim());

  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

/** "YYYY-MM-DD" when the value is a real calendar date; null otherwise. */
function normalizeDate(value) {
  const text = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

/** Current date and minute-of-day at the clinic. */
function clinicNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Whether patients may book this date (today up to the booking window). */
function isBookableDate(date, now = clinicNow()) {
  return date >= now.date && date <= addDays(now.date, BOOKING_WINDOW_DAYS);
}

/** Whether a slot on this date has already started. */
function isPastSlot(date, time, now = clinicNow()) {
  return date < now.date || (date === now.date && toMinutes(time) <= now.minutes);
}

/**
 * Taken slot times ("HH:MM") for a branch and date. Pass a transaction
 * connection to read inside the same lock as an insert.
 */
async function getTakenTimes(queryable, branchId, date) {
  const [rows] = await queryable.query(
    `SELECT DISTINCT TIME_FORMAT(preferred_time, '%H:%i') AS slot
     FROM bookings
     WHERE branch_id = ?
       AND preferred_date = ?
       AND status <> 'cancelled'`,
    [branchId, date]
  );

  return new Set(rows.map((row) => row.slot));
}

module.exports = {
  SLOT_MINUTES,
  clinicNow,
  getTakenTimes,
  isBookableDate,
  isPastSlot,
  normalizeDate,
  normalizeTime,
  slotTimesForBranch,
};
