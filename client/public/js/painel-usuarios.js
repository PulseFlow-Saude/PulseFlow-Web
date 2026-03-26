import { API_URL } from './config.js';
import { initApp } from './initApp.js';

const getToken = () => localStorage.getItem('token');
const PAGE_SIZE = 15;

const typeLabels = {
  medico: 'Médico',
  paciente: 'Paciente',
  admin: 'Admin'
};

const typeBadgeClass = {
  medico: 'admin-user-type-badge--medico',
  paciente: 'admin-user-type-badge--paciente',
  admin: 'admin-user-type-badge--admin'
};

let currentPage = 1;
let searchDebounceTimer = null;

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function detailUserUrl(type, id) {
  const q = new URLSearchParams({ type, id });
  return `/client/views/admin-usuario-detalhe.html?${q.toString()}`;
}

async function loadStats() {
  const token = getToken();
  const el = document.getElementById('platformStatsRow');
  if (!el) return;
  try {
    const res = await fetch(`${API_URL}/api/admin/platform-users/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      el.innerHTML = '';
      return;
    }
    const { totalUsers, medicos, admins, pacientes } = await res.json();
    el.innerHTML = `
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--neutral"></span><span class="admin-painel-stat-label">Total</span><span class="admin-painel-stat-value">${totalUsers ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--review"></span><span class="admin-painel-stat-label">Médicos</span><span class="admin-painel-stat-value">${medicos ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--pending"></span><span class="admin-painel-stat-label">Pacientes</span><span class="admin-painel-stat-value">${pacientes ?? 0}</span></div>
      <div class="admin-painel-stat"><span class="admin-painel-stat-dot admin-painel-stat-dot--approved"></span><span class="admin-painel-stat-label">Admins</span><span class="admin-painel-stat-value">${admins ?? 0}</span></div>
    `;
  } catch {
    el.innerHTML = '';
  }
}

function renderPagination({ page, totalPages, total, limit }) {
  const el = document.getElementById('usersPagination');
  if (!el) return;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  el.innerHTML = `
    <span>Mostrando <strong>${from}</strong>–<strong>${to}</strong> de <strong>${total}</strong></span>
    <div class="admin-painel-page-btns">
      <button type="button" id="pagePrevUsers" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">Anterior</button>
      <span>Página ${page} / ${totalPages}</span>
      <button type="button" id="pageNextUsers" ${page >= totalPages ? 'disabled' : ''} aria-label="Próxima página">Próxima</button>
    </div>
  `;

  document.getElementById('pagePrevUsers')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadList();
    }
  });
  document.getElementById('pageNextUsers')?.addEventListener('click', () => {
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

  const userType = document.getElementById('filterUserType')?.value || 'all';
  const q = document.getElementById('searchUsers')?.value?.trim() || '';

  const params = new URLSearchParams();
  params.set('type', userType);
  if (q) params.set('q', q);
  params.set('page', String(currentPage));
  params.set('limit', String(PAGE_SIZE));

  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="admin-table-loading">Carregando…</td></tr>';

  const res = await fetch(`${API_URL}/api/admin/platform-users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 403) {
    window.location.href = '/client/views/login.html';
    return;
  }
  if (!res.ok) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="admin-table-empty">Não foi possível carregar a lista.</td></tr>';
    document.getElementById('usersPagination').innerHTML = '';
    return;
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const total = typeof data.total === 'number' ? data.total : items.length;
  const page = data.page || 1;
  const limit = data.limit || PAGE_SIZE;
  const totalPages = data.totalPages || Math.max(1, Math.ceil(total / limit));
  currentPage = page;

  if (!items.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="admin-table-empty">Nenhum usuário encontrado.</td></tr>';
    renderPagination({ page: 1, totalPages: 1, total: 0, limit });
    return;
  }

  tbody.innerHTML = items
    .map((row) => {
      const t = row.type || 'medico';
      const label = typeLabels[t] || t;
      const badgeClass = typeBadgeClass[t] || 'admin-user-type-badge--medico';
      const created = row.createdAt
        ? new Date(row.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const summary = row.planLabel || row.validationStatus || '—';
      return `<tr>
        <td><span class="admin-user-type-badge ${badgeClass}">${escapeHtml(label)}</span></td>
        <td>${escapeHtml(row.nome || '—')}</td>
        <td>${escapeHtml(row.email || '—')}</td>
        <td><span class="admin-user-summary">${escapeHtml(String(summary))}</span></td>
        <td>${escapeHtml(created)}</td>
        <td class="admin-table-col-actions">
          <div class="admin-table-actions">
            <button type="button" class="btn-admin btn-admin--primary" data-type="${escapeHtml(t)}" data-id="${row._id}">Abrir perfil</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = detailUserUrl(btn.dataset.type, btn.dataset.id);
    });
  });

  renderPagination({ page, totalPages, total, limit });
}

function bindFilters() {
  document.getElementById('filterUserType')?.addEventListener('change', () => {
    currentPage = 1;
    loadList();
  });
  document.getElementById('searchUsers')?.addEventListener('input', () => {
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
  } catch {
    window.location.href = '/client/views/login.html';
    return;
  }
  await initApp({ titleKey: 'admin.usersTitle', activePage: 'adminUsers' });
  bindFilters();
  loadStats();
  loadList();
});
