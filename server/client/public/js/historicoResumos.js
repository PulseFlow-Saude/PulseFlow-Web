import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';

const API_URL = window.API_URL || 'http://localhost:65432';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Página de histórico de resumos carregada');

  const validation = validateActivePatient();
  if (!validation.valid) {
    redirectToPatientSelection(validation.error);
    return;
  }

  await carregarResumos();
});

async function carregarResumos() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      mostrarErro('Sessão expirada. Faça login novamente!');
      return;
    }

    let selectedPatient = localStorage.getItem('selectedPatient') ||
                          localStorage.getItem('pacienteSelecionado') ||
                          localStorage.getItem('selectedPatientData');

    if (!selectedPatient) {
      mostrarErro('Nenhum paciente selecionado. Por favor, selecione um paciente primeiro.');
      return;
    }

    let paciente;
    try {
      paciente = JSON.parse(selectedPatient);
    } catch (parseError) {
      console.error('Erro ao fazer parse do paciente:', parseError);
      mostrarErro('Erro ao processar dados do paciente selecionado.');
      return;
    }

    const cpf = paciente.cpf?.replace(/[^\d]/g, '');
    if (!cpf) {
      mostrarErro('CPF não encontrado no paciente selecionado.');
      return;
    }

    console.log(`Buscando resumos para CPF: ${cpf}`);

    const response = await fetch(`${API_URL}/api/resumo-consulta/paciente?cpf=${cpf}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const handled = await handleApiError(response);
    if (handled) {
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erro na resposta:', response.status, errorData);

      if (response.status === 404) {
        mostrarEstadoVazio();
        return;
      }

      mostrarErro(errorData.message || 'Erro ao buscar resumos de consultas!');
      return;
    }

    const data = await response.json();
    console.log('Resumos recebidos:', data);

    if (!data.resumos || data.resumos.length === 0) {
      mostrarEstadoVazio();
      return;
    }

    exibirResumos(data.resumos);

  } catch (error) {
    console.error('Erro ao carregar resumos:', error);
    mostrarErro('Erro interno ao carregar resumos de consultas.');
  }
}

function exibirResumos(resumos) {
  const resumosList = document.getElementById('resumosList');
  const emptyState = document.getElementById('emptyState');

  if (!resumosList) return;

  if (emptyState) emptyState.style.display = 'none';
  resumosList.innerHTML = '';

  resumos.forEach(resumo => {
    const card = criarCardResumo(resumo);
    resumosList.appendChild(card);
  });
}

function criarCardResumo(resumo) {
  const card = document.createElement('div');
  card.className = 'resumo-card';

  const dataConsulta = new Date(resumo.dataConsulta);
  const dataFormatada = dataConsulta.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const horaFormatada = dataConsulta.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const motivoLabels = {
    primeira: 'Primeira consulta',
    rotina: 'Consulta de rotina',
    preventiva: 'Consulta preventiva',
    urgencia: 'Consulta de urgência/emergência',
    retorno: 'Consulta de retorno',
    segundaOpniao: 'Consulta de segunda opinião',
    acompanhamento: 'Acompanhamento',
    exame: 'Resultado de exame'
  };

  const statusLabels = {
    concluido: 'Concluído',
    processando: 'Processando',
    erro: 'Erro',
    pendente: 'Pendente'
  };

  const statusClass = resumo.status === 'concluido' ? '' : 
                      resumo.status === 'erro' ? 'erro' : 'processando';

  const resumoPreview = resumo.resumo ? resumo.resumo.substring(0, 200) + '...' : 'Resumo não disponível';
  const pontosPreview = resumo.pontosImportantes ? resumo.pontosImportantes.slice(0, 3) : [];

  card.innerHTML = `
    <div class="resumo-header">
      <div class="resumo-meta">
        <div class="resumo-date">${dataFormatada}</div>
        <div class="resumo-time">${horaFormatada}</div>
      </div>
      <div class="resumo-badges">
        <span class="badge badge-status ${statusClass}">${statusLabels[resumo.status] || resumo.status}</span>
      </div>
    </div>

    ${resumo.motivoConsulta ? `
      <div class="resumo-info-item">
        <span class="info-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          Motivo da Consulta
        </span>
        <span class="info-value">${motivoLabels[resumo.motivoConsulta] || resumo.motivoConsulta}</span>
      </div>
    ` : ''}

    ${resumo.observacoes ? `
      <div class="resumo-info-item">
        <span class="info-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Observações
        </span>
        <span class="info-value">${resumo.observacoes}</span>
      </div>
    ` : ''}

    <div class="resumo-preview">
      <h4>Resumo</h4>
      <div class="resumo-text">${resumoPreview}</div>
    </div>

    ${pontosPreview.length > 0 ? `
      <div class="resumo-preview">
        <h4>Pontos Importantes</h4>
        <ul class="pontos-preview">
          ${pontosPreview.map(ponto => `<li>${ponto}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    <div class="resumo-actions">
      <button class="btn-view" onclick="abrirDetalhes('${resumo.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Ver Detalhes
      </button>
    </div>
  `;

  return card;
}

function mostrarEstadoVazio() {
  const resumosList = document.getElementById('resumosList');
  const emptyState = document.getElementById('emptyState');

  if (resumosList) resumosList.innerHTML = '';
  if (emptyState) emptyState.style.display = 'block';
}

async function abrirDetalhes(resumoId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      mostrarErro('Sessão expirada. Faça login novamente!');
      return;
    }

    const response = await fetch(`${API_URL}/api/resumo-consulta/${resumoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar detalhes do resumo');
    }

    const data = await response.json();
    mostrarModalDetalhes(data.resumo);

  } catch (error) {
    console.error('Erro ao buscar detalhes:', error);
    mostrarErro('Erro ao carregar detalhes do resumo.');
  }
}

