import { API_URL } from './config.js';
import { t, getLanguage } from './i18n.js';

const escapeHTML = (str) =>
  str
    ? str.replace(/[&<>"']/g, (char) => {
        const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return entities[char] || char;
      })
    : '';

const formatDateLong = (dateString) => {
  if (!dateString) return '';
  try {
    if (dateString.length === 10) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
    } else {
      const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(dateString));
    }
  } catch (_) {
    return dateString;
  }
};

const formatTime = (timeString) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes || '00'}`;
};

const showToast = (message, icon = 'info') => {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  } else {
    alert(message);
  }
};

const getToken = () => localStorage.getItem('token');

const ensureAuthenticated = () => {
  const token = getToken();
  if (!token) {
    Swal.fire({
      icon: 'warning',
      title: t('agendamentos.sessionExpired', { fallback: 'Sessão expirada' }),
      text: t('agendamentoNovo.loginAgainToSchedule', { fallback: 'Faça login novamente para agendar consultas.' }),
      confirmButtonColor: '#002a42',
    }).then(() => {
      window.location.href = '/client/views/login.html';
    });
    return null;
  }
  return token;
};

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const buildIsoDateTime = (date, time) => {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000`;
  const testDate = new Date(dateStr);
  if (Number.isNaN(testDate.getTime())) return null;
  return dateStr;
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formNovoAgendamento');
  const cancelarBtn = document.getElementById('cancelarCadastro');
  const voltarBtn = document.getElementById('voltarLista');
  const enviarConfirmacaoBtn = document.getElementById('enviarConfirmacao');
  const enviarConfirmacaoLabel = document.getElementById('enviarConfirmacaoLabel');
  const salvarAgendamentoBtn = document.getElementById('salvarAgendamentoBtn');
  const resumo = document.getElementById('resumoAgendamento');
  const buscarPacienteBtn = document.querySelector('[data-action="buscar-paciente"]');
  const verAgendaSemanaBtn = document.querySelector('[data-action="ver-agenda-semana"]');
  const pacienteIdInput = document.getElementById('pacienteId');

  let pacienteAtual = null;
  let enviarConfirmacaoAtiva = true;
  let isSubmitting = false;

  const voltarParaLista = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/client/views/agendamentos.html';
    }
  };

  const preencherPaciente = (paciente) => {
    pacienteAtual = paciente;
    if (pacienteIdInput && paciente?.id) {
      pacienteIdInput.value = paciente.id;
    }
    if (form?.nomePaciente && paciente?.nome) {
      form.nomePaciente.value = paciente.nome;
    }
    if (form?.contatoPaciente && (paciente?.telefone || paciente?.phone)) {
      form.contatoPaciente.value = paciente.telefone || paciente.phone;
    }
    atualizarResumo();
  };

  const carregarPacienteSalvo = () => {
    try {
      const salvo = localStorage.getItem('pacienteSelecionado');
      if (!salvo) return;
      const paciente = JSON.parse(salvo);
      if (!paciente) return;
      preencherPaciente({
        id: paciente.id || paciente._id,
        nome: paciente.nome || paciente.name,
        telefone: paciente.telefone || paciente.phone,
      });
    } catch (error) {
      console.error('Erro ao carregar paciente salvo:', error);
    }
  };

  const buscarPaciente = async () => {
    const { value: cpfInput } = await Swal.fire({
      title: t('agendamentoNovo.searchPatient', { fallback: 'Buscar paciente' }),
      input: 'text',
      inputLabel: t('agendamentoNovo.informPatientCpf', { fallback: 'Informe o CPF do paciente' }),
      inputPlaceholder: '000.000.000-00',
      inputAttributes: {
        autocapitalize: 'off',
      },
      showCancelButton: true,
      confirmButtonText: t('agendamentoNovo.search', { fallback: 'Buscar' }),
      confirmButtonColor: '#002a42',
      cancelButtonText: t('agendamentoNovo.cancel', { fallback: 'Cancelar' }),
      cancelButtonColor: '#94a3b8',
      preConfirm: (value) => {
        if (!value) {
          Swal.showValidationMessage(t('agendamentoNovo.informPatientCpfValidation', { fallback: 'Informe o CPF do paciente' }));
          return false;
        }
        const somenteNumeros = value.replace(/\D/g, '');
        if (somenteNumeros.length !== 11) {
          Swal.showValidationMessage(t('agendamentoNovo.cpf11Digits', { fallback: 'CPF deve possuir 11 dígitos' }));
          return false;
        }
        return somenteNumeros;
      },
    });

    if (!cpfInput) return;

    const token = ensureAuthenticated();
    if (!token) return;

    try {
      Swal.fire({
        title: t('agendamentoNovo.searchingPatient', { fallback: 'Buscando paciente...' }),
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const response = await fetch(`${API_URL}/api/pacientes/buscar?cpf=${cpfInput}`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('agendamentoNovo.patientNotFound', { fallback: 'Paciente não encontrado.' }));
      }

      preencherPaciente({
        id: data.id,
        nome: data.nome,
        telefone: data.telefone || data.phone,
      });

      showToast(t('agendamentoNovo.patientLinked', { fallback: 'Paciente vinculado ao agendamento.' }), 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || t('agendamentoNovo.errorSearchPatient', { fallback: 'Erro ao buscar paciente.' }), 'error');
    } finally {
      Swal.close();
    }
  };

  const atualizarResumo = () => {
    if (!resumo || !form) return;
    const nomePaciente =
      pacienteAtual?.nome || form.nomePaciente.value.trim() || t('agendamentoNovo.selectPatient', { fallback: 'Selecione um paciente' });
    const contatoPaciente =
      form.contatoPaciente.value.trim() || pacienteAtual?.telefone || pacienteAtual?.phone || '';

    const valores = {
      paciente: nomePaciente,
      contato: contatoPaciente,
      data: form.dataConsulta.value ? formatDateLong(form.dataConsulta.value) : t('agendamentoNovo.selectAgenda', { fallback: 'Selecione a agenda disponível' }),
      hora: form.horaConsulta.value ? formatTime(form.horaConsulta.value) : '',
      tipo: form.tipoAtendimento.value,
      local: form.localAtendimento.value.trim(),
    };

    const formatoLabel =
      valores.tipo === 'online'
        ? t('agendamentos.teleconsultation', { fallback: 'Teleconsulta' })
        : valores.tipo === 'domiciliar'
          ? t('agendamentos.homeVisit', { fallback: 'Visita domiciliar' })
          : t('agendamentos.inPerson', { fallback: 'Presencial' });

    resumo.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">${t('agendamentoNovo.patient', { fallback: 'Paciente' })}</span>
        <span class="summary-value">${escapeHTML(valores.paciente)}</span>
        ${valores.contato ? `<span class="summary-note">${escapeHTML(valores.contato)}</span>` : ''}
      </div>
      <div class="summary-item">
        <span class="summary-label">${t('agendamentoNovo.dateTime', { fallback: 'Data & horário' })}</span>
        <span class="summary-value">${escapeHTML(valores.data)}</span>
        ${valores.hora ? `<span class="summary-note">${escapeHTML(formatTime(valores.hora))}</span>` : ''}
      </div>
      <div class="summary-item">
        <span class="summary-label">${t('agendamentoNovo.format', { fallback: 'Formato' })}</span>
        <span class="summary-value">${formatoLabel}</span>
        ${valores.local ? `<span class="summary-note">${escapeHTML(valores.local)}</span>` : ''}
      </div>
      <div class="summary-item">
        <span class="summary-label">${t('agendamentoNovo.status', { fallback: 'Status' })}</span>
        <span class="summary-status badge badge-agendada">${t('agendamentoNovo.preview', { fallback: 'Pré-visualização' })}</span>
      </div>
    `;
  };

  [
    'nomePaciente',
    'contatoPaciente',
    'observacoesPaciente',
    'dataConsulta',
    'horaConsulta',
    'tipoAtendimento',
    'localAtendimento',
  ].forEach((campo) => {
    const input = form?.elements.namedItem(campo);
    if (input) {
      input.addEventListener('input', atualizarResumo);
      input.addEventListener('change', atualizarResumo);
    }
  });

  const tipoAtendimentoSelect = form?.elements.namedItem('tipoAtendimento');
  const localAtendimentoInput = form?.elements.namedItem('localAtendimento');
  const labelLocalAtendimento = document.getElementById('labelLocalAtendimento');
  
  if (tipoAtendimentoSelect && localAtendimentoInput && labelLocalAtendimento) {
    const atualizarLabelLocal = () => {
      const tipo = tipoAtendimentoSelect.value;
      if (tipo === 'online') {
        labelLocalAtendimento.textContent = t('agendamentoNovo.videoCallLink', { fallback: 'Link da videochamada' });
        localAtendimentoInput.placeholder = t('agendamentoNovo.videoCallLinkPlaceholder', { fallback: 'Cole o link da reunião (Zoom, Meet, etc.)' });
      } else if (tipo === 'domiciliar') {
        labelLocalAtendimento.textContent = t('agendamentoNovo.visitAddress', { fallback: 'Endereço da visita' });
        localAtendimentoInput.placeholder = t('agendamentoNovo.visitAddressPlaceholder', { fallback: 'Informe o endereço completo' });
      } else {
        labelLocalAtendimento.textContent = t('agendamentoNovo.locationLabel', { fallback: 'Local (se presencial/domiciliar)' });
        localAtendimentoInput.placeholder = t('agendamentoNovo.locationPlaceholder', { fallback: 'Informe endereço ou sala' });
      }
    };
    
    tipoAtendimentoSelect.addEventListener('change', atualizarLabelLocal);
    atualizarLabelLocal();
  }

  carregarPacienteSalvo();
  atualizarResumo();

  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', (event) => {
      event.preventDefault();
      Swal.fire({
        title: t('agendamentoNovo.cancelRegistrationTitle', { fallback: 'Cancelar cadastro?' }),
        text: t('agendamentoNovo.cancelRegistrationText', { fallback: 'As informações preenchidas serão descartadas.' }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#002a42',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: t('agendamentoNovo.yesDiscard', { fallback: 'Sim, descartar' }),
        cancelButtonText: t('agendamentoNovo.keepFilling', { fallback: 'Manter preenchimento' }),
      }).then((result) => {
        if (result.isConfirmed) {
          voltarParaLista();
        }
      });
    });
  }

  if (voltarBtn) {
    voltarBtn.addEventListener('click', (event) => {
      event.preventDefault();
      voltarParaLista();
    });
  }

  if (enviarConfirmacaoBtn) {
    enviarConfirmacaoBtn.addEventListener('click', () => {
      enviarConfirmacaoAtiva = !enviarConfirmacaoAtiva;
      enviarConfirmacaoBtn.classList.toggle('is-active', enviarConfirmacaoAtiva);
      enviarConfirmacaoBtn.setAttribute('aria-pressed', enviarConfirmacaoAtiva ? 'true' : 'false');
      if (enviarConfirmacaoLabel) {
        enviarConfirmacaoLabel.textContent = enviarConfirmacaoAtiva
          ? t('agendamentoNovo.confirmationActive', { fallback: 'Confirmação ativa' })
          : t('agendamentoNovo.confirmationDisabled', { fallback: 'Confirmação desativada' });
      }
      Swal.fire({
        title: t('agendamentoNovo.confirmationSendTitle', { fallback: 'Envio de confirmação' }),
        text: enviarConfirmacaoAtiva
          ? t('agendamentoNovo.patientWillBeNotified', { fallback: 'O paciente será notificado após salvar o agendamento.' })
          : t('agendamentoNovo.notificationDisabledForAppointment', { fallback: 'Notificação de confirmação desativada para este agendamento.' }),
        icon: enviarConfirmacaoAtiva ? 'success' : 'info',
        confirmButtonColor: '#002a42',
      });
    });
  }

  if (verAgendaSemanaBtn) {
    verAgendaSemanaBtn.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/client/views/agendamentos.html';
    });
  }

  if (buscarPacienteBtn) {
    buscarPacienteBtn.addEventListener('click', (event) => {
      event.preventDefault();
      buscarPaciente();
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (!pacienteIdInput.value) {
        showToast(t('agendamentoNovo.searchAndSelectPatient', { fallback: 'Busque e selecione um paciente antes de salvar.' }), 'warning');
        return;
      }

      const dataConsulta = form.dataConsulta.value;
      const horaConsulta = form.horaConsulta.value;

      if (!dataConsulta || !horaConsulta) {
        showToast(t('agendamentoNovo.dateTimeRequired', { fallback: 'Data e horário são obrigatórios.' }), 'error');
        return;
      }

      const token = ensureAuthenticated();
      if (!token) return;

      const [horaInicioH, minutoInicioM] = horaConsulta.split(':').map(Number);
      const duracaoConsulta = form.duracaoConsulta.value ? Number(form.duracaoConsulta.value) : 30;
      const [ano, mes, dia] = dataConsulta.split('-').map(Number);
      
      const dataHoraObj = new Date(ano, mes - 1, dia, horaInicioH, minutoInicioM);
      if (dataHoraObj <= new Date()) {
        showToast(t('agendamentoNovo.futureDateTimeRequired', { fallback: 'A data e horário da consulta deve ser futura.' }), 'error');
        return;
      }

      const horaFimObj = new Date(dataHoraObj.getTime() + duracaoConsulta * 60000);
      const horaFim = `${String(horaFimObj.getHours()).padStart(2, '0')}:${String(horaFimObj.getMinutes()).padStart(2, '0')}`;

      const payload = {
        pacienteId: pacienteIdInput.value,
        data: dataConsulta,
        horaInicio: horaConsulta,
        horaFim: horaFim,
        tipoConsulta: form.tipoAtendimento.value,
        motivoConsulta: form.motivoConsulta.value.trim(),
        duracao: duracaoConsulta,
      };

      const observacoesConsulta = form.observacoesConsulta.value.trim();
      if (observacoesConsulta) {
        payload.observacoes = observacoesConsulta;
      }

      if (payload.tipoConsulta === 'online') {
        if (form.localAtendimento.value.trim()) {
          payload.linkVideochamada = form.localAtendimento.value.trim();
        }
      } else if (form.localAtendimento.value.trim()) {
        payload.endereco = {
          logradouro: form.localAtendimento.value.trim(),
        };
      }

      const observacoesPaciente = form.observacoesPaciente.value.trim();
      if (observacoesPaciente) {
        payload.observacoes = payload.observacoes
          ? `${observacoesPaciente}\n\n${payload.observacoes}`
          : observacoesPaciente;
      }

      try {
        isSubmitting = true;
        if (salvarAgendamentoBtn) {
          salvarAgendamentoBtn.disabled = true;
          salvarAgendamentoBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('agendamentoNovo.saving', { fallback: 'Salvando...' })}`;
        }

        const response = await fetch(`${API_URL}/api/agendamentos`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || t('agendamentoNovo.errorCreateAppointment', { fallback: 'Não foi possível criar o agendamento.' }));
        }

        Swal.fire({
          title: t('agendamentoNovo.createdTitle', { fallback: 'Agendamento criado!' }),
          html: `
            <p>${t('agendamentoNovo.createdMessage', {
              patient: `<strong>${escapeHTML(form.nomePaciente.value.trim())}</strong>`,
              date: `<strong>${formatDateLong(dataConsulta)}</strong>`,
              time: `<strong>${escapeHTML(formatTime(horaConsulta))}</strong>`,
              fallback: `O paciente <strong>${escapeHTML(form.nomePaciente.value.trim())}</strong> foi agendado para <strong>${formatDateLong(dataConsulta)}</strong> às <strong>${escapeHTML(formatTime(horaConsulta))}</strong>.`
            })}</p>
            <p class="swal-subtext">${
              enviarConfirmacaoAtiva
                ? t('agendamentoNovo.patientNotifiedWithDetails', { fallback: 'O paciente será notificado com os detalhes.' })
                : t('agendamentoNovo.savedWithoutNotification', { fallback: 'Agendamento salvo sem envio de notificação.' })
            }</p>
          `,
          icon: 'success',
          confirmButtonColor: '#002a42',
          confirmButtonText: t('agendamentoNovo.backToAppointments', { fallback: 'Voltar para agendamentos' }),
        }).then(() => {
          voltarParaLista();
        });
      } catch (error) {
        console.error(error);
        showToast(error.message || t('agendamentoNovo.errorCreatingAppointment', { fallback: 'Erro ao criar o agendamento.' }), 'error');
      } finally {
        isSubmitting = false;
        if (salvarAgendamentoBtn) {
          salvarAgendamentoBtn.disabled = false;
          salvarAgendamentoBtn.innerHTML = `<i class="fas fa-save"></i> ${t('agendamentoNovo.saveAppointment', { fallback: 'Salvar agendamento' })}`;
        }
      }
    });
  }
});

