import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function formatDate(iso) {
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso || '—';
  }
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
  const isAdmin = perfil.role === 'admin' || perfil.isAdmin === true;
  if (!isAdmin) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  localStorage.setItem('isAdmin', 'true');
  return true;
}

async function loadList() {
  const token = getToken();
  const tbody = document.getElementById('nlTableBody');
  tbody.innerHTML = `<tr><td colspan="4" class="admin-table-loading">${escapeHtml(t('adminValidation.loading', { fallback: 'Carregando…' }))}</td></tr>`;

  const res = await fetch(`${API_URL}/api/admin/newsletter-subscribers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('adminNewsletter.loadError', { fallback: 'Erro ao carregar.' }))}</td></tr>`;
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('adminNewsletter.empty', { fallback: 'Nenhum inscrito.' }))}</td></tr>`;
    return;
  }
  tbody.innerHTML = items
    .map(
      (row, idx) => `
    <tr>
      <td>${escapeHtml(row.email || '')}</td>
      <td>${escapeHtml(formatDate(row.subscribedAt))}</td>
      <td>${escapeHtml(row.source || '—')}</td>
      <td class="admin-table-col-actions">
        <button type="button" class="btn-admin btn-admin--danger btn-admin--sm js-nl-remove" data-idx="${idx}">${escapeHtml(t('adminNewsletter.btnRemove', { fallback: 'Remover' }))}</button>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('.js-nl-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.getAttribute('data-idx'));
      const row = items[idx];
      const email = row && typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      if (!email) return;
      const ok = await Swal.fire({
        title: t('adminNewsletter.btnRemove', { fallback: 'Remover' }),
        text: t('adminNewsletter.removeConfirm', { fallback: 'Remover este e-mail?' }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#b91c1c',
        cancelButtonColor: '#002A42'
      });
      if (!ok.isConfirmed) return;
      const del = await fetch(`${API_URL}/api/admin/newsletter-subscribers`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      if (del.ok) {
        Swal.fire({ icon: 'success', title: t('adminNewsletter.removed', { fallback: 'Removido.' }), confirmButtonColor: '#002A42' });
        loadList();
      } else {
        const err = await del.json().catch(() => ({}));
        Swal.fire({ icon: 'error', text: err.message || 'Erro', confirmButtonColor: '#002A42' });
      }
    });
  });
}

async function exportCsv() {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/newsletter-subscribers/export.csv`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    Swal.fire({ icon: 'error', text: t('adminNewsletter.loadError', { fallback: 'Erro' }), confirmButtonColor: '#002A42' });
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pulseflow-newsletter.csv';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await ensureAdmin())) return;
  await initApp({ titleKey: 'adminNewsletter.pageTitle', activePage: 'adminnewsletter' });
  applyPageTranslations();
  document.getElementById('btnExportCsv')?.addEventListener('click', () => exportCsv());
  loadList();
});
