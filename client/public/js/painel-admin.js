import { API_URL } from './config.js';
import { initApp } from './initApp.js';

const getToken = () => localStorage.getItem('token');
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

let currentDoctorId = null;

async function loadList() {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }
  const status = document.getElementById('filterStatus')?.value || '';
  const url = status ? `${API_URL}/api/admin/doctors?status=${encodeURIComponent(status)}` : `${API_URL}/api/admin/doctors`;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  if (res.status === 403) {
    window.location.href = '/client/views/login.html';
    return;
  }
  if (!res.ok) {
    document.getElementById('adminTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Erro ao carregar.</td></tr>';
    return;
  }
  const doctors = await res.json();
  const tbody = document.getElementById('adminTableBody');
  if (!doctors.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Nenhum médico encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = doctors.map(d => {
    const status = d.validationStatus || 'pending_complement';
    const submitted = d.validationSubmittedAt
      ? new Date(d.validationSubmittedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : (status === 'pending_complement' ? 'Não enviado' : '—');
    return `<tr>
      <td>${escapeHtml(d.nome || '-')}</td>
      <td>${escapeHtml(d.email || '-')}</td>
      <td>${escapeHtml(d.crm || '-')}</td>
      <td><span class="badge ${statusClass[status] || 'badge-pending'}">${statusLabels[status]}</span></td>
      <td>${submitted}</td>
      <td>
        <button type="button" class="btn-sm btn-view" data-id="${d._id}" data-action="view">Ver</button>
        ${status === 'under_review' ? `<button type="button" class="btn-sm btn-approve" data-id="${d._id}" data-action="approve">Aprovar</button><button type="button" class="btn-sm btn-deny" data-id="${d._id}" data-action="deny">Negar</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'view') openDetail(id);
      else if (action === 'approve') doApprove(id);
      else if (action === 'deny') openDetail(id, true);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function openDetail(id, showDeny = false) {
  currentDoctorId = id;
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${id}`, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) return;
  const { doctor, documents, history } = await res.json();
  const docStatus = doctor.validationStatus || 'pending_complement';

  document.getElementById('modalDoctorName').textContent = doctor.nome || 'Médico';
  const html = `
    <dl><dt>E-mail</dt><dd>${escapeHtml(doctor.email)}</dd></dl>
    <dl><dt>CPF</dt><dd>${escapeHtml(doctor.cpf)}</dd></dl>
    <dl><dt>CRM</dt><dd>${escapeHtml(doctor.crm)}</dd></dl>
    <dl><dt>Especialidade</dt><dd>${escapeHtml(doctor.areaAtuacao)}</dd></dl>
    <dl><dt>Telefone</dt><dd>${escapeHtml(doctor.telefonePessoal)}</dd></dl>
    <dl><dt>Status</dt><dd><span class="badge ${statusClass[docStatus]}">${statusLabels[docStatus]}</span></dd></dl>
    ${doctor.validationDeniedReason ? `<dl><dt>Motivo da recusa</dt><dd>${escapeHtml(doctor.validationDeniedReason)}</dd></dl>` : ''}
    <dt style="margin-top:1rem;">Documentos anexados</dt>
    <dd>
      <ul class="doc-list">
        ${(documents || []).map(d => `<li><a href="${d.url}" target="_blank" rel="noopener">${d.type} (${d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : ''})</a></li>`).join('') || '<li>Nenhum</li>'}
      </ul>
    </dd>
    <dt>Histórico de análises</dt>
    <dd>
      <ul class="doc-list">
        ${(history || []).slice(0, 5).map(h => `<li>${statusLabels[h.status] || h.status} - ${new Date(h.decidedAt).toLocaleString('pt-BR')}</li>`).join('') || '<li>Nenhum</li>'}
      </ul>
    </dd>
  `;
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalDenyBlock').style.display = showDeny ? 'block' : 'none';
  document.getElementById('denyReason').value = '';
  document.getElementById('modalApproveBtn').style.display = docStatus === 'under_review' ? 'inline-block' : 'none';
  document.getElementById('modalDenyBtn').style.display = docStatus === 'under_review' ? 'inline-block' : 'none';
  document.getElementById('detailModal').classList.add('active');

  document.getElementById('modalApproveBtn').onclick = () => doApprove(id);
  document.getElementById('modalDenyBtn').onclick = () => doDeny(id);
}

async function doApprove(id) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${id}/approve`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (res.ok) {
    if (typeof Swal !== 'undefined') Swal.fire({ title: 'Aprovado', text: data.message, icon: 'success', confirmButtonColor: '#002A42' });
    document.getElementById('detailModal').classList.remove('active');
    loadList();
  } else {
    if (typeof Swal !== 'undefined') Swal.fire({ title: 'Erro', text: data.message || 'Não foi possível aprovar.', icon: 'error', confirmButtonColor: '#002A42' });
  }
}

async function doDeny(id) {
  const reason = document.getElementById('denyReason')?.value?.trim();
  if (!reason || reason.length < 10) {
    if (typeof Swal !== 'undefined') Swal.fire({ title: 'Atenção', text: 'Informe o motivo da recusa (mínimo 10 caracteres).', icon: 'warning', confirmButtonColor: '#002A42' });
    return;
  }
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${id}/deny`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (res.ok) {
    if (typeof Swal !== 'undefined') Swal.fire({ title: 'Negado', text: data.message, icon: 'info', confirmButtonColor: '#002A42' });
    document.getElementById('detailModal').classList.remove('active');
    loadList();
  } else {
    if (typeof Swal !== 'undefined') Swal.fire({ title: 'Erro', text: data.message || 'Não foi possível negar.', icon: 'error', confirmButtonColor: '#002A42' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/usuarios/perfil`, { headers: { 'Authorization': 'Bearer ' + token } });
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
  await initApp({ titleKey: 'admin.title', activePage: 'admin' });
  document.getElementById('filterStatus')?.addEventListener('change', loadList);
  document.getElementById('closeModalBtn')?.addEventListener('click', () => document.getElementById('detailModal').classList.remove('active'));
  document.getElementById('modalCloseBtn2')?.addEventListener('click', () => document.getElementById('detailModal').classList.remove('active'));
  document.getElementById('detailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') e.target.classList.remove('active');
  });
  loadList();
});
