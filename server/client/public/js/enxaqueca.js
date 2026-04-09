import { t } from './i18n.js';
import { validateActivePatient, redirectToPatientSelection } from './utils/patientValidation.js';
import { API_URL } from './config.js';

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("chartEnxaqueca");
  
  if (!canvas) {
    return;
  }
  
  const ctx = canvas.getContext("2d");

  function getMonthLabel() {
    return t('common.month' + (currentMonthIndex + 1));
  }
  // Elementos de menu foram movidos para componentes de header/sidebar
  // Não precisamos mais gerenciar o toggle aqui
  
  const validation = validateActivePatient();
  if (!validation.valid) {
    redirectToPatientSelection(validation.error);
    return;
  }

  const today = new Date();
  let currentMonthIndex = today.getMonth();
  let currentYear = today.getFullYear();

  function mostrarErro(mensagem) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = mensagem;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 1000;
      font-family: 'Montserrat', sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  async function carregarDadosMedico() {
    try {
      const tokenMedico = localStorage.getItem('token');
      const tokenPaciente = localStorage.getItem('tokenPaciente');

      if (!tokenMedico || !tokenPaciente) {
        mostrarErro(t('agendamentos.sessionExpired', { fallback: 'Sessão expirada. Faça login novamente!' }));
        return;
      }

      const decodedPayload = JSON.parse(atob(tokenPaciente));
      const cpf = decodedPayload?.cpf?.replace(/[^\d]/g, '');

      if (!cpf) {
        mostrarErro(t('historicoResumos.cpfNotFound', { fallback: 'CPF não encontrado no token do paciente.' }));
        return;
      }

      const response = await fetch(`${API_URL}/api/enxaqueca/medico?cpf=${cpf}&month=${currentMonthIndex + 1}&year=${currentYear}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenMedico}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        mostrarErro(t('common.errorLoading', { fallback: 'Erro ao buscar dados de enxaqueca!' }));
        return;
      }

      const data = await response.json();
      updateChart(data);
    } catch (error) {
      console.error('Erro ao buscar dados de enxaqueca:', error);
      mostrarErro(t('common.errorLoading', { fallback: 'Erro interno ao buscar dados de enxaqueca.' }));
    }
  }

  function classificarIntensidade(intensidade) {
    const valor = parseInt(intensidade);
    if (valor >= 1 && valor <= 3) {
      return t('enxaqueca.mild', { fallback: 'Leve' }).replace(' (1-3):', '');
    } else if (valor >= 4 && valor <= 6) {
      return t('enxaqueca.moderate', { fallback: 'Moderada' }).replace(' (4-6):', '');
    } else if (valor >= 7 && valor <= 8) {
      return t('enxaqueca.severe', { fallback: 'Severa' }).replace(' (7-8):', '');
    } else if (valor >= 9 && valor <= 10) {
      return t('enxaqueca.verySevere', { fallback: 'Muito Severa' }).replace(' (9-10):', '');
    } else {
      return t('agendamentos.notInformed', { fallback: 'Desconhecida' });
    }
  }

  // Gráfico Chart.js
  const chartEnxaqueca = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: t('enxaqueca.chartTitle', { fallback: 'Intensidade da Enxaqueca' }),
        data: [],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: 'easeOutQuart',
        animations: {
          y: {
            type: 'number',
            easing: 'easeOutBounce',
            from: 0
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: context => `${t('agendamentoNovo.dateTime', { fallback: 'Data & horário' })} ${context[0].parsed.x}`,
            label: () => '',
            afterBody: context => {
              const raw = context[0].raw;
              const intensidade = raw.intensidade;
              const duracao = raw.duracao;
              const classificacao = classificarIntensidade(intensidade);
              return [
                `${t('enxaqueca.avgIntensity', { fallback: 'Intensidade Média' })}: ${intensidade}/10`,
                `${t('enxaqueca.classification', { fallback: 'Classificação' })}: ${classificacao}`,
                `${t('agendamentos.duration', { fallback: 'Duração' })}: ${duracao}h`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: t('agendamentoNovo.dateTime', { fallback: 'Dia do Mês' }) },
          ticks: { precision: 0 }
        },
        y: {
          min: 0,
          max: 10,
          title: { display: true, text: t('enxaqueca.avgIntensity', { fallback: 'Intensidade' }) + ' (0-10)' },
          ticks: { stepSize: 1 }
        }
      }
    }
  });

  // Buscar dados da API
  async function fetchEnxaquecaData(month, year) {
    try {
      const tokenMedico = localStorage.getItem('token');
      const tokenPaciente = localStorage.getItem('tokenPaciente');

      if (!tokenMedico || !tokenPaciente) {
        mostrarErro(t('agendamentos.sessionExpired', { fallback: 'Sessão expirada. Faça login novamente!' }));
        return null;
      }

      const decodedPayload = JSON.parse(atob(tokenPaciente));
      const cpf = decodedPayload?.cpf?.replace(/[^\d]/g, '');

      if (!cpf) {
        mostrarErro(t('historicoResumos.cpfNotFound', { fallback: 'CPF não encontrado no token do paciente.' }));
        return null;
      }

      const response = await fetch(`${API_URL}/api/enxaqueca/medico?cpf=${cpf}&month=${month}&year=${year}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenMedico}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        mostrarErro(t('common.errorLoading', { fallback: 'Erro ao buscar dados de enxaqueca!' }));
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar dados de enxaqueca:', error);
      mostrarErro(t('common.errorLoading', { fallback: 'Erro interno ao buscar dados de enxaqueca.' }));
      return null;
    }
  }

  // Carregar e exibir no gráfico
  async function loadChartData() {
    const month = currentMonthIndex + 1; // Converter para 1-indexed
    const data = await fetchEnxaquecaData(month, currentYear);
    if (!data) return;

    // Atualizar o gráfico com os dados
    updateChart(data);
  }

  function updateChart(data) {
    const chartContainer = document.querySelector('.chart-container');
    const noDataMsg = document.getElementById('no-data-msg-enxaqueca');
    
    if (!data || !data.data || data.data.length === 0) {
      // Esconder apenas o container do gráfico quando não houver dados
      if (chartContainer) {
        chartContainer.style.display = 'none';
      }
      if (noDataMsg) {
        noDataMsg.style.display = 'flex';
      }
      chartEnxaqueca.data.labels = [];
      chartEnxaqueca.data.datasets[0].data = [];
      chartEnxaqueca.update();
      return;
    }

    // Mostrar o container do gráfico quando houver dados
    if (chartContainer) {
      chartContainer.style.display = 'flex';
    }
    if (noDataMsg) {
      noDataMsg.style.display = 'none';
    }

    // Extrair dias e valores de enxaqueca
    const dias = data.data.map(d => d.dia);
    const valores = data.data.map(d => ({
      x: d.dia,
      y: parseInt(d.intensidade),
      intensidade: d.intensidade,
      duracao: d.duracao
    }));

    // Atualizar dados do gráfico
    chartEnxaqueca.data.labels = dias;
    chartEnxaqueca.data.datasets[0].data = valores;

    // Atualizar o gráfico
    chartEnxaqueca.update();
  }

  function updateMonth(change) {
    currentMonthIndex += change;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear += 1;
    }
    if (currentMonthIndex < 0) {
      currentMonthIndex = 11;
      currentYear -= 1;
    }

    document.querySelectorAll(".month-label").forEach(el => {
      el.textContent = `${getMonthLabel()} • ${currentYear}`;
    });

    loadChartData();
    atualizarEstatisticas(currentMonthIndex + 1, currentYear);
  }

  document.querySelectorAll(".arrow-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const direction = btn.dataset.direction === "next" ? 1 : -1;
      updateMonth(direction);
    });
  });

  document.querySelectorAll(".month-label").forEach(el => {
    el.textContent = `${getMonthLabel()} • ${currentYear}`;
  });

  loadChartData();
  atualizarEstatisticas(currentMonthIndex + 1, currentYear);
});

