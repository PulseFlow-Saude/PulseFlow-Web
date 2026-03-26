import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`
});

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '-';
  if (typeof value === 'string' && value.includes(':')) return value.slice(0, 5);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const escapeHTML = (text = '') => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

let agendamentoAtual = null;
const STATUS_LABEL = {
  agendada: () => t('agendamentos.scheduled', { fallback: 'Agendada' }),
  confirmada: () => t('agendamentoDetalhes.statusConfirmed', { fallback: 'Confirmada' }),
  remarcada: () => t('agendamentoDetalhes.statusRescheduled', { fallback: 'Remarcada' }),
  realizada: () => t('agendamentos.completed', { fallback: 'Realizada' }),
  cancelada: () => t('agendamentos.cancelled', { fallback: 'Cancelada' })
};

function renderList(targetId, items) {
  const container = document.getElementById(targetId);
  if (!container) return;
  container.innerHTML = `
    <div class="detalhes-table-wrapper">
      <table class="detalhes-table">
        <tbody>
          ${items.map((item) => `
            <tr>
              <th>${item.label}</th>
              <td>${item.value}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAgendamento(agendamento) {
  agendamentoAtual = agendamento;

  const status = agendamento.status || 'agendada';
  const tipo = agendamento.tipoConsulta || 'presencial';
  const tipoLabel = tipo === 'online'
    ? t('agendamentos.teleconsultation', { fallback: 'Teleconsulta' })
    : tipo === 'domiciliar'
      ? t('agendamentos.homeVisit', { fallback: 'Visita domiciliar' })
      : t('agendamentos.inPerson', { fallback: 'Presencial' });
  const pacienteNome = agendamento.pacienteNome || agendamento.pacienteId?.name || '-';
  const telefone = agendamento.pacienteTelefone || agendamento.pacienteId?.phone || '-';

  const dataPrincipal = agendamento.dataHora ? formatDate(agendamento.dataHora) : formatDate(agendamento.data);
  const horaPrincipal = agendamento.horaInicio || formatTime(agendamento.dataHora);
  const statusLabel = STATUS_LABEL[status] ? STATUS_LABEL[status]() : status;

  renderList('pacienteInfo', [
    { label: t('agendamentoDetalhes.name', { fallback: 'Nome' }), value: escapeHTML(pacienteNome) },
    { label: t('agendamentoDetalhes.contact', { fallback: 'Contato' }), value: escapeHTML(telefone) },
    { label: t('agendamentoDetalhes.email', { fallback: 'Email' }), value: escapeHTML(agendamento.pacienteEmail || agendamento.pacienteId?.email || '-') }
  ]);

  renderList('consultaInfo', [
    { label: t('agendamentos.date', { fallback: 'Data' }), value: dataPrincipal },
    { label: t('agendamentos.time', { fallback: 'Horário' }), value: horaPrincipal || '-' },
    { label: t('agendamentos.duration', { fallback: 'Duração' }), value: `${agendamento.duracao || 30} ${t('agendamentoDetalhes.minutesShort', { fallback: 'min' })}` },
    { label: t('agendamentos.type', { fallback: 'Tipo' }), value: tipoLabel },
    { label: t('agendamentos.statusLabel', { fallback: 'Status' }), value: statusLabel }
  ]);

  const clinicoInfo = document.getElementById('clinicoInfo');
  if (clinicoInfo) {
    clinicoInfo.innerHTML = `
      <p><strong>${t('agendamentoDetalhes.reason', { fallback: 'Motivo' })}:</strong> ${escapeHTML(agendamento.motivoConsulta || '-')}</p>
      <p><strong>${t('agendamentoDetalhes.observations', { fallback: 'Observações' })}:</strong> ${escapeHTML(agendamento.observacoes || '-')}</p>
    `;
  }

  const detalhesSubtitle = document.getElementById('detalhesSubtitle');
  if (detalhesSubtitle) {
    detalhesSubtitle.textContent = `${dataPrincipal} ${t('agendamentoDetalhes.at', { fallback: 'às' })} ${horaPrincipal || '-'} • ${tipoLabel}`;
  }

  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) {
    statusBadge.textContent = statusLabel;
    statusBadge.className = `status-badge-header status-${status}`;
  }

  const cancelarBtn = document.getElementById('cancelarBtn');
  const reagendarBtn = document.getElementById('reagendarBtn');
  const acoesInfo = document.getElementById('acoesInfo');
  const podeEditar = status !== 'cancelada' && status !== 'realizada';
  if (cancelarBtn) cancelarBtn.style.display = podeEditar ? 'inline-flex' : 'none';
  if (reagendarBtn) reagendarBtn.style.display = podeEditar ? 'inline-flex' : 'none';
  if (acoesInfo) {
    if (podeEditar) {
      acoesInfo.style.display = 'none';
      acoesInfo.textContent = '';
    } else {
      acoesInfo.style.display = 'block';
      acoesInfo.textContent = status === 'cancelada'
        ? t('agendamentoDetalhes.lockedCancelled', { fallback: 'Este agendamento já foi cancelado e não pode ser alterado.' })
        : t('agendamentoDetalhes.lockedCompleted', { fallback: 'Este agendamento já foi concluído e não pode ser alterado.' });
    }
  }
}

async function carregarDetalhes() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(t('agendamentoDetalhes.errorLoad', { fallback: 'Falha ao carregar' }));
    const data = await res.json();
    renderAgendamento(data);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('contentState').style.display = 'block';
  } catch (error) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
  }
}

async function cancelarAgendamento() {
  if (!agendamentoAtual?._id) return;
  const result = await Swal.fire({
    title: t('agendamentoDetalhes.confirmCancelTitle', { fallback: 'Cancelar agendamento?' }),
    text: t('agendamentoDetalhes.confirmCancelText', { fallback: 'Essa ação não pode ser desfeita.' }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('agendamentoDetalhes.cancelAppointment', { fallback: 'Cancelar agendamento' }),
    cancelButtonText: t('agendamentoDetalhes.back', { fallback: 'Voltar' }),
    confirmButtonColor: '#b91c1c'
  });
  if (!result.isConfirmed) return;

  const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoAtual._id}/cancelar`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ motivoCancelamento: 'Cancelado na tela de detalhes' })
  });

  if (!res.ok) {
    Swal.fire({
      icon: 'error',
      title: t('agendamentos.error', { fallback: 'Erro' }),
      text: t('agendamentoDetalhes.errorCancel', { fallback: 'Não foi possível cancelar.' })
    });
    return;
  }
  await Swal.fire({ icon: 'success', title: t('agendamentoDetalhes.cancelSuccess', { fallback: 'Agendamento cancelado com sucesso' }) });
  await carregarDetalhes();
}

