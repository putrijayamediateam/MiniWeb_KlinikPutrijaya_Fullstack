// Bookings tab: inbox list, booking detail panel and day calendar.
// admin.js owns authentication, toasts and the shared booking helpers and
// passes them in through init(). Patient text is always set with
// textContent, never as HTML.

(function () {
  'use strict';

  const STATUS_CLASS = {
    pending: 'is-pending',
    confirmed: 'is-confirmed',
    completed: 'is-completed',
    cancelled: 'is-cancelled',
  };

  let deps = null;

  const state = {
    view: 'pending',
    page: 1,
    limit: 20,
    filterKey: '',
    bookings: [],
    selectedId: null,
    selected: null,
    calendarDate: '',
  };

  /* ---------- small helpers ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function clinicToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  }

  function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  function dateOnly(value) {
    return String(value || '').slice(0, 10);
  }

  function formatDay(value) {
    const date = dateOnly(value);
    if (!date) return '—';
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatTime(value) {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || ''));
    if (!match) return value ? String(value) : '—';
    const hours = Number(match[1]);
    return `${((hours + 11) % 12) + 1}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
  }

  function formatReceived(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function whatsappLink(booking) {
    let digits = String(booking.phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = `6${digits}`;
    else if (!digits.startsWith('60')) digits = `60${digits}`;

    // Wording follows the booking status (js/booking-whatsapp-message.js).
    const message = window.KPBookingWhatsApp.buildMessage(booking, clinicToday());

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  function whatsappIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z');
    svg.append(path);
    return svg;
  }

  function statusPill(status) {
    const pill = el('span', `inbox-status ${STATUS_CLASS[status] || ''}`, deps.formatStatus(status));
    return pill;
  }

  function allowedBranches() {
    const branches = deps.getBranches() || [];
    const allowed = deps.getAllowedBranchIds();
    return allowed.length
      ? branches.filter((branch) => allowed.includes(Number(branch.id)))
      : branches;
  }

  /* ---------- list ---------- */

  function currentFilters() {
    const filters = {
      branch: byId('bookingBranchFilter')?.value || '',
      q: byId('bookingSearchInput')?.value.trim() || '',
    };

    if (state.view === 'pending') {
      filters.status = 'pending';
    } else if (state.view === 'today') {
      filters.date = clinicToday();
      filters.status = byId('bookingStatusFilter')?.value || '';
    } else {
      filters.status = byId('bookingStatusFilter')?.value || '';
    }

    return filters;
  }

  async function load() {
    const api = deps?.getApi();
    const list = byId('bookingInboxList');
    if (!api || !list) return;

    const filters = currentFilters();
    const key = JSON.stringify({ view: state.view, ...filters });

    if (key !== state.filterKey) {
      state.filterKey = key;
      state.page = 1;
    }

    if (!state.bookings.length) {
      list.replaceChildren(el('li', 'inbox-empty', 'Loading bookings…'));
    }

    try {
      const response = await api.getBookings({
        ...filters,
        page: state.page,
        limit: state.limit,
      });

      state.bookings = response.data || [];
      renderTabs(response.summary || {});
      renderList();
      renderPager(response.pagination);

      const stillListed = state.bookings.find((item) => item.id === state.selectedId);

      if (stillListed) {
        selectBooking(stillListed, false);
      } else if (state.selected && state.selectedId) {
        // Keep showing a booking opened from the calendar, refreshed.
        selectBooking(state.selected, false);
      } else if (state.bookings[0] && window.matchMedia('(min-width: 900px)').matches) {
        selectBooking(state.bookings[0], false);
      } else {
        renderDetail(null);
      }
    } catch (error) {
      if (!deps.handleAuthError(error)) {
        list.replaceChildren(el('li', 'inbox-empty', error.message || 'Unable to load bookings.'));
      }
    }

    refreshCalendar();
  }

  function renderTabs(summary) {
    const pendingCount = byId('bookingInboxPendingCount');
    if (pendingCount) pendingCount.textContent = String(summary.pending ?? 0);

    const tabCount = byId('bookingTabCount');
    if (tabCount) {
      tabCount.textContent = String(summary.pending || 0);
      tabCount.hidden = !summary.pending;
    }

    [
      ['summaryTotal', summary.total],
      ['summaryPending', summary.pending],
      ['summaryConfirmed', summary.confirmed],
      ['summaryCompleted', summary.completed],
      ['summaryCancelled', summary.cancelled],
    ].forEach(([id, value]) => {
      const node = byId(id);
      if (node) node.textContent = String(value || 0);
    });

    document.querySelectorAll('[data-inbox-view]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.inboxView === state.view));
    });

    const statusFilter = byId('bookingStatusFilter');
    if (statusFilter) statusFilter.hidden = state.view === 'pending';
  }

  function renderList() {
    const list = byId('bookingInboxList');

    if (!state.bookings.length) {
      const message = state.view === 'pending'
        ? 'No pending bookings. You are all caught up.'
        : 'No bookings match these filters.';
      list.replaceChildren(el('li', 'inbox-empty', message));
      return;
    }

    list.replaceChildren(...state.bookings.map((booking) => {
      const item = el('li');
      const button = el('button', 'inbox-item');
      button.type = 'button';
      button.dataset.id = String(booking.id);
      button.setAttribute('aria-current', String(booking.id === state.selectedId));

      const dot = el('span', `inbox-dot ${STATUS_CLASS[booking.status] || ''}`);
      dot.setAttribute('aria-hidden', 'true');

      const body = el('span', 'inbox-item-body');
      const top = el('span', 'inbox-item-top');
      top.append(
        el('strong', 'inbox-item-name', booking.patient_name || 'Unnamed patient'),
        el('span', 'inbox-item-received', formatReceived(booking.created_at))
      );

      body.append(
        top,
        el('span', 'inbox-item-service', booking.service_title || 'General consultation'),
        el('span', 'inbox-item-meta',
          `${formatDay(booking.preferred_date)} · ${formatTime(booking.preferred_time)} · ${booking.branch_name || ''}`)
      );

      button.append(dot, body);
      button.addEventListener('click', () => selectBooking(booking, true));
      item.append(button);
      return item;
    }));
  }

  function renderPager(pagination) {
    const pager = byId('bookingInboxPager');
    if (!pager || !pagination) return;

    const summary = el('span', '', `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} bookings`);
    const previous = el('button', 'inbox-page-btn', '‹');
    const next = el('button', 'inbox-page-btn', '›');

    previous.type = 'button';
    next.type = 'button';
    previous.setAttribute('aria-label', 'Previous page');
    next.setAttribute('aria-label', 'Next page');
    previous.disabled = !pagination.hasPrevious;
    next.disabled = !pagination.hasNext;
    previous.addEventListener('click', () => { state.page -= 1; load(); });
    next.addEventListener('click', () => { state.page += 1; load(); });

    const buttons = el('span', 'inbox-page-buttons');
    buttons.append(previous, next);
    pager.replaceChildren(summary, buttons);
  }

  /* ---------- detail ---------- */

  function selectBooking(booking, userAction) {
    state.selectedId = booking.id;
    state.selected = booking;

    document.querySelectorAll('.inbox-item').forEach((item) => {
      item.setAttribute('aria-current', String(Number(item.dataset.id) === booking.id));
    });

    renderDetail(booking);

    if (userAction && !window.matchMedia('(min-width: 900px)').matches) {
      byId('bookingInboxDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function detailField(label, value, wide) {
    const wrap = el('div', wide ? 'inbox-field is-wide' : 'inbox-field');
    wrap.append(el('dt', '', label), el('dd', '', value || '—'));
    return wrap;
  }

  function actionButton(label, className, handler) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function renderDetail(booking) {
    const panel = byId('bookingInboxDetail');
    if (!panel) return;

    if (!booking) {
      const empty = el('div', 'inbox-detail-empty');
      empty.append(
        el('h3', '', 'Select a booking'),
        el('p', '', 'Choose a booking from the list or the calendar to see its details.')
      );
      panel.replaceChildren(empty);
      return;
    }

    const header = el('div', 'inbox-detail-head');
    const titleWrap = el('div', 'inbox-detail-title');
    titleWrap.append(
      statusPill(booking.status),
      el('h3', '', booking.patient_name || 'Unnamed patient'),
      el('p', '', `${deps.formatRef(booking.id)} · received ${formatReceived(booking.created_at) || '—'}`)
    );

    const primary = el('div', 'inbox-detail-primary');

    if (booking.status === 'pending') {
      primary.append(actionButton('Confirm booking', 'inbox-btn is-dark', () => changeStatus(booking, 'confirmed')));
    } else if (booking.status === 'confirmed') {
      primary.append(actionButton('Mark completed', 'inbox-btn is-dark', () => changeStatus(booking, 'completed')));
    }

    const whatsapp = whatsappLink(booking);

    if (whatsapp) {
      const label = `WhatsApp ${booking.patient_name || 'pesakit'}`;
      const link = el('a', 'inbox-whatsapp');
      link.href = whatsapp;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = label;
      link.setAttribute('aria-label', label);
      link.append(whatsappIcon());
      primary.append(link);
    }

    header.append(titleWrap, primary);

    const summary = el('div', 'inbox-detail-summary');
    [
      ['Appointment', `${formatDay(booking.preferred_date)} · ${formatTime(booking.preferred_time)}`],
      ['Branch', booking.branch_name || '—'],
      ['Service', booking.service_title || 'General consultation'],
    ].forEach(([label, value]) => {
      const item = el('div');
      item.append(el('span', 'inbox-summary-label', label), el('span', 'inbox-summary-value', value));
      summary.append(item);
    });

    const fields = el('dl', 'inbox-fields');
    fields.append(
      detailField('Phone', booking.phone),
      detailField('Gender', deps.formatGender(booking.gender)),
      detailField(
        'Identification',
        `${deps.formatIdentityType(booking.identity_type)} · ${booking.identity_number || booking.ic_number || '—'}`
      ),
      detailField('Preferred doctor', booking.doctor_name || 'Any doctor'),
      detailField('Reason for visit', booking.reason || 'No reason provided.', true)
    );

    const footer = el('div', 'inbox-detail-foot');
    const secondary = el('div', 'inbox-detail-secondary');

    const statusLabel = el('label', 'inbox-status-select');
    statusLabel.append(el('span', 'visually-hidden', 'Change status'));
    const select = el('select');
    ['pending', 'confirmed', 'completed', 'cancelled'].forEach((status) => {
      const option = new Option(deps.formatStatus(status), status);
      option.selected = status === booking.status;
      select.append(option);
    });
    select.addEventListener('change', () => changeStatus(booking, select.value));
    statusLabel.append(select);

    secondary.append(statusLabel, actionButton('View ticket', 'inbox-btn is-outline is-small', () => deps.openTicket(booking)));
    footer.append(secondary);

    const danger = el('div', 'inbox-detail-secondary');

    if (booking.status !== 'cancelled' && booking.status !== 'completed') {
      danger.append(actionButton('Cancel booking', 'inbox-btn is-text-danger', () => changeStatus(booking, 'cancelled')));
    }

    if (deps.canDelete()) {
      danger.append(actionButton('Delete', 'inbox-btn is-text-danger', () => deleteBooking(booking)));
    }

    footer.append(danger);
    panel.replaceChildren(header, summary, fields, footer);
  }

  async function changeStatus(booking, nextStatus) {
    if (nextStatus === booking.status) return;

    if (nextStatus === 'cancelled') {
      const confirmed = await deps.confirmStatusChange({
        title: `Cancel ${deps.formatRef(booking.id)}?`,
        message: 'The booking will be marked as cancelled and its time slot becomes free for other patients.',
        confirmText: 'Cancel booking',
      });

      if (!confirmed) {
        renderDetail(booking);
        return;
      }
    }

    try {
      await deps.getApi().updateBookingStatus(booking.id, nextStatus);
      state.selected = { ...booking, status: nextStatus };
      deps.toast({
        title: 'Booking status updated',
        message: `${deps.formatRef(booking.id)} is now ${deps.formatStatus(nextStatus)}.`,
        duration: 4500,
      });
      await load();
    } catch (error) {
      if (!deps.handleAuthError(error)) {
        deps.toast({ title: 'Unable to update booking', message: error.message || 'Please try again.', duration: 7000 });
      }
      renderDetail(booking);
    }
  }

  async function deleteBooking(booking) {
    const confirmed = await deps.confirmDelete({
      title: `Delete ${deps.formatRef(booking.id)}?`,
      message: `The booking for ${booking.patient_name || 'this patient'} will be permanently removed. This action cannot be undone.`,
    });

    if (!confirmed) return;

    try {
      await deps.getApi().deleteBooking(booking.id);
      state.selectedId = null;
      state.selected = null;
      deps.toast({ title: 'Booking deleted', message: `${deps.formatRef(booking.id)} has been permanently removed.`, duration: 5000 });
      await load();
    } catch (error) {
      if (!deps.handleAuthError(error)) {
        deps.toast({ title: 'Unable to delete booking', message: error.message || 'Please try again.', duration: 7000 });
      }
    }
  }

  /* ---------- day calendar ---------- */

  function populateCalendarBranches() {
    const select = byId('bookingCalendarBranch');
    if (!select) return;

    const previous = select.value;
    const branches = allowedBranches();

    select.replaceChildren(...branches.map((branch) => new Option(branch.name, String(branch.id))));

    if (branches.some((branch) => String(branch.id) === previous)) {
      select.value = previous;
    }
  }

  async function refreshCalendar() {
    const grid = byId('bookingCalendarGrid');
    const branchSelect = byId('bookingCalendarBranch');
    const dateInput = byId('bookingCalendarDate');
    if (!grid || !branchSelect || !dateInput) return;

    if (!branchSelect.options.length) populateCalendarBranches();

    const branchId = branchSelect.value;
    const date = dateInput.value || clinicToday();
    dateInput.value = date;
    byId('bookingCalendarLabel').textContent = formatDay(date);

    if (!branchId) {
      grid.replaceChildren(el('p', 'inbox-empty', 'No branch available.'));
      return;
    }

    const requestKey = `${branchId}|${date}`;
    grid.dataset.request = requestKey;

    try {
      const [availability, bookings] = await Promise.all([
        KPApi.getBookingAvailability(branchId, date),
        deps.getApi().getBookings({ branch: branchId, date, limit: 200 }),
      ]);

      if (grid.dataset.request !== requestKey) return;

      // Active bookings by slot; cancelled ones no longer hold a slot.
      const bySlot = new Map();
      (bookings.data || [])
        .filter((booking) => booking.status !== 'cancelled')
        .forEach((booking) => bySlot.set(String(booking.preferred_time || '').slice(0, 5), booking));

      const now = clinicToday();
      const nowMinutes = (() => {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
      })();

      let bookedCount = 0;

      grid.replaceChildren(...(availability.slots || []).map((slot) => {
        const booking = bySlot.get(slot.time);
        const [hours, minutes] = slot.time.split(':').map(Number);
        const isPast = date < now || (date === now && hours * 60 + minutes <= nowMinutes);

        if (booking) {
          bookedCount += 1;
          const chip = el('button', `calendar-slot is-booked ${STATUS_CLASS[booking.status] || ''}`);
          chip.type = 'button';
          chip.append(
            el('span', 'calendar-slot-time', formatTime(slot.time)),
            el('span', 'calendar-slot-name', booking.patient_name || 'Booked')
          );
          chip.setAttribute('aria-label', `${formatTime(slot.time)}, ${booking.patient_name || 'booked'}, ${deps.formatStatus(booking.status)}`);
          chip.addEventListener('click', () => selectBooking(booking, true));
          return chip;
        }

        const chip = el('div', `calendar-slot ${isPast ? 'is-past' : 'is-free'}`);
        chip.append(
          el('span', 'calendar-slot-time', formatTime(slot.time)),
          el('span', 'calendar-slot-name', isPast ? '—' : 'Free')
        );
        return chip;
      }));

      byId('bookingCalendarCount').textContent =
        `${bookedCount} of ${(availability.slots || []).length} slots booked`;
    } catch (error) {
      if (grid.dataset.request !== requestKey) return;
      if (!deps.handleAuthError(error)) {
        grid.replaceChildren(el('p', 'inbox-empty', error.message || 'Unable to load the calendar.'));
      }
    }
  }

  function shiftCalendar(days) {
    const dateInput = byId('bookingCalendarDate');
    dateInput.value = addDays(dateInput.value || clinicToday(), days);
    refreshCalendar();
  }

  /* ---------- setup ---------- */

  function init(options) {
    deps = options;

    document.querySelectorAll('[data-inbox-view]').forEach((tab) => {
      tab.addEventListener('click', () => {
        state.view = tab.dataset.inboxView;
        load();
      });
    });

    populateCalendarBranches();
    byId('bookingCalendarDate').value = clinicToday();
    byId('bookingCalendarBranch')?.addEventListener('change', refreshCalendar);
    byId('bookingCalendarDate')?.addEventListener('change', refreshCalendar);
    byId('bookingCalendarPrev')?.addEventListener('click', () => shiftCalendar(-1));
    byId('bookingCalendarNext')?.addEventListener('click', () => shiftCalendar(1));
    byId('bookingCalendarToday')?.addEventListener('click', () => {
      byId('bookingCalendarDate').value = clinicToday();
      refreshCalendar();
    });
  }

  window.KPBookingsInbox = {
    init,
    load,
    refreshCalendar,
    populateCalendarBranches,
    isReady: () => Boolean(deps),
  };
})();
