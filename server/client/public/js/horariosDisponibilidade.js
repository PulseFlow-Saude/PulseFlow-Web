import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';
const tx = (pt, en) => ((document.documentElement.lang || '').toLowerCase().startsWith('en') ? en : pt);

const getDiasSemana = () => ([
    t('agendamentos.weekDay0', { fallback: 'Domingo' }),
    t('agendamentos.weekDay1', { fallback: 'Segunda-feira' }),
    t('agendamentos.weekDay2', { fallback: 'Terça-feira' }),
    t('agendamentos.weekDay3', { fallback: 'Quarta-feira' }),
    t('agendamentos.weekDay4', { fallback: 'Quinta-feira' }),
    t('agendamentos.weekDay5', { fallback: 'Sexta-feira' }),
    t('agendamentos.weekDay6', { fallback: 'Sábado' })
]);

let horarios = [];
let showInactive = false;
let isSaving = false;
let selectedHorarioIds = new Set();

document.addEventListener('DOMContentLoaded', async function() {
    await initApp({ titleKey: 'horarios.title', activePage: 'horarios' });
    document.title = `PulseFlow | ${t('horarios.title', { fallback: 'Meus Horários de Trabalho' })}`;

    const toggleButton = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (toggleButton && sidebar) {
        toggleButton.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            toggleButton.classList.toggle('shifted');
        });
    }

    // Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        Swal.fire({
            title: t('agendamentos.error', { fallback: 'Erro' }),
            text: t('agendamentos.errorLoadProfile', { fallback: 'Você precisa estar logado para acessar esta página' }),
            icon: 'error',
            confirmButtonText: t('agendamentos.goToLogin', { fallback: 'Ir para Login' }),
            confirmButtonColor: '#002A42'
        }).then(() => {
            window.location.href = '/client/views/login.html';
        });
        return;
    }

    // Inicializar componentes
    initPanelForm();
    initBulkActions();
    initFilters();
    loadHorarios();
});

function getToken() {
    return localStorage.getItem('token');
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

function showToast(message, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
    });
}

