import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';
import { t } from './i18n.js';

document.addEventListener("DOMContentLoaded", async () => {
    console.log('Página de pressão arterial carregada, iniciando...');
    
    const validation = validateActivePatient();
    if (!validation.valid) {
        redirectToPatientSelection(validation.error);
        return;
    }
    
    // Aguardar carregamento dos componentes
    setTimeout(async () => {
        await carregarDadosMedico();
        await inicializarPagina();
    }, 500);
});

const API_URL = window.API_URL || 'http://localhost:65432';

function mostrarErro(mensagem) {
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
        iconColor: '#ef4444'
    });
}

async function carregarDadosMedico() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token não encontrado. Por favor, faça login novamente.');
        }

        const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Erro ao carregar dados do médico');
        }

        const medico = await res.json();
        console.log('Dados do médico carregados:', medico);
        
        return true;
    } catch (error) {
        console.error("Erro ao carregar dados do médico:", error);
        mostrarErro("Erro ao carregar dados do médico. Por favor, faça login novamente.");
        return false;
    }
}

async function buscarDadosPressao(mes, ano) {
    try {
        const tokenMedico = localStorage.getItem('token');
        
        let selectedPatient = localStorage.getItem('selectedPatient') || 
                             localStorage.getItem('pacienteSelecionado') || 
                             localStorage.getItem('selectedPatientData');
        
        if (!tokenMedico) {
            mostrarErro("Sessão expirada. Faça login novamente!");
            return null;
        }

        if (!selectedPatient) {
            console.log('Chaves disponíveis no localStorage:', Object.keys(localStorage));
            mostrarErro("Nenhum paciente selecionado. Por favor, selecione um paciente primeiro.");
            return null;
        }

        let paciente;
        try {
            paciente = JSON.parse(selectedPatient);
        } catch (parseError) {
            console.error('Erro ao fazer parse do paciente:', parseError);
            mostrarErro("Erro ao processar dados do paciente selecionado.");
            return null;
        }

        const cpf = paciente.cpf?.replace(/[^\d]/g, '');

        if (!cpf) {
            console.log('Dados do paciente:', paciente);
            mostrarErro("CPF não encontrado no paciente selecionado.");
            return null;
        }

        console.log(`Buscando dados de pressão arterial para CPF: ${cpf}, Mês: ${mes}, Ano: ${ano}`);

        const response = await fetch(`${API_URL}/api/pressaoArterial/medico?cpf=${cpf}&month=${mes}&year=${ano}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${tokenMedico}`,
                "Content-Type": "application/json"
            }
        });

        const handled = await handleApiError(response);
        if (handled) {
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro na resposta:', response.status, errorData);
            
            if (response.status === 404) {
                console.log('Nenhum dado de pressão arterial encontrado para este período');
                return { data: [], stats: { total: 0, mediaSistolica: 0, mediaDiastolica: 0, leiturasNormais: 0 } };
            }
            
            if (response.status === 403) {
                mostrarErro(errorData.message || "Acesso negado. Você não tem uma conexão ativa com este paciente.");
                return null;
            }
            
            mostrarErro(errorData.message || "Erro ao buscar dados de pressão arterial!");
            return null;
        }

        const data = await response.json();
        console.log('Dados de pressão arterial recebidos:', data);
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados de pressão arterial:', error);
        mostrarErro("Erro interno ao buscar dados de pressão arterial.");
        return null;
    }
}

let mesAtual = new Date().getMonth() + 1;
let anoAtual = new Date().getFullYear();

function atualizarLabelMes() {
    const labelMes = document.querySelector('.month-label');
    if (labelMes) {
        labelMes.textContent = `${t('common.month' + mesAtual)} • ${anoAtual}`;
    }
}

function classificarPressao(sistolica, diastolica) {
    if (sistolica < 130 && diastolica < 85) {
        return "Normal";
    } else if (sistolica >= 130 && sistolica <= 139 && diastolica >= 85 && diastolica <= 89) {
        return "Normal limítrofe";
    } else if (sistolica >= 140 && sistolica <= 159 && diastolica >= 90 && diastolica <= 99) {
        return "Hipertensão leve (estágio 1)";
    } else if (sistolica >= 160 && sistolica <= 179 && diastolica >= 100 && diastolica <= 109) {
        return "Hipertensão moderada (estágio 2)";
    } else if (sistolica >= 180 && diastolica >= 110) {
        return "Hipertensão grave (estágio 3)";
    } else if (sistolica >= 140 && diastolica < 90) {
        return "Hipertensão sistólica isolada";
    } else {
        return "Classificação indefinida";
    }
}

