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

function previewText(msg, max = 120) {
  const s = String(msg || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
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

async function loadList() {
  const token = getToken();
  const tbody = document.getElementById('ctTableBody');
  tbody.innerHTML = `<tr><td colspan="5" class="admin-table-loading">${escapeHtml(t('adminValidation.loading', { fallback: 'Carregando…' }))}</td></tr>`;

  const res = await fetch(`${API_URL}/api/admin/contact-messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">${escapeHtml(t('adminContact.loadError', { fallback: 'Erro' }))}</td></tr>`;
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">${escapeHtml(t('adminContact.empty', { fallback: 'Nenhuma mensagem.' }))}</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map(
      (row, idx) => `
    <tr>
      <td>${escapeHtml(formatDate(row.createdAt))}</td>
      <td>${escapeHtml(row.name || '')}</td>
      <td>${escapeHtml(row.email || '')}</td>
      <td><span class="admin-inbox-msg-preview">${escapeHtml(previewText(row.message))}</span></td>
      <td class="admin-table-col-actions">
        <button type="button" class="btn-admin btn-admin--primary btn-admin--sm js-ct-view" data-idx="${idx}">${escapeHtml(t('adminContact.btnView', { fallback: 'Ver' }))}</button>
        <button type="button" class="btn-admin btn-admin--danger btn-admin--sm js-ct-remove" data-idx="${idx}">${escapeHtml(t('adminContact.btnRemove', { fallback: 'Excluir' }))}</button>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('.js-ct-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      const row = items[idx];
      if (!row) return;
      const html = `<div style="text-align:left"><p><strong>${escapeHtml(row.name || '')}</strong> &lt;${escapeHtml(row.email || '')}&gt;</p><p style="margin-top:1rem;white-space:pre-wrap">${escapeHtml(row.message || '')}</p></div>`;
      Swal.fire({
        title: t('adminContact.modalTitle', { fallback: 'Mensagem' }),
        html,
        width: 'min(560px, 92vw)',
        confirmButtonText: t('adminContact.close', { fallback: 'Fechar' }),
        confirmButtonColor: '#002A42'
      });
    });
  });

  tbody.querySelectorAll('.js-ct-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.getAttribute('data-idx'));
      const row = items[idx];
      const id = row && row.id ? String(row.id) : '';
      if (!id) return;
      const ok = await Swal.fire({
        title: t('adminContact.btnRemove', { fallback: 'Excluir' }),
        text: t('adminContact.removeConfirm', { fallback: 'Excluir esta mensagem?' }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#b91c1c',
        cancelButtonColor: '#002A42'
      });
      if (!ok.isConfirmed) return;
      const del = await fetch(`${API_URL}/api/admin/contact-messages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (del.ok) {
        Swal.fire({ icon: 'success', title: t('adminContact.removed', { fallback: 'Excluída.' }), confirmButtonColor: '#002A42' });
        loadList();
      } else {
        const err = await del.json().catch(() => ({}));
        Swal.fire({ icon: 'error', text: err.message || 'Erro', confirmButtonColor: '#002A42' });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await ensureAdmin())) return;
  await initApp({ titleKey: 'adminContact.pageTitle', activePage: 'admincontatos' });
  applyPageTranslations();
  loadList();
});
