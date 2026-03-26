import { API_URL } from './config.js';
import { initApp } from './initApp.js';

const getToken = () => localStorage.getItem('token');
const PAGE_SIZE = 12;

const statusLabels = {
  pending_complement: 'Pendente de complemento',
  under_review: 'Em análise',
  denied: 'Negado',
  approved: 'Aprovado'
};
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
      <div class="admin-painel-stat" title="Total de cadastros"><span class="admin-painel-stat-dot admin-painel-stat-dot--neutral"></span><span class="admin-painel-stat-label">Total</span><span class="admin-painel-stat-value">${total}</span></div>
      <div class="admin-painel-stat" title="Pendente de complemento"><span class="admin-painel-stat-dot admin-painel-stat-dot--pending"></span><span class="admin-painel-stat-label">Pendente</span><span class="admin-painel-stat-value">${b.pending_complement ?? 0}</span></div>
      <div class="admin-painel-stat" title="Em análise"><span class="admin-painel-stat-dot admin-painel-stat-dot--review"></span><span class="admin-painel-stat-label">Em análise</span><span class="admin-painel-stat-value">${b.under_review ?? 0}</span></div>
      <div class="admin-painel-stat" title="Negado"><span class="admin-painel-stat-dot admin-painel-stat-dot--denied"></span><span class="admin-painel-stat-label">Negado</span><span class="admin-painel-stat-value">${b.denied ?? 0}</span></div>
      <div class="admin-painel-stat" title="Aprovado"><span class="admin-painel-stat-dot admin-painel-stat-dot--approved"></span><span class="admin-painel-stat-label">Aprovado</span><span class="admin-painel-stat-value">${b.approved ?? 0}</span></div>
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
  el.innerHTML = `
    <span>Mostrando <strong>${from}</strong>–<strong>${to}</strong> de <strong>${total}</strong></span>
    <div class="admin-painel-page-btns">
      <button type="button" id="pagePrev" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">Anterior</button>
      <span>Página ${page} / ${totalPages}</span>
      <button type="button" id="pageNext" ${page >= totalPages ? 'disabled' : ''} aria-label="Próxima página">Próxima</button>
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
  tbody.innerHTML = '<tr><td colspan="6" class="admin-table-loading">Carregando…</td></tr>';

  const res = await fetch(`${API_URL}/api/admin/doctors?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 403) {
    window.location.href = '/client/views/login.html';
    return;
  }
  if (!res.ok) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="admin-table-empty">Não foi possível carregar a lista.</td></tr>';
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
    tbody.innerHTML =
      '<tr><td colspan="6" class="admin-table-empty">Nenhum médico encontrado para os filtros atuais.</td></tr>';
    renderPagination({ page: 1, totalPages: 1, total: 0, limit });
    return;
  }

  tbody.innerHTML = doctors
    .map((d) => {
      const st = d.validationStatus || 'pending_complement';
      const submitted = d.validationSubmittedAt
        ? new Date(d.validationSubmittedAt).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : st === 'pending_complement'
          ? 'Não enviado'
          : '—';
      return `<tr>
      <td>${escapeHtml(d.nome || '-')}</td>
      <td>${escapeHtml(d.email || '-')}</td>
      <td>${escapeHtml(d.crm || '-')}</td>
      <td><span class="badge ${statusClass[st] || 'badge-pending'}">${statusLabels[st]}</span></td>
      <td>${submitted}</td>
      <td class="admin-table-col-actions">
        <div class="admin-table-actions">
        <button type="button" class="btn-admin btn-admin--primary" data-id="${d._id}" data-action="view">Detalhes</button>
        ${
          st === 'under_review'
            ? `<button type="button" class="btn-admin btn-admin--success" data-id="${d._id}" data-action="approve" title="Aprovar">Aprovar</button><button type="button" class="btn-admin btn-admin--danger" data-id="${d._id}" data-action="deny" title="Negar">Negar</button>`
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
        title: 'Aprovado',
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
        title: 'Erro',
        text: data.message || 'Não foi possível aprovar.',
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
  await initApp({ titleKey: 'admin.title', activePage: 'adminValidation' });
  bindFilters();
  loadStats();
  loadList();
});