function calcularEstatisticas(dados) {
    if (!dados || !dados.data || dados.data.length === 0) {
        return {
            totalLeituras: 0,
            mediaSistolica: 0,
            mediaDiastolica: 0,
            leiturasNormais: 0
        };
    }

    const leituras = dados.data;
    const totalLeituras = leituras.length;
    
    const somaSistolica = leituras.reduce((acc, d) => acc + d.sistolica, 0);
    const somaDiastolica = leituras.reduce((acc, d) => acc + d.diastolica, 0);
    
    const mediaSistolica = Math.round(somaSistolica / totalLeituras);
    const mediaDiastolica = Math.round(somaDiastolica / totalLeituras);
    
    const leiturasNormais = leituras.filter(d => 
        d.sistolica < 130 && d.diastolica < 85
    ).length;

    return {
        totalLeituras,
        mediaSistolica,
        mediaDiastolica,
        leiturasNormais
    };
}

function atualizarEstatisticas(dados) {
    const stats = calcularEstatisticas(dados);
    
    const totalElement = document.getElementById('totalReadingsCount');
    const sistolicaElement = document.getElementById('avgSystolic');
    const diastolicaElement = document.getElementById('avgDiastolic');
    const normaisElement = document.getElementById('normalReadingsCount');

    if (totalElement) totalElement.textContent = stats.totalLeituras;
    if (sistolicaElement) sistolicaElement.textContent = `${stats.mediaSistolica} mmHg`;
    if (diastolicaElement) diastolicaElement.textContent = `${stats.mediaDiastolica} mmHg`;
    if (normaisElement) normaisElement.textContent = stats.leiturasNormais;
}

async function carregarDadosGrafico() {
    const dados = await buscarDadosPressao(mesAtual, anoAtual);
    if (!dados) return;

    atualizarEstatisticas(dados);
    atualizarGrafico(dados);
}

function configurarNavegacaoMes() {
    const btnAnterior = document.querySelector('[data-direction="prev"]');
    const btnProximo = document.querySelector('[data-direction="next"]');

    if (btnAnterior) {
        btnAnterior.addEventListener('click', async () => {
            mesAtual--;
            if (mesAtual < 1) {
                mesAtual = 12;
                anoAtual--;
            }
            atualizarLabelMes();
            await carregarDadosGrafico();
        });
    }

    if (btnProximo) {
        btnProximo.addEventListener('click', async () => {
            mesAtual++;
            if (mesAtual > 12) {
                mesAtual = 1;
                anoAtual++;
            }
            atualizarLabelMes();
            await carregarDadosGrafico();
        });
    }
}

function atualizarGrafico(dados) {
    const chartContainer = document.querySelector('.chart-container');
    const mensagemSemDados = document.getElementById('no-data-msg-pressao');
    
    if (!dados || !dados.data || dados.data.length === 0) {
        if (chartContainer) {
            chartContainer.style.display = 'none';
        }
        if (mensagemSemDados) {
            mensagemSemDados.style.display = 'flex';
        }
        if (graficoPressao) {
            graficoPressao.data.datasets[0].data = [];
            graficoPressao.data.datasets[1].data = [];
            graficoPressao.update('none');
        }
        return;
    }

    // Mostrar o container do gráfico quando houver dados
    if (chartContainer) {
        chartContainer.style.display = 'flex';
    }
    if (mensagemSemDados) {
        mensagemSemDados.style.display = 'none';
    }

    // Criar pontos de dados para sistólica e diastólica
    const pontosSistolica = dados.data.map(d => ({
        x: d.dia,
        y: d.sistolica,
        label: `${d.sistolica}/${d.diastolica}`
    }));

    const pontosDiastolica = dados.data.map(d => ({
        x: d.dia,
        y: d.diastolica,
        label: `${d.sistolica}/${d.diastolica}`
    }));

    console.log('📊 Atualizando gráfico com dados:', {
        totalPontos: dados.data.length,
        pontosSistolica: pontosSistolica.length,
        pontosDiastolica: pontosDiastolica.length,
        primeiroPonto: pontosSistolica[0]
    });

    // Se o gráfico não existe, criar primeiro
    if (!graficoPressao) {
        const ctxPressao = document.getElementById('chartPressao');
        if (!ctxPressao) {
            console.error('Elemento chartPressao não encontrado');
            return;
        }
        
        graficoPressao = new Chart(ctxPressao, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Pressão Sistólica',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false
                }, {
                    label: 'Pressão Diastólica',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 25,
                            font: {
                                family: 'Inter, sans-serif',
                                size: 13,
                                weight: '400'
                            },
                            color: '#475569',
                            boxWidth: 8,
                            boxHeight: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        padding: 12,
                        callbacks: {
                            title: function(context) {
                                return `Dia ${context[0].label}`;
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} mmHg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        grid: {
                            display: true,
                            color: 'rgba(226, 232, 240, 0.5)',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11,
                                weight: '400'
                            },
                            stepSize: 1,
                            padding: 12,
                            precision: 0
                        },
                        min: 1,
                        max: 31
                    },
                    y: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11,
                                weight: '400'
                            },
                            padding: 12,
                            callback: function(value) {
                                return value;
                            }
                        },
                        min: 40,
                        max: 200,
                        beginAtZero: false
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    // Atualizar dados do gráfico
    graficoPressao.data.datasets[0].data = pontosSistolica;
    graficoPressao.data.datasets[1].data = pontosDiastolica;
    graficoPressao.update('none');
    
    console.log('✅ Gráfico atualizado com áreas preenchidas');
}