// Função para atualizar estatísticas
async function atualizarEstatisticas(month, year) {
  try {
    const tokenMedico = localStorage.getItem('token');
    const tokenPaciente = localStorage.getItem('tokenPaciente');

    if (!tokenMedico || !tokenPaciente) {
      return;
    }

    const decodedPayload = JSON.parse(atob(tokenPaciente));
    const cpf = decodedPayload?.cpf?.replace(/[^\d]/g, '');

    if (!cpf) {
      return;
    }

    const response = await fetch(`${API_URL}/api/enxaqueca/medico?cpf=${cpf}&month=${month}&year=${year}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenMedico}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    
    if (data && data.data && data.data.length > 0) {
      // Atualizar estatísticas
      document.getElementById('totalEpisodesCount').textContent = data.data.length;
      
      const intensidades = data.data.map(d => parseFloat(d.intensidade || 0)).filter(i => i > 0);
      const mediaIntensidade = intensidades.length > 0 ? intensidades.reduce((sum, val) => sum + val, 0) / intensidades.length : 0;
      document.getElementById('avgIntensity').textContent = mediaIntensidade.toFixed(1);
      
      const duracoes = data.data.map(d => parseFloat(d.duracao || 0)).filter(d => d > 0);
      const mediaDuracao = duracoes.length > 0 ? duracoes.reduce((sum, val) => sum + val, 0) / duracoes.length : 0;
      document.getElementById('avgDuration').textContent = mediaDuracao.toFixed(1) + 'h';
      
      // Contar crises severas (intensidade >= 7)
      const crisesSeveras = intensidades.filter(i => i >= 7).length;
      document.getElementById('severeEpisodesCount').textContent = crisesSeveras;
    }
  } catch (error) {
    console.error('Erro ao atualizar estatísticas:', error);
  }
}