function mostrarModalDetalhes(resumo) {
  const dataConsulta = new Date(resumo.dataConsulta);
  const dataFormatada = dataConsulta.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const horaFormatada = dataConsulta.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const motivoLabels = {
    primeira: 'Primeira consulta',
    rotina: 'Consulta de rotina',
    preventiva: 'Consulta preventiva',
    urgencia: 'Consulta de urgência/emergência',
    retorno: 'Consulta de retorno',
    segundaOpniao: 'Consulta de segunda opinião',
    acompanhamento: 'Acompanhamento',
    exame: 'Resultado de exame'
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Detalhes da Consulta</h2>
        <button class="btn-close-modal" onclick="fecharModal()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="modal-section">
          <h3>Data e Hora</h3>
          <div class="modal-section-content">${dataFormatada} às ${horaFormatada}</div>
        </div>
        ${resumo.motivoConsulta ? `
          <div class="modal-section">
            <h3>Motivo da Consulta</h3>
            <div class="modal-section-content">${motivoLabels[resumo.motivoConsulta] || resumo.motivoConsulta}</div>
          </div>
        ` : ''}
        ${resumo.observacoes ? `
          <div class="modal-section">
            <h3>Observações</h3>
            <div class="modal-section-content">${resumo.observacoes}</div>
          </div>
        ` : ''}
        <div class="modal-section">
          <h3>Resumo</h3>
          <div class="modal-section-content">${resumo.resumo || 'Resumo não disponível'}</div>
        </div>
        ${resumo.pontosImportantes && resumo.pontosImportantes.length > 0 ? `
          <div class="modal-section">
            <h3>Pontos Importantes</h3>
            <ul class="pontos-list-modal">
              ${resumo.pontosImportantes.map(ponto => `<li>${ponto}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${resumo.transcricao ? `
          <div class="modal-section">
            <h3>Transcrição Completa</h3>
            <div class="modal-section-content">${resumo.transcricao}</div>
          </div>
        ` : ''}
        ${resumo.erro ? `
          <div class="modal-section">
            <h3>Erro</h3>
            <div class="modal-section-content" style="color: var(--danger);">${resumo.erro}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      fecharModal();
    }
  });
}

function fecharModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
}

window.abrirDetalhes = abrirDetalhes;
window.fecharModal = fecharModal;

function mostrarErro(mensagem) {
  const erroMensagem = document.getElementById('erroMensagem');
  const errorText = document.getElementById('errorText');
  
  if (erroMensagem && errorText) {
    errorText.textContent = mensagem;
    erroMensagem.style.display = 'flex';
  }

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  Toast.fire({
    title: mensagem,
    icon: 'error',
    iconColor: '#dc2626'
  });
}

