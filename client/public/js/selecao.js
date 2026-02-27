import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';

let inputCPF;
let inputCodigo;
let btnAcesso;
let msgErro;
let codigoGroup;
let cpfValido = false;

async function init() {
  await initApp({ titleKey: 'selecao.title', activePage: 'selecao' });

  const toggleButton = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  toggleButton?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
    toggleButton.classList.toggle('shifted');
  });

  await ensureProfile();

  inputCPF = document.getElementById('input-cpf');
  inputCodigo = document.getElementById('input-codigo');
  btnAcesso = document.querySelector('#btn-acesso');
  msgErro = document.getElementById('mensagem-erro');
  codigoGroup = document.getElementById('codigo-group');

  bindLogout();
  bindFormEvents();
  bindInfoPanel();

  const cpfSalvo = localStorage.getItem('cpfSelecionado');
  if (cpfSalvo) {
    inputCPF.value = formatarCPF(cpfSalvo);
    cpfValido = true;
    codigoGroup.style.display = 'block';
    const span = btnAcesso.querySelector('span');
    if (span) span.textContent = t('selecao.btnAccessCode');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function ensureProfile() {
  const token = localStorage.getItem('token');
  if (!token) {
    await Swal.fire({
      title: t('selecao.swalError'),
      text: t('selecao.swalLoginRequired'),
      icon: 'error',
      confirmButtonText: t('selecao.swalGoLogin'),
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/login.html';
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(t('selecao.errLoadUser'));
    }

    const data = await response.json();

    if (data.validationStatus && data.validationStatus !== 'approved') {
      window.location.href = '/client/views/perfilMedico.html';
      return null;
    }
    if (data.validationStatus) {
      localStorage.setItem('validationStatus', data.validationStatus);
    }
    if (data.role === 'admin' || data.isAdmin === true) {
      localStorage.setItem('isAdmin', 'true');
    } else {
      localStorage.removeItem('isAdmin');
    }

    if (window.updateSidebarInfo) {
      window.updateSidebarInfo(data.nome, data.areaAtuacao, data.genero, data.crm);
    }

    return data;
  } catch (error) {
    await Swal.fire({
      title: t('selecao.swalError'),
      text: t('selecao.swalLoadError'),
      icon: 'error',
      confirmButtonText: t('selecao.swalGoLogin'),
      confirmButtonColor: '#002A42'
    });
    localStorage.removeItem('token');
    window.location.href = '/client/views/login.html';
    return null;
  }
}

function bindLogout() {
  const logoutBtn = document.getElementById('headerLogoutButton');
  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener('click', () => {
    Swal.fire({
      title: t('selecao.swalLogoutTitle'),
      text: t('selecao.swalLogoutText'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('selecao.swalLogoutYes'),
      cancelButtonText: t('selecao.swalLogoutCancel'),
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#00324A',
      reverseButtons: true
    }).then(result => {
      if (result.isConfirmed) {
        localStorage.removeItem('token');
        localStorage.removeItem('pacienteSelecionado');
        localStorage.removeItem('tokenPaciente');

        Swal.fire({
          title: t('selecao.swalLogoutDone'),
          text: t('selecao.swalLogoutSuccess'),
          icon: 'success',
          confirmButtonColor: '#00324A',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          window.location.href = 'login.html';
        });
      }
    });
  });
}

function bindFormEvents() {
  inputCPF.addEventListener('input', () => {
    let value = inputCPF.value.replace(/\D/g, '').slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    inputCPF.value = value;
  });

  inputCodigo.addEventListener('input', () => {
    let value = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
    inputCodigo.value = value;
  });

  btnAcesso.addEventListener('click', async () => {
    const cpfLimpo = inputCPF.value.replace(/\D/g, '');

    msgErro.textContent = '';
    msgErro.classList.remove('ativo');

    if (!cpfLimpo || cpfLimpo.length !== 11) {
      msgErro.textContent = '⚠️ ' + t('selecao.errCPFInvalid');
      msgErro.classList.add('ativo');
      return;
    }

    if (!cpfValido) {
      await verificarCPF(cpfLimpo);
    } else {
      await buscarComCodigo(cpfLimpo);
    }
  });
}

function bindInfoPanel() {
  document.querySelectorAll('.info-trigger').forEach(button => {
    const panelId = button.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('open', !expanded);
    });
  });
}

// Função para enviar notificação ao paciente
async function enviarNotificacaoPaciente(cpfLimpo) {
  try {
    // Buscar dados do médico logado
    const token = localStorage.getItem('token');
    if (!token) return;

    const resMedico = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (resMedico.ok) {
      const medico = await resMedico.json();
      
      // Enviar notificação
      await fetch(`${API_URL}/api/access-code/notificar-solicitacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cpf: cpfLimpo,
          medicoNome: medico.nome,
          especialidade: medico.areaAtuacao || medico.especialidade
        })
      });
      
      console.log('✅ Notificação enviada ao paciente');
    }
  } catch (error) {
    console.log('⚠️ Não foi possível enviar notificação:', error);
  }
}

// Função para verificar se o CPF existe
async function verificarCPF(cpfLimpo) {
  try {
    const res = await fetch(`${API_URL}/api/pacientes/buscar?cpf=${cpfLimpo}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      msgErro.textContent = '⚠️ ' + (data.message || t('selecao.errCPFNotFound'));
      msgErro.classList.add('ativo');
      return;
    }

    cpfValido = true;
    codigoGroup.style.display = 'block';
    const span = btnAcesso.querySelector('span');
    if (span) span.textContent = t('selecao.btnAccessCode');
    inputCodigo.focus();
    
    msgErro.textContent = '✅ ' + t('selecao.msgCPFFound');
    msgErro.classList.add('ativo');
    msgErro.style.color = '#4CAF50';

    // Enviar notificação ao paciente
    await enviarNotificacaoPaciente(cpfLimpo);

  } catch (err) {
    console.error(err);
    msgErro.textContent = '⚠️ ' + t('selecao.errConnection');
    msgErro.classList.add('ativo');
  }
}

// Função para buscar paciente com CPF + código
async function buscarComCodigo(cpfLimpo) {
  const codigoAcesso = inputCodigo.value.replace(/\D/g, '');

  if (!codigoAcesso || codigoAcesso.length !== 6) {
    msgErro.textContent = '⚠️ ' + t('selecao.errCodeInvalid');
    msgErro.classList.add('ativo');
    return;
  }

  try {
    const requestBody = {
      cpf: cpfLimpo,
      codigoAcesso: codigoAcesso
    };

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api/pacientes/buscar-com-codigo`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();

    if (!res.ok) {
      msgErro.textContent = '⚠️ ' + (data.message || t('selecao.errCodeExpired'));
      msgErro.classList.add('ativo');
      return;
    }

    localStorage.setItem('pacienteSelecionado', JSON.stringify(data));

    const cpfCodificado = cpfLimpo.replace(/[^\d]/g, '');
    const tokenPaciente = btoa(JSON.stringify({ cpf: cpfCodificado }));
    localStorage.setItem('tokenPaciente', tokenPaciente);

    window.location.href = 'perfilPaciente.html';
  } catch (err) {
    console.error(err);
    msgErro.textContent = '⚠️ ' + t('selecao.errConnection');
    msgErro.classList.add('ativo');
  }
}