// Variável global para o gráfico
let graficoPressao = null;

async function inicializarPagina() {
    try {
        const ctxPressao = document.getElementById('chartPressao');
        if (!ctxPressao) {
            console.error('Elemento chartPressao não encontrado');
            return;
        }
        
        // Inicializar gráfico vazio
        if (graficoPressao) {
            graficoPressao.destroy();
        }
        
        graficoPressao = new Chart(ctxPressao, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Pressão Sistólica',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false
                }, {
                    label: 'Pressão Diastólica',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 25,
                            font: {
                                family: 'Inter, sans-serif',
                                size: 13,
                                weight: '400'
                            },
                            color: '#475569',
                            boxWidth: 8,
                            boxHeight: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        padding: 12,
                        callbacks: {
                            title: function(context) {
                                return `Dia ${context[0].label}`;
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} mmHg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        grid: {
                            display: true,
                            color: 'rgba(226, 232, 240, 0.5)',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11,
                                weight: '400'
                            },
                            stepSize: 1,
                            padding: 12,
                            precision: 0
                        },
                        min: 1,
                        max: 31
                    },
                    y: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11,
                                weight: '400'
                            },
                            padding: 12,
                            callback: function(value) {
                                return value;
                            }
                        },
                        min: 40,
                        max: 200,
                        beginAtZero: false
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        atualizarLabelMes();
        configurarNavegacaoMes();
        await carregarDadosGrafico();
        
        console.log('Página de pressão arterial inicializada com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        mostrarErro('Erro ao inicializar a página');
    }
}

// Funções globais para debug
window.debugPressaoArterial = function() {
    console.log('=== DEBUG PRESSÃO ARTERIAL ===');
    console.log('Mês atual:', mesAtual);
    console.log('Ano atual:', anoAtual);
    console.log('Token médico:', localStorage.getItem('token') ? 'Presente' : 'Ausente');
    console.log('Gráfico inicializado:', graficoPressao ? 'Sim' : 'Não');
    
    console.log('\n=== LOCALSTORAGE ===');
    console.log('Todas as chaves:', Object.keys(localStorage));
    console.log('selectedPatient:', localStorage.getItem('selectedPatient'));
    console.log('pacienteSelecionado:', localStorage.getItem('pacienteSelecionado'));
    console.log('selectedPatientData:', localStorage.getItem('selectedPatientData'));
    
    const possibleKeys = ['selectedPatient', 'pacienteSelecionado', 'selectedPatientData'];
    for (const key of possibleKeys) {
        const value = localStorage.getItem(key);
        if (value) {
            try {
                const parsed = JSON.parse(value);
                console.log(`Dados do paciente (${key}):`, parsed);
                if (parsed.cpf) {
                    console.log(`CPF encontrado: ${parsed.cpf}`);
                }
            } catch (e) {
                console.log(`Erro ao fazer parse de ${key}:`, e);
            }
        }
    }
    
    console.log('\n=== TESTE DE CARREGAMENTO ===');
    carregarDadosGrafico().then(() => {
        console.log('Dados carregados com sucesso');
    }).catch((error) => {
        console.error('Erro ao carregar dados:', error);
    });
};
