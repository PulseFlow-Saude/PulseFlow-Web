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

/** BR vs EUA: usa `country` e, se ausento, infere por NPI/CRM. */
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

function getDocTypeLabels(isUS) {
  return {
    crm: 'Documento de CRM',
    state_license: 'Licença médica estadual (US)',
    npi_proof: 'Comprovante NPI',
    document_with_photo: isUS
      ? 'Documento oficial com foto (passaporte / carteira de motorista / ID)'
      : 'Documento com foto (RG, CNH ou similar)',
    other: 'Outro documento'
  };
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(jpe?g|png|gif|webp)($|\?)/i.test(url.split('?')[0]);
}

function isPdfUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.pdf($|\?)/i.test(url.split('?')[0]);
}

/** URL absoluta do backend (API já devolve absoluta; fallback para paths relativos). */
function resolveDocUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  const base = API_URL.replace(/\/$/, '');
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function dash(v) {
  if (v === undefined || v === null || String(v).trim() === '') return '—';
  return String(v).trim();
}

function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function appendDl(container, pairs) {
  container.innerHTML = pairs
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(dash(v))}</dd>`)
    .join('');
}

let doctorId = null;

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

function renderDocuments(documents, isUS) {
  const el = document.getElementById('blockDocs');
  const typeLabels = getDocTypeLabels(!!isUS);
  if (!documents || documents.length === 0) {
    el.innerHTML = '<div class="admin-empty-docs">Nenhum documento anexado ainda.</div>';
    return;
  }

  el.innerHTML = `<ul class="admin-doc-list" role="list">${documents
    .map((d) => {
      const label = typeLabels[d.type] || d.type;
      const raw = (d.url || '').trim();
      const resolved = resolveDocUrl(raw);
      const safeHref = escapeAttr(resolved);

      let thumb = '';
      if (!resolved) {
        thumb =
          '<div class="admin-doc-row-thumb admin-doc-row-thumb--empty" aria-hidden="true"><i class="fas fa-unlink"></i></div>';
      } else if (isImageUrl(resolved)) {
        thumb = `<div class="admin-doc-row-thumb admin-doc-row-thumb--image">
            <img class="admin-doc-thumb-img" src="${safeHref}" alt="" loading="lazy" decoding="async"
              onerror="this.style.visibility='hidden';var fb=this.nextElementSibling;if(fb)fb.style.display='flex';" />
            <span class="admin-doc-thumb-fallback" style="display:none;" aria-hidden="true"><i class="fas fa-image"></i></span>
          </div>`;
      } else if (isPdfUrl(resolved)) {
        thumb = `<div class="admin-doc-row-thumb admin-doc-row-thumb--pdf" aria-hidden="true"><i class="fas fa-file-pdf"></i></div>`;
      } else {
        thumb = `<div class="admin-doc-row-thumb admin-doc-row-thumb--icon" aria-hidden="true"><i class="fas fa-file-alt"></i></div>`;
      }

      const fileLabel = d.originalName || label;
      const dateStr = d.uploadedAt
        ? new Date(d.uploadedAt).toLocaleString('pt-BR')
        : '';

      return `
        <li class="admin-doc-row">
          ${thumb}
          <div class="admin-doc-row-body">
            <span class="admin-doc-row-type">${escapeHtml(label)}</span>
            <span class="admin-doc-row-name" title="${escapeHtml(fileLabel)}">${escapeHtml(fileLabel)}</span>
            ${dateStr ? `<span class="admin-doc-row-meta">${escapeHtml(dateStr)}</span>` : ''}
          </div>
          <div class="admin-doc-row-actions">
            ${
              resolved
                ? `<a class="admin-doc-row-link" href="${safeHref}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Abrir</a>`
                : '<span class="admin-doc-row-na">Sem URL</span>'
            }
          </div>
        </li>`;
    })
    .join('')}</ul>`;
}

function responsibleLabel(h) {
  if (h.decidedBy && (h.decidedBy.nome || h.decidedBy.email)) {
    return escapeHtml(String(h.decidedBy.nome || h.decidedBy.email || '').trim() || '—');
  }
  if (h.status === 'under_review') {
    return '<span class="admin-detail-history-note">Envio do médico</span>';
  }
  return '—';
}

function renderHistory(history) {
  const tbody = document.getElementById('blockHistory');
  if (!history || history.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="admin-table-empty">Nenhum registro de histórico.</td></tr>';
    return;
  }
  tbody.innerHTML = history
    .map((h) => {
      const st = statusLabels[h.status] || h.status;
      const badgeClass = statusClass[h.status] || 'badge-pending';
      const when = h.decidedAt ? new Date(h.decidedAt).toLocaleString('pt-BR') : '—';
      const reason = h.reason ? escapeHtml(h.reason) : '—';
      return `<tr>
        <td>${escapeHtml(when)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(st)}</span></td>
        <td class="admin-detail-history-reason">${reason}</td>
        <td class="admin-detail-history-who">${responsibleLabel(h)}</td>
      </tr>`;
    })
    .join('');
}

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  doctorId = params.get('id');
  const focusDeny = params.get('focus') === 'deny';

  const errEl = document.getElementById('detailError');
  const errText = document.getElementById('detailErrorText');
  const content = document.getElementById('detailContent');

  if (!doctorId) {
    errEl.style.display = 'block';
    errText.textContent = 'ID do médico não informado. Volte à lista e selecione novamente.';
    return;
  }

  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${doctorId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    errEl.style.display = 'block';
    errText.textContent = 'Não foi possível carregar os dados deste médico.';
    return;
  }

  const { doctor, documents, history } = await res.json();
  const st = doctor.validationStatus || 'pending_complement';

  document.getElementById('detailPageTitle').textContent = doctor.nome || 'Médico';
  const isUS = isUSDoctor(doctor);
  let registroLinha = '—';
  if (isUS) {
    const npi = String(doctor.npi || '').replace(/\D/g, '');
    const lic = dash(doctor.medicalLicenseNumber);
    const stateDash = dash(doctor.medicalLicenseState);
    const parts = [];
    if (npi.length === 10) parts.push(`NPI ${npi}`);
    if (lic !== '—') parts.push(`Lic. ${lic}`);
    if (stateDash !== '—') parts.push(String(doctor.medicalLicenseState || '').trim().toUpperCase());
    registroLinha = parts.length ? parts.join(' · ') : '—';
  } else {
    const crm = String(doctor.crm || '').trim();
    const uf = String(doctor.crmUf || '').trim().toUpperCase();
    if (crm && uf) registroLinha = `CRM ${crm}-${uf}`;
    else if (crm) registroLinha = `CRM ${crm}`;
    else registroLinha = '—';
  }
  document.getElementById('detailSubtitleLine').textContent = `${doctor.email || '—'} · ${registroLinha}`;
  const av = document.getElementById('detailAvatar');
  if (av) av.textContent = initialsFromName(doctor.nome || '');
  document.getElementById('detailChips').innerHTML = `
    <span class="admin-user-chip admin-user-chip--medico"><i class="fas fa-stethoscope"></i> Médico</span>
    <span class="admin-user-chip">${isUS ? 'EUA' : 'Brasil'}</span>
    <span class="badge ${statusClass[st] || 'badge-pending'}">${escapeHtml(statusLabels[st] || st)}</span>
  `;
  const editLink = document.getElementById('editProfileLink');
  if (editLink && doctorId) {
    editLink.href = `/client/views/admin-usuario-detalhe.html?type=medico&id=${encodeURIComponent(doctorId)}`;
  }

  const pessoalPairs = [
    ['País do cadastro', isUS ? 'Estados Unidos (EUA)' : 'Brasil'],
    ['Nome completo', doctor.nome],
    ['E-mail', doctor.email],
    ...(isUS ? [] : [['CPF', doctor.cpf]]),
    ['Gênero', doctor.genero],
    ['Telefone pessoal', doctor.telefonePessoal]
  ];
  appendDl(document.getElementById('blockPessoal'), pessoalPairs);

  const countryTag = isUS ? ' — EUA' : ' — Brasil';
  const detailBlocks = document.querySelectorAll('.admin-detail-info-wrap .admin-detail-info-block');
  if (detailBlocks.length >= 3) {
    const titles = [
      ['fa-id-card', `Dados pessoais${countryTag}`],
      ['fa-briefcase-medical', `Dados profissionais${countryTag}`],
      ['fa-map-marker-alt', `Endereço do consultório${countryTag}`]
    ];
    titles.forEach(([icon, title], i) => {
      const h2 = detailBlocks[i].querySelector('h2');
      if (h2) h2.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(title)}`;
    });
  }

  if (isUS) {
    appendDl(document.getElementById('blockProf'), [
      ['NPI', doctor.npi ? String(doctor.npi).replace(/\D/g, '') : ''],
      ['Número da licença médica (US)', doctor.medicalLicenseNumber],
      ['Estado da licença (US)', doctor.medicalLicenseState],
      ['Especialidade / área', doctor.areaAtuacao],
      ['Telefone do consultório', doctor.telefoneConsultorio]
    ]);
    appendDl(document.getElementById('blockEndereco'), [
      ['ZIP', doctor.cep],
      ['Endereço (linha 1)', doctor.enderecoConsultorio],
      ['Número', doctor.numeroConsultorio],
      ['Complemento', doctor.complemento],
      ['Cidade', doctor.cidade],
      ['Estado (US)', doctor.estado]
    ]);
  } else {
    const rqeStr = Array.isArray(doctor.rqe) && doctor.rqe.length ? doctor.rqe.join(', ') : '';
    appendDl(document.getElementById('blockProf'), [
      ['CRM', doctor.crm],
      ['UF do CRM', doctor.crmUf],
      ['Especialidade / área', doctor.areaAtuacao],
      ['RQE', rqeStr],
      ['Telefone do consultório', doctor.telefoneConsultorio]
    ]);
    appendDl(document.getElementById('blockEndereco'), [
      ['CEP', doctor.cep],
      ['Logradouro', doctor.enderecoConsultorio],
      ['Número', doctor.numeroConsultorio],
      ['Complemento', doctor.complemento],
      ['Bairro', doctor.bairro],
      ['Cidade', doctor.cidade],
      ['Estado', doctor.estado]
    ]);
  }

  if (st === 'denied' && doctor.validationDeniedReason) {
    const pessoal = document.getElementById('blockPessoal');
    pessoal.insertAdjacentHTML(
      'beforeend',
      `<dt>Motivo da recusa anterior</dt><dd>${escapeHtml(doctor.validationDeniedReason)}</dd>`
    );
  }

  renderDocuments(documents, isUS);
  renderHistory(history);

  const denyWrap = document.getElementById('denyFieldWrap');
  const btnApprove = document.getElementById('btnApproveDetail');
  const btnDeny = document.getElementById('btnDenyDetail');
  const hint = document.getElementById('actionsHint');

  if (st === 'under_review') {
    denyWrap.style.display = 'block';
    btnApprove.disabled = false;
    btnDeny.disabled = false;
    btnApprove.removeAttribute('title');
    btnDeny.removeAttribute('title');
    hint.hidden = true;
    hint.textContent = '';
  } else {
    denyWrap.style.display = 'none';
    btnApprove.disabled = true;
    btnDeny.disabled = true;
    btnApprove.title = 'Disponível apenas quando o status for Em análise.';
    btnDeny.title = 'Disponível apenas quando o status for Em análise.';
    hint.hidden = false;
    hint.innerHTML =
      'Ações de <strong>aprovar</strong> ou <strong>negar</strong> ficam disponíveis quando o cadastro estiver com status <strong>Em análise</strong>.';
  }

  content.style.display = 'flex';
  errEl.style.display = 'none';

  if (focusDeny && st === 'under_review') {
    setTimeout(() => {
      document.getElementById('denyReasonDetail')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('denyReasonDetail')?.focus();
    }, 300);
  }
}

async function doApprove() {
  if (!doctorId) return;
  const btn = document.getElementById('btnApproveDetail');
  if (btn?.disabled) return;
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${doctorId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    await Swal.fire({
      title: 'Aprovado',
      text: data.message || 'Cadastro aprovado.',
      icon: 'success',
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/painel-admin.html';
  } else {
    await Swal.fire({
      title: 'Erro',
      text: data.message || 'Não foi possível aprovar.',
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
  }
}

async function doDeny() {
  if (!doctorId) return;
  const btn = document.getElementById('btnDenyDetail');
  if (btn?.disabled) return;
  const reason = document.getElementById('denyReasonDetail')?.value?.trim();
  if (!reason || reason.length < 10) {
    await Swal.fire({
      title: 'Atenção',
      text: 'Informe o motivo da recusa (mínimo 10 caracteres).',
      icon: 'warning',
      confirmButtonColor: '#002A42'
    });
    return;
  }
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/doctors/${doctorId}/deny`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    await Swal.fire({
      title: 'Negado',
      text: data.message || 'Cadastro negado.',
      icon: 'info',
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/painel-admin.html';
  } else {
    await Swal.fire({
      title: 'Erro',
      text: data.message || 'Não foi possível negar.',
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await ensureAdmin();
  if (!ok) return;
  await initApp({ titleKey: 'admin.title', activePage: 'adminValidation' });
  document.getElementById('btnApproveDetail')?.addEventListener('click', doApprove);
  document.getElementById('btnDenyDetail')?.addEventListener('click', doDeny);
  await loadDetail();
});
