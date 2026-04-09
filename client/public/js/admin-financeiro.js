import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');
const PAGE_SIZE = 20;
let currentPage = 1;
let lastCurrency = 'BRL';

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

function formatMoney(n, currency) {
  const c = currency || 'BRL';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(Number(n) || 0);
  } catch {
    return `${Number(n).toFixed(2)} ${c}`;
  }
}

function cycleLabel(cycle) {
  if (cycle === 'yearly') return t('adminFinanceiro.cycleYearly', { fallback: 'Anual' });
  if (cycle === 'monthly') return t('adminFinanceiro.cycleMonthly', { fallback: 'Mensal' });
  return cycle || '—';
}

function methodLabel(method) {
  if (method === 'pix') return t('adminFinanceiro.methodPix', { fallback: 'Pix' });
  if (method === 'card') return t('adminFinanceiro.methodCard', { fallback: 'Cartão' });
  return method || '—';
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

function renderSummaryKpis(data) {
  const el = document.getElementById('finKpis');
  if (!el) return;
  const tot = data.totals || {};
  const gross = Number(tot.totalGross) || 0;
  const net = Number(tot.totalNet) || 0;
  const count = Number(tot.count) || 0;
  const pf = Number(tot.totalPlatformFees) || 0;
  const gf = Number(tot.totalGatewayFees) || 0;
  const fees = pf + gf;
  const ccy = lastCurrency;

  el.innerHTML = `
    <div class="admin-fin-kpi">
      <div class="admin-fin-kpi__label">${escapeHtml(t('adminFinanceiro.kpiGross', { fallback: 'Bruto' }))}</div>
      <div class="admin-fin-kpi__value">${escapeHtml(formatMoney(gross, ccy))}</div>
    </div>
    <div class="admin-fin-kpi">
      <div class="admin-fin-kpi__label">${escapeHtml(t('adminFinanceiro.kpiNet', { fallback: 'Líquido' }))}</div>
      <div class="admin-fin-kpi__value">${escapeHtml(formatMoney(net, ccy))}</div>
    </div>
    <div class="admin-fin-kpi">
      <div class="admin-fin-kpi__label">${escapeHtml(t('adminFinanceiro.kpiCount', { fallback: 'Pagamentos' }))}</div>
      <div class="admin-fin-kpi__value">${escapeHtml(String(count))}</div>
    </div>
    <div class="admin-fin-kpi">
      <div class="admin-fin-kpi__label">${escapeHtml(t('adminFinanceiro.kpiFees', { fallback: 'Taxas' }))}</div>
      <div class="admin-fin-kpi__value">${escapeHtml(formatMoney(fees, ccy))}</div>
    </div>
  `;
}

async function loadSummary() {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/financeiro/resumo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  renderSummaryKpis(data);
}

function renderPagination({ page, totalPages, total, limit }) {
  const el = document.getElementById('finPagination');
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
      <button type="button" id="finPagePrev" ${page <= 1 ? 'disabled' : ''}>${escapeHtml(t('adminValidation.prev', { fallback: 'Anterior' }))}</button>
      <span>${escapeHtml(t('adminValidation.pageLabel', { page, totalPages, fallback: `Página ${page} / ${totalPages}` }))}</span>
      <button type="button" id="finPageNext" ${page >= totalPages ? 'disabled' : ''}>${escapeHtml(t('adminValidation.next', { fallback: 'Próxima' }))}</button>
    </div>
  `;
  document.getElementById('finPagePrev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadTable();
    }
  });
  document.getElementById('finPageNext')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadTable();
    }
  });
}

function getFilters() {
  const q = document.getElementById('finSearch')?.value?.trim() || '';
  const methodRaw = document.getElementById('finMethod')?.value || '';
  const method = methodRaw === 'card' || methodRaw === 'pix' ? methodRaw : '';
  return { q, method };
}

async function loadTable() {
  const token = getToken();
  const tbody = document.getElementById('finTableBody');
  tbody.innerHTML = `<tr><td colspan="8" class="admin-table-loading">${escapeHtml(t('adminValidation.loading', { fallback: 'Carregando…' }))}</td></tr>`;

  const { q, method } = getFilters();
  const params = new URLSearchParams({
    page: String(currentPage),
    limit: String(PAGE_SIZE)
  });
  if (q) params.set('q', q);
  if (method) params.set('method', method);

  const res = await fetch(`${API_URL}/api/admin/financeiro/transacoes?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-table-empty">${escapeHtml(t('adminFinanceiro.loadError', { fallback: 'Erro' }))}</td></tr>`;
    document.getElementById('finPagination').innerHTML = '';
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const page = data.page || 1;
  const totalPages = data.totalPages || 1;
  const total = data.total ?? items.length;
  const limit = data.limit || PAGE_SIZE;
  currentPage = page;

  if (items.length && items[0].currency) {
    lastCurrency = items[0].currency;
  }

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-table-empty">${escapeHtml(t('adminFinanceiro.empty', { fallback: 'Nenhuma transação.' }))}</td></tr>`;
    renderPagination({ page: 1, totalPages: 1, total: 0, limit });
    return;
  }

  tbody.innerHTML = items
    .map((row) => {
      const ccy = row.currency || 'BRL';
      return `<tr>
      <td>${escapeHtml(formatDate(row.createdAt))}</td>
      <td>${escapeHtml(row.userNome || '—')}</td>
      <td>${escapeHtml(row.userEmail || '—')}</td>
      <td>${escapeHtml(formatMoney(row.amountGross, ccy))}</td>
      <td>${escapeHtml(formatMoney(row.netAmount, ccy))}</td>
      <td>${escapeHtml(cycleLabel(row.billingCycle))}</td>
      <td>${escapeHtml(methodLabel(row.method))}</td>
      <td>${escapeHtml(ccy)}</td>
    </tr>`;
    })
    .join('');

  renderPagination({ page, totalPages, total, limit });
}

async function exportCsv() {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/financeiro/transacoes/export.csv`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pulseflow-transacoes.csv';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await ensureAdmin())) return;
  await initApp({ titleKey: 'adminFinanceiro.pageTitle', activePage: 'adminfinance' });
  applyPageTranslations();

  document.getElementById('finApply')?.addEventListener('click', () => {
    currentPage = 1;
    loadTable();
  });
  document.getElementById('finExport')?.addEventListener('click', exportCsv);
  document.getElementById('finSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      currentPage = 1;
      loadTable();
    }
  });

  await loadSummary();
  await loadTable();
});
