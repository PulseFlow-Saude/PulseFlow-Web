import { API_URL } from './config.js';
import { initApp } from './initApp.js';

const getToken = () => localStorage.getItem('token');

let userType = '';

const validationOptions = [
  ['pending_complement', 'Pendente de complemento'],
  ['under_review', 'Em análise'],
  ['denied', 'Negado'],
  ['approved', 'Aprovado']
];

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

/** ISO ou string legada → yyyy-mm-dd para input type=date */
function formatDateOnlyForInput(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function section(title, iconClass, innerHtml) {
  return `<div class="admin-user-section">
    <h3 class="admin-user-section__title"><i class="${iconClass}" aria-hidden="true"></i> ${escapeHtml(title)}</h3>
    <div class="admin-user-section__grid">${innerHtml}</div>
  </div>`;
}

function field(name, label, value, type = 'text', extra = {}) {
  const id = `f_${name}`;
  const v = value != null ? String(value) : '';
  if (type === 'select' && extra.options) {
    const opts = extra.options
      .map(([val, lab]) => {
        const sel = String(val) === String(value ?? '') ? 'selected' : '';
        return `<option value="${escapeHtml(String(val))}" ${sel}>${escapeHtml(lab)}</option>`;
      })
      .join('');
    return `<div class="admin-user-field"><label for="${id}">${escapeHtml(label)}</label><select name="${escapeHtml(name)}" id="${id}">${opts}</select></div>`;
  }
  if (type === 'checkbox') {
    const checked = value ? 'checked' : '';
    return `<div class="admin-user-field admin-user-check"><label><input type="checkbox" name="${escapeHtml(name)}" id="${id}" ${checked} /> ${escapeHtml(label)}</label></div>`;
  }
  if (type === 'textarea') {
    return `<div class="admin-user-field admin-user-field--full"><label for="${id}">${escapeHtml(label)}</label><textarea name="${escapeHtml(name)}" id="${id}">${escapeHtml(v)}</textarea></div>`;
  }
  if (type === 'date') {
    const valAttr = formatDateOnlyForInput(value);
    return `<div class="admin-user-field"><label for="${id}">${escapeHtml(label)}</label><input type="date" name="${escapeHtml(name)}" id="${id}" value="${escapeHtml(valAttr)}" /></div>`;
  }
  let valAttr = v;
  if (type === 'datetime-local' && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      valAttr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return `<div class="admin-user-field"><label for="${id}">${escapeHtml(label)}</label><input type="${type === 'datetime-local' ? 'datetime-local' : type}" name="${escapeHtml(name)}" id="${id}" value="${escapeHtml(valAttr)}" /></div>`;
}

function renderMedicoForm(r) {
  const valOpts = validationOptions.map(([val, lab]) => [val, lab]);
  const planOpts = [
    ['', '—'],
    ['trial', 'Teste gratuito'],
    ['paid', 'Plano pago']
  ];
  const id = section(
    'Identificação',
    'fas fa-id-card',
    [
      field('nome', 'Nome completo', r.nome),
      field('email', 'E-mail', r.email, 'email'),
      field('cpf', 'CPF', r.cpf),
      field('crm', 'CRM', r.crm),
      field('areaAtuacao', 'Especialidade / área', r.areaAtuacao),
      field('genero', 'Gênero', r.genero)
    ].join('')
  );
  const cont = section(
    'Contato',
    'fas fa-phone',
    [field('telefonePessoal', 'Telefone pessoal', r.telefonePessoal), field('telefoneConsultorio', 'Telefone do consultório', r.telefoneConsultorio)].join('')
  );
  const end = section(
    'Endereço do consultório',
    'fas fa-map-marker-alt',
    [
      field('cep', 'CEP', r.cep),
      field('enderecoConsultorio', 'Logradouro', r.enderecoConsultorio),
      field('numeroConsultorio', 'Número', r.numeroConsultorio),
      field('complemento', 'Complemento', r.complemento),
      field('bairro', 'Bairro', r.bairro),
      field('cidade', 'Cidade', r.cidade),
      field('estado', 'Estado (UF)', r.estado)
    ].join('')
  );
  const val = section(
    'Validação e plano',
    'fas fa-clipboard-check',
    [
      field('validationStatus', 'Status de validação', r.validationStatus || 'pending_complement', 'select', { options: valOpts }),
      field('hasChosenPlan', 'Escolheu plano após aprovação', r.hasChosenPlan, 'checkbox'),
      field('planChoice', 'Tipo de plano', r.planChoice || '', 'select', { options: planOpts }),
      field('trialEndsAt', 'Fim do teste (trial)', r.trialEndsAt, 'datetime-local')
    ].join('')
  );
  return id + cont + end + val;
}

function renderAdminForm(r) {
  return section(
    'Identificação',
    'fas fa-user-shield',
    [
      field('nome', 'Nome', r.nome),
      field('email', 'E-mail', r.email, 'email'),
      field('crm', 'CRM', r.crm),
      field('areaAtuacao', 'Especialidade / área', r.areaAtuacao),
      field('telefonePessoal', 'Telefone', r.telefonePessoal)
    ].join('')
  );
}

function renderPacienteForm(r) {
  const id = section(
    'Identificação',
    'fas fa-user',
    [
      field('name', 'Nome', r.name || r.nome),
      field('email', 'E-mail', r.email, 'email'),
      field('cpf', 'CPF', r.cpf),
      field('birthDate', 'Data de nascimento', r.birthDate, 'date'),
      field('gender', 'Gênero', r.gender),
      field('nationality', 'Nacionalidade', r.nationality),
      field('maritalStatus', 'Estado civil', r.maritalStatus)
    ].join('')
  );
  const cont = section(
    'Contato',
    'fas fa-phone',
    [field('phone', 'Telefone', r.phone), field('secondaryPhone', 'Telefone secundário', r.secondaryPhone)].join('')
  );
  const end = section(
    'Endereço',
    'fas fa-home',
    [field('address', 'Endereço completo', r.address, 'textarea')].join('')
  );
  const out = section(
    'Outros',
    'fas fa-info-circle',
    [
      field('profession', 'Profissão', r.profession),
      field('emergencyContact', 'Contato de emergência', r.emergencyContact),
      field('emergencyPhone', 'Telefone de emergência', r.emergencyPhone)
    ].join('')
  );
  return id + cont + end + out;
}

function collectFormPayload() {
  const form = document.getElementById('userForm');
  if (!form) return {};
  const payload = {};
  const elements = form.querySelectorAll('input, select, textarea');
  elements.forEach((el) => {
    const name = el.getAttribute('name');
    if (!name) return;
    if (el.type === 'checkbox') {
      payload[name] = el.checked;
      return;
    }
    if (el.type === 'datetime-local') {
      if (el.value) payload[name] = new Date(el.value).toISOString();
      else payload[name] = null;
      return;
    }
    if (el.type === 'date') {
      payload[name] = el.value || '';
      return;
    }
    if (el.tagName === 'SELECT' && el.value === '') {
      if (name === 'planChoice') payload[name] = null;
      else payload[name] = el.value;
      return;
    }
    payload[name] = el.value;
  });
  return payload;
}

function setPageClass(type) {
  const page = document.getElementById('adminUserPage');
  if (!page) return;
  page.classList.remove('admin-user-page--medico', 'admin-user-page--paciente', 'admin-user-page--admin');
  page.classList.add(`admin-user-page--${type}`);
}

function renderChips(type, email) {
  const el = document.getElementById('detailChips');
  if (!el) return;
  const labels = {
    medico: { cls: 'admin-user-chip--medico', icon: 'fa-user-md', text: 'Médico' },
    paciente: { cls: 'admin-user-chip--paciente', icon: 'fa-heartbeat', text: 'Paciente (app)' },
    admin: { cls: 'admin-user-chip--admin', icon: 'fa-user-shield', text: 'Administrador' }
  };
  const c = labels[type] || labels.medico;
  el.innerHTML = `
    <span class="admin-user-chip ${c.cls}"><i class="fas ${c.icon}"></i> ${escapeHtml(c.text)}</span>
    ${email ? `<span class="admin-user-chip"><i class="fas fa-envelope"></i> ${escapeHtml(email)}</span>` : ''}
  `;
}

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  userType = (params.get('type') || '').toLowerCase();
  const userId = params.get('id') || '';
  const errEl = document.getElementById('detailError');
  const errText = document.getElementById('detailErrorText');
  const content = document.getElementById('detailContent');

  if (!userId || !['medico', 'paciente', 'admin'].includes(userType)) {
    errEl.style.display = 'block';
    errText.textContent = 'Parâmetros inválidos. Use type e id na URL.';
    return;
  }

  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/platform-users/${userType}/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    errEl.style.display = 'block';
    errText.textContent = 'Não foi possível carregar este usuário.';
    return;
  }

  const data = await res.json();
  const record = data.record;
  const plan = data.plan;

  const title = record.nome || record.name || 'Usuário';
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailKicker').textContent =
    userType === 'paciente' ? 'Paciente' : userType === 'admin' ? 'Administrador' : 'Médico';
  document.getElementById('detailSubtitle').textContent = record.email || '—';

  const av = document.getElementById('detailAvatar');
  if (av) av.textContent = initialsFromName(title);

  setPageClass(userType);
  renderChips(userType, record.email);

  const planCard = document.getElementById('planCard');
  const planText = document.getElementById('planText');
  if (plan && plan.label) {
    planCard.hidden = false;
    planText.textContent = plan.label;
  } else {
    planCard.hidden = true;
  }

  const linkWrap = document.getElementById('validationLinkWrap');
  const validationLink = document.getElementById('validationLink');
  if (userType === 'medico') {
    linkWrap.hidden = false;
    validationLink.href = `/client/views/admin-medico-detalhe.html?id=${encodeURIComponent(userId)}`;
  } else {
    linkWrap.hidden = true;
  }

  const formEl = document.getElementById('userForm');
  if (userType === 'medico') formEl.innerHTML = renderMedicoForm(record);
  else if (userType === 'admin') formEl.innerHTML = renderAdminForm(record);
  else formEl.innerHTML = renderPacienteForm(record);

  content.style.display = 'flex';
  errEl.style.display = 'none';
}

