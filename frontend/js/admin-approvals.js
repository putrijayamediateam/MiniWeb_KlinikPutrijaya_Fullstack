'use strict';

const TOKEN_KEY = 'kp_admin_token';
let authedApi = null;

const accessCard = document.getElementById('accessCard');
const approvalPanel = document.getElementById('approvalPanel');
const pendingAccounts = document.getElementById('pendingAccounts');
const pendingSummary = document.getElementById('pendingSummary');
const approvalMessage = document.getElementById('approvalMessage');
const refreshBtn = document.getElementById('refreshBtn');

document.addEventListener('DOMContentLoaded', initialise);
refreshBtn?.addEventListener('click', loadPendingAccounts);

async function initialise() {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (!token) {
    showAccessError('Please log in before opening the approval page.');
    return;
  }

  authedApi = KPApi.withAuth(token);

  try {
    const profile = await authedApi.getMyAdminProfile();

    if (String(profile.role || '').toLowerCase() !== 'superadmin') {
      showAccessError('This page is restricted to the Klinik Putrijaya superadmin.');
      return;
    }

    accessCard.className = 'status-card success';
    accessCard.textContent = `Signed in as ${profile.email || profile.username} · Superadmin`;
    approvalPanel.hidden = false;
    await loadPendingAccounts();
  } catch (error) {
    showAccessError(error.message || 'Unable to verify superadmin access.');
  }
}

async function loadPendingAccounts() {
  if (!authedApi) return;

  setMessage('');
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';
  pendingAccounts.innerHTML = '<div class="empty-card">Loading pending accounts…</div>';

  try {
    const response = await authedApi.getPendingAdmins();
    renderAccounts(response.data || []);
  } catch (error) {
    setMessage(error.message || 'Unable to load pending accounts.', 'error');
    pendingAccounts.innerHTML = '';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
}

function renderAccounts(accounts) {
  pendingSummary.textContent = `${accounts.length} account${accounts.length === 1 ? '' : 's'} awaiting approval`;

  if (!accounts.length) {
    pendingAccounts.innerHTML = '<div class="empty-card">No verified accounts are waiting for approval.</div>';
    return;
  }

  pendingAccounts.innerHTML = accounts.map((account) => `
    <article class="account-card" data-id="${account.id}">
      <div class="account-main">
        <div class="avatar">${escapeHtml((account.email || '?').charAt(0).toUpperCase())}</div>
        <div>
          <h3>${escapeHtml(account.email || 'No email')}</h3>
          <p>Username: ${escapeHtml(account.username || '—')}</p>
          <div class="meta-row">
            <span>${escapeHtml(account.auth_provider || 'local')}</span>
            <span>Email verified</span>
            <span>${formatDate(account.email_verified_at || account.created_at)}</span>
          </div>
        </div>
      </div>
      <div class="account-actions">
        <button type="button" class="reject-button" data-action="reject" data-id="${account.id}">Reject</button>
        <button type="button" class="approve-button" data-action="approve" data-id="${account.id}">Approve</button>
      </div>
    </article>
  `).join('');

  pendingAccounts.querySelectorAll('[data-action="approve"]').forEach((button) => {
    button.addEventListener('click', () => approveAccount(button));
  });

  pendingAccounts.querySelectorAll('[data-action="reject"]').forEach((button) => {
    button.addEventListener('click', () => rejectAccount(button));
  });
}

async function approveAccount(button) {
  const id = Number(button.dataset.id);
  const card = button.closest('.account-card');
  const email = card?.querySelector('h3')?.textContent || 'this account';

  if (!window.confirm(`Approve ${email} as an administrator?`)) return;

  setCardLoading(card, true);
  try {
    const response = await authedApi.approveAdmin(id);
    setMessage(response.message || 'Account approved.', 'success');
    await loadPendingAccounts();
  } catch (error) {
    setMessage(error.message || 'Unable to approve this account.', 'error');
    setCardLoading(card, false);
  }
}

async function rejectAccount(button) {
  const id = Number(button.dataset.id);
  const card = button.closest('.account-card');
  const email = card?.querySelector('h3')?.textContent || 'this account';
  const reason = window.prompt(`Reason for rejecting ${email} (optional):`, '') ?? null;

  if (reason === null) return;

  setCardLoading(card, true);
  try {
    const response = await authedApi.rejectAdmin(id, reason);
    setMessage(response.message || 'Account rejected.', 'success');
    await loadPendingAccounts();
  } catch (error) {
    setMessage(error.message || 'Unable to reject this account.', 'error');
    setCardLoading(card, false);
  }
}

function setCardLoading(card, loading) {
  card?.querySelectorAll('button').forEach((button) => {
    button.disabled = loading;
  });
}

function showAccessError(message) {
  accessCard.className = 'status-card error';
  accessCard.textContent = message;
  approvalPanel.hidden = true;
}

function setMessage(message, type = '') {
  approvalMessage.textContent = message;
  approvalMessage.className = `message ${type}`.trim();
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
