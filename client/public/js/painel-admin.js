import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');
const PAGE_SIZE = 12;

function statusLabel(st) {
  const map = {
    pending_complement: 'adminValidation.filterPending',
    under_review: 'adminValidation.filterReview',
    denied: 'adminValidation.filterDenied',
    approved: 'adminValidation.filterApproved'
  };
  const key = map[st] || map.pending_complement;
  return t(key, { fallback: st });
}
const statusClass = {
  pending_complement: 'badge-pending',
  under_review: 'badge-review',
  denied: 'badge-denied',
  approved: 'badge-approved'
};

let currentPage = 1;
let searchDebounceTimer = null;

function detailUrl(id, focusDeny = false) {
  const q = new URLSearchParams({ id });
  if (focusDeny) q.set('focus', 'deny');
  return `/client/views/admin-medico-detalhe.html?${q.toString()}`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function isUSDoctor(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const c = String(doc.country ?? '')
    .trim()
    .toUpperCase();
  if (c === 'US') return true;
  if (c === 'BR') return false;
  const npi = String(doc.npi || '').replace(/\D/g, '');
  const hasCrm = String(doc.crm || '').trim().length > 0;
  return npi.length === 10 && !hasCrm;
}

function countryLabelShort(d) {
  return isUSDoctor(d)
    ? t('adminValidation.countryUs', { fallback: 'EUA' })
    : t('adminValidation.countryBr', { fallback: 'Brasil' });
}

/** Coluna da lista: CRM+UF (BR) ou NPI (US). */
function formatRegistroProfissional(d) {
  if (isUSDoctor(d)) {
    const npi = String(d.npi || '').replace(/\D/g, '');
    if (npi.length === 10) return `NPI ${npi}`;
    const lic = String(d.medicalLicenseNumber || '').trim();
    return lic || '—';
  }
  const crm = String(d.crm || '').trim();
  const uf = String(d.crmUf || '').trim().toUpperCase();
  if (crm && uf) return `${crm}-${uf}`;
  if (crm) return crm;
  if (uf) return uf;
  return '—';
}

async function loadStats() {
  const token = getToken();
  const el = document.getElementById('adminStatsRow');
  if (!el) return;
  try {
    const res = await fetch(`${API_URL}/api/admin/doctors/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      el.innerHTML = '';
      return;
    }
    const { total, byStatus } = await res.json();
    const b = byStatus || {};
    el.innerHTML = `
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--neutral"></span><span class="admin-painel-stat-label">${escapeHtml(t('adminValidation.statTotal', { fallback: 'Total' }))}</span><span class="admin-painel-stat-value">${total}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--pending"></span><span class="admin-painel-stat-label">${escapeHtml(t('adminValidation.statPending', { fallback: 'Pendente' }))}</span><span class="admin-painel-stat-value">${b.pending_complement ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--review"></span><span class="admin-painel-stat-label">${escapeHtml(t('adminValidation.statReview', { fallback: 'Em análise' }))}</span><span class="admin-painel-stat-value">${b.under_review ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--denied"></span><span class="admin-painel-stat-label">${escapeHtml(t('adminValidation.statDenied', { fallback: 'Negado' }))}</span><span class="admin-painel-stat-value">${b.denied ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--approved"></span><span class="admin-painel-stat-label">${escapeHtml(t('adminValidation.statApproved', { fallback: 'Aprovado' }))}</span><span class="admin-painel-stat-value">${b.approved ?? 0}</span></div>
    `;
  } catch {
    el.innerHTML = '';
  }
}

function renderPagination({ page, totalPages, total, limit }) {
  const el = document.getElementById('adminPagination');
  if (!el) return;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const rangeText = escapeHtml(
    t('adminValidation.paginationFrom', {
      from,
      to,
      total,
      fallback: `Mostrando ${from} a ${to} de ${total}`
    })
  );
  el.innerHTML = `
    <span>${rangeText}</span>
    <div class="admin-painel-page-btns">
      <button type="button" id="pagePrev" ${page <= 1 ? 'disabled' : ''} aria-label="${escapeHtml(t('adminValidation.pagePrev', { fallback: 'Página anterior' }))}">${escapeHtml(t('adminValidation.prev', { fallback: 'Anterior' }))}</button>
      <span>${escapeHtml(t('adminValidation.pageLabel', { page, totalPages, fallback: `Página ${page} / ${totalPages}` }))}</span>
      <button type="button" id="pageNext" ${page >= totalPages ? 'disabled' : ''} aria-label="${escapeHtml(t('adminValidation.pageNext', { fallback: 'Próxima página' }))}">${escapeHtml(t('adminValidation.next', { fallback: 'Próxima' }))}</button>
    </div>
  `;

  document.getElementById('pagePrev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadList();
    }
  });
  document.getElementById('pageNext')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadList();
    }
  });
}

async function loadList() {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }

  const status = document.getElementById('filterStatus')?.value || '';
  const q = document.getElementById('searchDoctors')?.value?.trim() || '';
  const sortField = document.getElementById('sortField')?.value || 'enviado';
  const sortOrder = document.getElementById('sortOrder')?.value || 'desc';

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  params.set('page', String(currentPage));
  params.set('limit', String(PAGE_SIZE));
  params.set('sort', sortField);
  params.set('order', sortOrder);

  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="admin-table-loading">${escapeHtml(t('adminValidation.loading', { fallback: 'Carregando…' }))}</td></tr>`;

  const res = await fetch(`${API_URL}/api/admin/doctors?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 403) {
    window.location.href = '/client/views/login.html';
    return;
  }
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">${escapeHtml(t('adminValidation.loadError', { fallback: 'Não foi possível carregar a lista.' }))}</td></tr>`;
    document.getElementById('adminPagination').innerHTML = '';
    return;
  }

  const data = await res.json();
  const doctors = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
  const total = typeof data.total === 'number' ? data.total : doctors.length;
  const page = data.page || 1;
  const limit = data.limit || PAGE_SIZE;
  const totalPages = data.totalPages || Math.max(1, Math.ceil(total / limit));
  currentPage = page;

  if (!doctors.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">${escapeHtml(t('adminValidation.empty', { fallback: 'Nenhum médico encontrado para os filtros atuais.' }))}</td></tr>`;
    renderPagination({ page: 1, totalPages: 1, total: 0, limit });
    return;
  }

  const dateLocale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  tbody.innerHTML = doctors
    .map((d) => {
      const st = d.validationStatus || 'pending_complement';
      const submitted = d.validationSubmittedAt
        ? new Date(d.validationSubmittedAt).toLocaleString(dateLocale, {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : st === 'pending_complement'
          ? t('adminValidation.notSent', { fallback: 'Não enviado' })
          : '—';
      const lbl = statusLabel(st);
      const btnDetails = escapeHtml(t('adminValidation.btnDetails', { fallback: 'Detalhes' }));
      const btnAp = escapeHtml(t('adminValidation.btnApprove', { fallback: 'Aprovar' }));
      const btnDn = escapeHtml(t('adminValidation.btnDeny', { fallback: 'Negar' }));
      return `<tr>
      <td>${escapeHtml(d.nome || '-')}</td>
      <td>${escapeHtml(d.email || '-')}</td>
      <td>${escapeHtml(countryLabelShort(d))}</td>
      <td>${escapeHtml(formatRegistroProfissional(d))}</td>
      <td><span class="badge ${statusClass[st] || 'badge-pending'}">${escapeHtml(lbl)}</span></td>
      <td>${escapeHtml(submitted)}</td>
      <td class="admin-table-col-actions">
        <div class="admin-table-actions">
        <button type="button" class="btn-admin btn-admin--primary" data-id="${d._id}" data-action="view">${btnDetails}</button>
        ${
          st === 'under_review'
            ? `<button type="button" class="btn-admin btn-admin--success" data-id="${d._id}" data-action="approve" title="${btnAp}">${btnAp}</button><button type="button" class="btn-admin btn-admin--danger" data-id="${d._id}" data-action="deny" title="${btnDn}">${btnDn}</button>`
            : ''
        }
        </div>
      </td>
    </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'view') {
        window.location.href = detailUrl(id);
      } else if (action === 'approve') {
        doApprove(id);
      } else if (action === 'deny') {
        window.location.href = detailUrl(id, true);
      }
    });
  });

  renderPagination({ page, totalPages, total, limit });
}

async function doApprove(id) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: t('adminValidation.approveTitle', { fallback: 'Aprovado' }),
        text: data.message,
        icon: 'success',
        confirmButtonColor: '#002A42'
      });
    }
    loadStats();
    loadList();
  } else {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: t('adminValidation.denyTitle', { fallback: 'Erro' }),
        text: data.message || t('adminValidation.approveFail', { fallback: 'Não foi possível aprovar.' }),
        icon: 'error',
        confirmButtonColor: '#002A42'
      });
    }
  }
}

function bindFilters() {
  document.getElementById('filterStatus')?.addEventListener('change', () => {
    currentPage = 1;
    loadList();
  });
  document.getElementById('sortField')?.addEventListener('change', () => {
    currentPage = 1;
    loadList();
  });
  document.getElementById('sortOrder')?.addEventListener('change', () => {
    currentPage = 1;
    loadList();
  });
  document.getElementById('searchDoctors')?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentPage = 1;
      loadList();
    }, 350);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const perfil = await res.json();
    const isAdmin = perfil.role === 'admin' || perfil.isAdmin === true;
    if (!isAdmin) {
      window.location.href = '/client/views/login.html';
      return;
    }
    localStorage.setItem('isAdmin', 'true');
  } catch (e) {
    window.location.href = '/client/views/login.html';
    return;
  }
  await initApp({ titleKey: 'admin.pageTitle', activePage: 'adminvalidation' });
  bindFilters();
  loadStats();
  loadList();
});