async function reagendarAgendamento() {
  if (!agendamentoAtual?._id) return;
  const { value: novaDataHora } = await Swal.fire({
    title: t('agendamentoDetalhes.rescheduleTitle', { fallback: 'Reagendar consulta' }),
    input: 'datetime-local',
    inputLabel: t('agendamentoDetalhes.newDateTime', { fallback: 'Nova data e horário' }),
    showCancelButton: true,
    confirmButtonText: t('agendamentoDetalhes.save', { fallback: 'Salvar' }),
    cancelButtonText: t('agendamentoDetalhes.cancel', { fallback: 'Cancelar' })
  });
  if (!novaDataHora) return;

  const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoAtual._id}/remarcar`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ novaDataHora })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    Swal.fire({
      icon: 'error',
      title: t('agendamentos.error', { fallback: 'Erro' }),
      text: errorData.message || t('agendamentoDetalhes.errorReschedule', { fallback: 'Não foi possível remarcar.' })
    });
    return;
  }
  await Swal.fire({ icon: 'success', title: t('agendamentoDetalhes.rescheduleSuccess', { fallback: 'Consulta remarcada com sucesso' }) });
  await carregarDetalhes();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({ titleKey: 'agendamentoDetalhes.title', activePage: 'agendamentos' });
  document.title = `PulseFlow | ${t('agendamentoDetalhes.title', { fallback: 'Detalhes do Agendamento' })}`;
  if (!getToken()) {
    window.location.href = '/client/views/login.html';
    return;
  }

  document.getElementById('cancelarBtn')?.addEventListener('click', cancelarAgendamento);
  document.getElementById('reagendarBtn')?.addEventListener('click', reagendarAgendamento);
  await carregarDetalhes();
});
