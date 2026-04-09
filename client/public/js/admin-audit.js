import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');
const PAGE_SIZE = 25;
let currentPage = 1;

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function formatDate(iso) {
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso || '—';
  }
}

function actionLabel(action) {
  const map = {
    newsletter_remove: 'adminAudit.actionNewsletterRemove',
    contact_remove: 'adminAudit.actionContactRemove',
    doctor_approve: 'adminAudit.actionDoctorApprove',
    doctor_deny: 'adminAudit.actionDoctorDeny'
  };
  const key = map[action];
  return key ? t(key, { fallback: action }) : action;
}

async function ensureAdmin() {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  const perfil = await res.json();
  if (perfil.role !== 'admin' && perfil.isAdmin !== true) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  localStorage.setItem('isAdmin', 'true');
  return true;
}

function renderPagination({ page, totalPages, total, limit }) {
  const el = document.getElementById('auditPagination');
  if (!el) return;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  el.innerHTML = `
    <span>${escapeHtml(
      t('adminValidation.paginationFrom', {
        from,
        to,
        total,
        fallback: `Mostrando ${from}–${to} de ${total}`
      })
    )}</span>
    <div class="admin-painel-page-btns">
      <button type="button" id="auditPagePrev" ${page <= 1 ? 'disabled' : ''}>${escapeHtml(t('adminValidation.prev', { fallback: 'Anterior' }))}</button>
      <span>${escapeHtml(t('adminValidation.pageLabel', { page, totalPages, fallback: `Página ${page} / ${totalPages}` }))}</span>
      <button type="button" id="auditPageNext" ${page >= totalPages ? 'disabled' : ''}>${escapeHtml(t('adminValidation.next', { fallback: 'Próxima' }))}</button>
    </div>
  `;
  document.getElementById('auditPagePrev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadList();
    }
  });
  document.getElementById('auditPageNext')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadList();
    }
  });
}

async function loadList() {
  const token = getToken();
  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = `<tr><td colspan="4" class="admin-table-loading">${escapeHtml(t('adminValidation.loading', { fallback: 'Carregando…' }))}</td></tr>`;

  const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) });
  const res = await fetch(`${API_URL}/api/admin/audit-log?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('adminAudit.loadError', { fallback: 'Erro' }))}</td></tr>`;
    document.getElementById('auditPagination').innerHTML = '';
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const page = data.page || 1;
  const totalPages = data.totalPages || 1;
  const total = data.total ?? items.length;
  const limit = data.limit || PAGE_SIZE;
  currentPage = page;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('adminAudit.empty', { fallback: 'Nenhum registro.' }))}</td></tr>`;
    renderPagination({ page: 1, totalPages: 1, total: 0, limit });
    return;
  }

  tbody.innerHTML = items
    .map((row) => {
      const detail = row.detail && typeof row.detail === 'object' ? JSON.stringify(row.detail) : String(row.detail || '');
      return `<tr>
      <td>${escapeHtml(formatDate(row.at))}</td>
      <td>${escapeHtml(actionLabel(row.action))}</td>
      <td class="admin-audit-detail">${escapeHtml(detail)}</td>
      <td>${escapeHtml(row.adminUserId || '—')}</td>
    </tr>`;
    })
    .join('');

  renderPagination({ page, totalPages, total, limit });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await ensureAdmin())) return;
  await initApp({ titleKey: 'adminAudit.pageTitle', activePage: 'adminaudit' });
  applyPageTranslations();
  loadList();
});