async function loadHorarios() {
    const listEl = document.getElementById('horariosList');

    try {
        listEl.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> ${t('horarios.loading', { fallback: tx('Carregando horários...', 'Loading schedules...') })}</div>`;

        const response = await fetch(`${API_URL}/api/horarios-disponibilidade`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error(t('agendamentos.sessionExpired', { fallback: 'Sessão expirada. Faça login novamente.' }));
            }
            throw new Error(t('horarios.errorLoad', { fallback: 'Erro ao carregar horários' }));
        }

        const data = await response.json();
        horarios = data.horarios || [];

        renderHorarios();
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        listEl.innerHTML = `<div class="error">${error.message}</div>`;
        showToast(error.message, 'error');
    } finally {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderHorarios() {
    const listEl = document.getElementById('horariosList');
    const emptyStateEl = document.getElementById('emptyState');
    if (!listEl || !emptyStateEl) return;

    const horariosFiltrados = showInactive 
        ? horarios 
        : horarios.filter(h => h.ativo);

    if (horariosFiltrados.length === 0) {
        listEl.style.display = 'none';
        emptyStateEl.style.display = 'block';
        selectedHorarioIds.clear();
        updateBulkSelectionUI();
        return;
    }

    listEl.style.display = 'block';
    emptyStateEl.style.display = 'none';

    // Agrupar por dia da semana (com fallback seguro para valores inválidos)
    const horariosPorDia = {};
    const semDiaKey = 'sem_dia';
    horariosFiltrados.forEach(horario => {
        const dia = Number(horario.diaSemana);
        const diaValido = Number.isInteger(dia) && dia >= 0 && dia <= 6;
        const key = diaValido ? String(dia) : semDiaKey;

        if (!horariosPorDia[key]) {
            horariosPorDia[key] = [];
        }
        horariosPorDia[key].push(horario);
    });

    const diasOrdenados = Object.keys(horariosPorDia).sort((a, b) => {
        if (a === semDiaKey) return 1;
        if (b === semDiaKey) return -1;
        return Number(a) - Number(b);
    });

    let html = '';
    diasOrdenados.forEach(dia => {
        const horariosDia = (horariosPorDia[dia] || []).sort((a, b) => 
            a.horaInicio.localeCompare(b.horaInicio)
        );

        const diasSemana = getDiasSemana();
        const diaNome = dia === semDiaKey
            ? t('agendamentos.dayNotFound', { fallback: 'Dia não informado' })
            : (diasSemana[Number(dia)] || t('agendamentos.dayNotFound', { fallback: 'Dia não informado' }));
        html += `<div class="day-group-title">${diaNome}</div>`;
        horariosDia.forEach(horario => {
            html += createHorarioCard(horario);
        });
    });

    listEl.innerHTML = html;

    // Adicionar event listeners aos botões
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.horario-card').dataset.id;
            editHorario(id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.horario-card').dataset.id;
            deleteHorario(id);
        });
    });

    document.querySelectorAll('.horario-select').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const { id } = e.target.dataset;
            if (!id) return;
            if (e.target.checked) {
                selectedHorarioIds.add(id);
            } else {
                selectedHorarioIds.delete(id);
            }
            updateBulkSelectionUI();
        });
    });

    updateBulkSelectionUI();
}

function createHorarioCard(horario) {
    const statusClass = horario.ativo ? 'active' : 'inactive';
    const statusText = horario.ativo
        ? t('horarios.statusActive', { fallback: 'Ativo' })
        : t('horarios.statusInactive', { fallback: 'Inativo' });
    const dia = Number(horario.diaSemana);
    const diasSemana = getDiasSemana();
    const diaNome = horario.diaSemanaNome || diasSemana[dia] || t('agendamentos.dayNotFound', { fallback: 'Dia não informado' });
    
    return `
        <div class="horario-card ${statusClass}" data-id="${horario._id}">
            <div class="horario-select-col">
                <input
                    type="checkbox"
                    class="horario-select"
                    data-id="${horario._id}"
                    ${selectedHorarioIds.has(horario._id) ? 'checked' : ''}
                />
            </div>
            <div class="horario-info">
                <div class="horario-day">${diaNome}</div>
                <div class="horario-time">
                    <i class="fas fa-clock"></i>
                    <span>${horario.horaInicio} - ${horario.horaFim}</span>
                </div>
                <div class="horario-details">
                    <div class="horario-duration">${t('horarios.durationPrefix', { fallback: 'Duração:' })} ${horario.duracaoConsulta} ${t('agendamentos.minutes', { fallback: 'minutos' })}</div>
                    ${horario.observacoes ? `<div class="horario-observacoes">${horario.observacoes}</div>` : ''}
                </div>
            </div>
            <div class="horario-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="horario-actions">
                    <button class="btn-secondary btn-small btn-edit">
                        <i class="fas fa-edit"></i> ${t('horarios.edit', { fallback: 'Editar' })}
                    </button>
                    <button class="btn-danger btn-small btn-delete">
                        <i class="fas fa-trash"></i> ${t('horarios.delete', { fallback: 'Excluir' })}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function initBulkActions() {
    const selectAll = document.getElementById('selectAllHorarios');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    if (selectAll) {
        selectAll.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.horario-select');
            checkboxes.forEach((checkbox) => {
                checkbox.checked = selectAll.checked;
                const { id } = checkbox.dataset;
                if (!id) return;
                if (selectAll.checked) {
                    selectedHorarioIds.add(id);
                } else {
                    selectedHorarioIds.delete(id);
                }
            });
            updateBulkSelectionUI();
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedHorarios);
    }
}

function updateBulkSelectionUI() {
    const selectedCountEl = document.getElementById('selectedCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectAll = document.getElementById('selectAllHorarios');
    const visibleCheckboxes = Array.from(document.querySelectorAll('.horario-select'));
    const visibleCount = visibleCheckboxes.length;
    const visibleSelectedCount = visibleCheckboxes.filter((checkbox) => checkbox.checked).length;

    if (selectedCountEl) selectedCountEl.textContent = String(selectedHorarioIds.size);
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = selectedHorarioIds.size === 0;

    if (selectAll) {
        selectAll.checked = visibleCount > 0 && visibleSelectedCount === visibleCount;
        selectAll.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleCount;
    }
}

async function deleteSelectedHorarios() {
    const ids = Array.from(selectedHorarioIds);
    if (ids.length === 0) {
        showToast(tx('Selecione ao menos um horário para excluir', 'Select at least one schedule to delete'), 'warning');
        return;
    }

    const result = await Swal.fire({
        title: t('horarios.deleteSelectedTitle', { count: ids.length, fallback: `Excluir ${ids.length} horário(s)?` }),
        text: t('horarios.deleteWarning', { fallback: 'Esta ação não pode ser desfeita!' }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: t('horarios.confirmDeleteSelected', { fallback: 'Sim, excluir selecionados' }),
        cancelButtonText: t('horarios.cancel', { fallback: 'Cancelar' })
    });

    if (!result.isConfirmed) return;

    try {
        const responses = await Promise.all(
            ids.map((id) =>
                fetch(`${API_URL}/api/horarios-disponibilidade/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                })
            )
        );

        const failed = responses.filter((response) => !response.ok).length;
        if (failed > 0) {
            throw new Error(t('horarios.errorDeleteMany', { count: failed, fallback: `Não foi possível excluir ${failed} horário(s)` }));
        }

        selectedHorarioIds.clear();
        showToast(t('horarios.deleteManySuccess', { fallback: 'Horários excluídos com sucesso!' }));
        loadHorarios();
    } catch (error) {
        console.error('Erro ao excluir horários selecionados:', error);
        showToast(error.message, 'error');
    }
}

function initPanelForm() {
    const addBtn = document.getElementById('addHorarioBtn');
    const closeBtn = document.getElementById('closePanelBtn');
    const cancelBtn = document.getElementById('cancelForm');
    const form = document.getElementById('horarioForm');
    const repeatToggle = document.getElementById('repeatDaysToggle');

    addBtn.addEventListener('click', () => {
        openPanel();
    });

    closeBtn.addEventListener('click', closePanel);
    cancelBtn.addEventListener('click', closePanel);

    form.addEventListener('submit', handleSubmit);

    if (repeatToggle) {
        repeatToggle.addEventListener('change', () => {
            toggleRepeatDaysSection(repeatToggle.checked);
        });
    }
}

function openPanel(horario = null) {
    const panel = document.getElementById('horarioPanel');
    const form = document.getElementById('horarioForm');
    const title = document.getElementById('panelTitle');

    if (horario) {
        title.textContent = t('horarios.edit', { fallback: 'Editar Horário' });
        document.getElementById('horarioId').value = horario._id;
        document.getElementById('diaSemana').value = horario.diaSemana;
        document.getElementById('horaInicio').value = horario.horaInicio;
        document.getElementById('horaFim').value = horario.horaFim;
        document.getElementById('duracaoConsulta').value = horario.duracaoConsulta;
        document.getElementById('observacoes').value = horario.observacoes || '';
        document.getElementById('ativo').checked = horario.ativo;
        const repeatToggle = document.getElementById('repeatDaysToggle');
        if (repeatToggle) {
            repeatToggle.checked = false;
            repeatToggle.disabled = true;
        }
        toggleRepeatDaysSection(false);
    } else {
        title.textContent = t('horarios.add', { fallback: 'Adicionar Horário' });
        form.reset();
        document.getElementById('horarioId').value = '';
        document.getElementById('ativo').checked = true;
        const repeatToggle = document.getElementById('repeatDaysToggle');
        if (repeatToggle) {
            repeatToggle.checked = false;
            repeatToggle.disabled = false;
        }
        toggleRepeatDaysSection(false);
    }

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closePanel() {
    const panel = document.getElementById('horarioPanel');
    const form = document.getElementById('horarioForm');
    
    panel.style.display = 'none';
    form.reset();
    document.getElementById('horarioId').value = '';
    const repeatToggle = document.getElementById('repeatDaysToggle');
    if (repeatToggle) {
        repeatToggle.checked = false;
        repeatToggle.disabled = false;
    }
    toggleRepeatDaysSection(false);
}

function toggleRepeatDaysSection(show) {
    const repeatSection = document.getElementById('repeatDaysSection');
    const repeatChecks = document.querySelectorAll('.repeat-day-checkbox');
    if (repeatSection) {
        repeatSection.style.display = show ? 'block' : 'none';
    }
    if (!show) {
        repeatChecks.forEach((checkbox) => {
            checkbox.checked = false;
        });
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    if (isSaving) return;

    const id = document.getElementById('horarioId').value;
    const saveBtn = document.getElementById('saveHorarioBtn');
    const repeatToggle = document.getElementById('repeatDaysToggle');
    const data = {
        diaSemana: parseInt(document.getElementById('diaSemana').value),
        horaInicio: document.getElementById('horaInicio').value,
        horaFim: document.getElementById('horaFim').value,
        duracaoConsulta: parseInt(document.getElementById('duracaoConsulta').value),
        observacoes: document.getElementById('observacoes').value,
        ativo: document.getElementById('ativo').checked
    };

    try {
        isSaving = true;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('horarios.saving', { fallback: 'Salvando...' })}`;
        }

        let response;
        if (id) {
            // Atualizar
            response = await fetch(`${API_URL}/api/horarios-disponibilidade/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
        } else {
            const diasSelecionados = Array.from(
                document.querySelectorAll('.repeat-day-checkbox:checked')
            ).map((checkbox) => Number(checkbox.value));

            const diasParaCriar = new Set([data.diaSemana, ...diasSelecionados]);

            if (repeatToggle?.checked && diasParaCriar.size > 1) {
                const payloads = Array.from(diasParaCriar).map((dia) => ({
                    ...data,
                    diaSemana: dia
                }));

                const results = await Promise.allSettled(
                    payloads.map((payload) =>
                        fetch(`${API_URL}/api/horarios-disponibilidade`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify(payload)
                        })
                    )
                );

                const successCount = results.filter(
                    (result) => result.status === 'fulfilled' && result.value.ok
                ).length;
                const failCount = payloads.length - successCount;

                if (successCount === 0) {
                    throw new Error(t('horarios.errorCreateMany', { fallback: 'Não foi possível criar os horários selecionados' }));
                }

                if (failCount > 0) {
                    await Swal.fire({
                        title: t('horarios.partialTitle', { fallback: 'Cadastro parcial' }),
                        text: t('horarios.partialText', { success: successCount, failed: failCount, fallback: `${successCount} horário(s) criado(s) e ${failCount} falhou/falharam.` }),
                        icon: 'warning',
                        confirmButtonText: t('horarios.understood', { fallback: 'Entendi' }),
                        confirmButtonColor: '#002A42'
                    });
                }

                showToast(t('horarios.createManySuccess', { count: successCount, fallback: `${successCount} horário(s) cadastrado(s) com sucesso!` }));
                closePanel();
                loadHorarios();
                return;
            }

            response = await fetch(`${API_URL}/api/horarios-disponibilidade`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || t('horarios.errorSave', { fallback: 'Erro ao salvar horário' }));
        }

        showToast(id
            ? t('horarios.updatedSuccess', { fallback: 'Horário atualizado com sucesso!' })
            : t('horarios.createdSuccess', { fallback: 'Horário cadastrado com sucesso!' })
        );
        closePanel();
        loadHorarios();
    } catch (error) {
        console.error('Erro ao salvar horário:', error);
        showToast(error.message, 'error');
    } finally {
        isSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('horarios.save', { fallback: 'Salvar' })}`;
        }
    }
}

function editHorario(id) {
    const horario = horarios.find(h => h._id === id);
    if (horario) {
        openPanel(horario);
    }
}

async function deleteHorario(id) {
    const result = await Swal.fire({
        title: t('horarios.confirmTitle', { fallback: 'Tem certeza?' }),
        text: t('horarios.deleteWarning', { fallback: 'Esta ação não pode ser desfeita!' }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: t('horarios.confirmDeleteOne', { fallback: 'Sim, excluir' }),
        cancelButtonText: t('horarios.cancel', { fallback: 'Cancelar' })
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/horarios-disponibilidade/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(t('horarios.errorDelete', { fallback: 'Erro ao excluir horário' }));
        }

        selectedHorarioIds.delete(id);
        showToast(t('horarios.deletedSuccess', { fallback: 'Horário excluído com sucesso!' }));
        loadHorarios();
    } catch (error) {
        console.error('Erro ao excluir horário:', error);
        showToast(error.message, 'error');
    }
}

function initFilters() {
    const showInactiveCheckbox = document.getElementById('showInactive');
    
    showInactiveCheckbox.addEventListener('change', (e) => {
        showInactive = e.target.checked;
        renderHorarios();
    });
}

// Exportar função para uso global se necessário
window.createHorarioCard = createHorarioCard;