async function save() {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id') || '';
  const token = getToken();
  const payload = collectFormPayload();
  if (userType === 'medico' && payload.planChoice === '') {
    payload.planChoice = null;
  }
  const res = await fetch(`${API_URL}/api/admin/platform-users/${userType}/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    await Swal.fire({
      title: 'Salvo',
      text: data.message || 'Alterações gravadas.',
      icon: 'success',
      confirmButtonColor: '#002A42'
    });
    await loadDetail();
  } else {
    await Swal.fire({
      title: 'Erro',
      text: data.message || 'Não foi possível salvar.',
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
  }
}

async function deleteUser() {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id') || '';
  const r = await Swal.fire({
    title: 'Excluir conta?',
    text: 'Esta ação não pode ser desfeita. Dados vinculados (agendamentos, etc.) podem ser removidos em cascata.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#b91c1c',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;

  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/platform-users/${userType}/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    await Swal.fire({
      title: 'Removido',
      text: data.message || 'Conta excluída.',
      icon: 'success',
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/painel-usuarios.html';
  } else {
    await Swal.fire({
      title: 'Erro',
      text: data.message || 'Não foi possível excluir.',
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
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

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await ensureAdmin();
  if (!ok) return;
  await initApp({ titleKey: 'admin.title', activePage: 'adminUsers' });
  document.getElementById('btnSave')?.addEventListener('click', save);
  document.getElementById('btnDelete')?.addEventListener('click', deleteUser);
  await loadDetail();
});
