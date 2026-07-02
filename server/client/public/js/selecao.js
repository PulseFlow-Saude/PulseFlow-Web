import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';

let inputCPF;
let inputCodigo;
let btnAcesso;
let msgErro;
let codigoGroup;
let identifierValido = false;
let doctorCountry = 'BR';
let identifierMode = 'cpf';

function formatarCPF(cpf = '') {
  const digits = String(cpf).replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarSSN(ssn = '') {
  const digits = String(ssn).replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function getAuthHeaders(includeContentType = true) {
  const token = localStorage.getItem('token');
  const headers = includeContentType ? { 'Content-Type': 'application/json' } : {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function isUsDoctor() {
  return doctorCountry === 'US';
}

function getIdentifierDigits() {
  return inputCPF.value.replace(/\D/g, '');
}

function isIdentifierValid(digits) {
  if (identifierMode === 'ssn') return digits.length === 9;
  return digits.length === 11;
}

function buildSearchQueryParam(digits) {
  if (identifierMode === 'ssn') return `ssn=${encodeURIComponent(digits)}`;
  return `cpf=${encodeURIComponent(digits)}`;
}

function buildSearchBody(digits) {
  if (identifierMode === 'ssn') return { ssn: digits };
  return { cpf: digits };
}

function applyIdentifierUi() {
  const us = isUsDoctor();
  identifierMode = us ? 'ssn' : 'cpf';

  const label = document.getElementById('label-input-cpf');
  const input = document.getElementById('input-cpf');
  const heroDesc = document.getElementById('selecao-hero-desc');
  const cardDesc = document.getElementById('selecao-card-desc');
  const howTo1 = document.getElementById('selecao-howto-1');

  if (label) {
    label.textContent = us
      ? t('selecao.labelSSN', { fallback: 'Patient SSN' })
      : t('selecao.labelCPF');
  }
  if (input) {
    input.placeholder = us
      ? t('selecao.placeholderSSN', { fallback: '000-00-0000' })
      : t('selecao.placeholderCPF');
    input.maxLength = us ? 11 : 14;
  }
  if (heroDesc) {
    heroDesc.textContent = us
      ? t('selecao.heroDescUS', {
          fallback:
            'Locate records securely using SSN or the authorization code shared by the patient.',
        })
      : t('selecao.heroDesc');
  }
  if (cardDesc) {
    cardDesc.textContent = us
      ? t('selecao.cardDescUS', {
          fallback:
            'Enter the patient SSN to request access and use the authorization code to open the chart.',
        })
      : t('selecao.cardDesc');
  }
  if (howTo1) {
    howTo1.textContent = us
      ? t('selecao.howTo1US', {
          fallback: 'Enter the patient full SSN and click "Request access".',
        })
      : t('selecao.howTo1');
  }

  document.body.classList.toggle('selecao-country-us', us);
  document.body.classList.toggle('selecao-country-br', !us);

  const icon = document.getElementById('identifier-input-icon');
  if (icon) {
    icon.className = us ? 'fas fa-fingerprint' : 'fas fa-id-card';
  }

  const banner = document.getElementById('selecao-region-banner');
  const bannerText = document.getElementById('selecao-region-banner-text');
  if (banner && bannerText) {
    if (us) {
      banner.hidden = false;
      bannerText.textContent = t('selecao.usModeBanner', {
        fallback: 'Modo EUA — busque pacientes pelo SSN',
      });
    } else {
      banner.hidden = true;
    }
  }
}

async function loadDoctorCountry() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return;
    const medico = await res.json();
    doctorCountry = medico.country === 'US' ? 'US' : 'BR';
  } catch (_) {
    doctorCountry = 'BR';
  }
}

async function init() {
  document.body.classList.add('selecao-init-pending');
  await loadDoctorCountry();

  const guard = await initApp({ titleKey: 'selecao.title', activePage: 'selecao' });
  if (!guard.ok) {
    document.body.classList.remove('selecao-init-pending');
    return;
  }

  const toggleButton = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  toggleButton?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
    toggleButton.classList.toggle('shifted');
  });

  bindLogout();
  inputCPF = document.getElementById('input-cpf');
  inputCodigo = document.getElementById('input-codigo');
  btnAcesso = document.querySelector('#btn-acesso');
  msgErro = document.getElementById('mensagem-erro');
  codigoGroup = document.getElementById('codigo-group');

  applyIdentifierUi();
  document.body.classList.remove('selecao-init-pending');
  bindFormEvents();
  bindInfoPanel();

  identifierValido = false;
  codigoGroup.style.display = 'none';
  inputCodigo.value = '';
  const initialSpan = btnAcesso.querySelector('span');
  if (initialSpan) initialSpan.textContent = t('selecao.btnRequest');

  const saved = localStorage.getItem('patientIdentifierSelecionado');
  if (saved) {
    inputCPF.value = isUsDoctor() ? formatarSSN(saved) : formatarCPF(saved);
  } else {
    const cpfSalvo = localStorage.getItem('cpfSelecionado');
    if (cpfSalvo) {
      inputCPF.value = isUsDoctor() ? formatarSSN(cpfSalvo) : formatarCPF(cpfSalvo);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function bindLogout() {
  const logoutBtn = document.getElementById('headerLogoutButton');
  if (!logoutBtn) return;

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
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('token');
        localStorage.removeItem('pacienteSelecionado');
        localStorage.removeItem('tokenPaciente');
        localStorage.removeItem('cpfSelecionado');
        localStorage.removeItem('patientIdentifierSelecionado');

        Swal.fire({
          title: t('selecao.swalLogoutDone'),
          text: t('selecao.swalLogoutSuccess'),
          icon: 'success',
          confirmButtonColor: '#00324A',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          window.location.href = 'login.html';
        });
      }
    });
  });
}

function bindFormEvents() {
  inputCPF.addEventListener('input', () => {
    const digits = inputCPF.value.replace(/\D/g, '');
    inputCPF.value = isUsDoctor() ? formatarSSN(digits) : formatarCPF(digits);

    identifierValido = false;
    codigoGroup.style.display = 'none';
    inputCodigo.value = '';
    const span = btnAcesso.querySelector('span');
    if (span) span.textContent = t('selecao.btnRequest');
    msgErro.textContent = '';
    msgErro.classList.remove('ativo');
    msgErro.style.color = '';
  });

  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
  });

  btnAcesso.addEventListener('click', async () => {
    const digits = getIdentifierDigits();

    msgErro.textContent = '';
    msgErro.classList.remove('ativo');

    if (!digits || !isIdentifierValid(digits)) {
      msgErro.textContent =
        '⚠️ ' +
        (isUsDoctor()
          ? t('selecao.errSSNInvalid', { fallback: 'Enter a valid 9-digit SSN.' })
          : t('selecao.errCPFInvalid'));
      msgErro.classList.add('ativo');
      return;
    }

    if (!identifierValido) {
      await verificarIdentificador(digits);
    } else {
      await buscarComCodigo(digits);
    }
  });
}

function bindInfoPanel() {
  document.querySelectorAll('.info-trigger').forEach((button) => {
    const panelId = button.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (!panel) return;

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('open', !expanded);
    });
  });
}

async function enviarNotificacaoPaciente(digits) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const resMedico = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: getAuthHeaders(),
    });

    if (resMedico.ok) {
      const medico = await resMedico.json();
      await fetch(`${API_URL}/api/access-code/notificar-solicitacao`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...buildSearchBody(digits),
          medicoNome: medico.nome,
          especialidade: medico.areaAtuacao || medico.especialidade,
        }),
      });
    }
  } catch (error) {
    console.log('⚠️ Não foi possível enviar notificação:', error);
  }
}

async function verificarIdentificador(digits) {
  try {
    const res = await fetch(
      `${API_URL}/api/pacientes/buscar?${buildSearchQueryParam(digits)}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      msgErro.textContent =
        '⚠️ ' +
        (data.message ||
          (isUsDoctor()
            ? t('selecao.errSSNNotFound', { fallback: 'Patient not found for this SSN.' })
            : t('selecao.errCPFNotFound')));
      msgErro.classList.add('ativo');
      return;
    }

    identifierValido = true;
    codigoGroup.style.display = 'block';
    const span = btnAcesso.querySelector('span');
    if (span) span.textContent = t('selecao.btnAccessCode');
    inputCodigo.focus();

    msgErro.textContent =
      '✅ ' +
      (isUsDoctor()
        ? t('selecao.msgSSNFound', { fallback: 'Patient found. Enter the access code.' })
        : t('selecao.msgCPFFound'));
    msgErro.classList.add('ativo');
    msgErro.style.color = '#4CAF50';

    await enviarNotificacaoPaciente(digits);
  } catch (err) {
    console.error(err);
    msgErro.textContent = '⚠️ ' + t('selecao.errConnection');
    msgErro.classList.add('ativo');
  }
}

async function buscarComCodigo(digits) {
  const codigoAcesso = inputCodigo.value.replace(/\D/g, '');

  if (!codigoAcesso || codigoAcesso.length !== 6) {
    msgErro.textContent = '⚠️ ' + t('selecao.errCodeInvalid');
    msgErro.classList.add('ativo');
    return;
  }

  try {
    const requestBody = {
      ...buildSearchBody(digits),
      codigoAcesso,
    };

    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/api/pacientes/buscar-com-codigo`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    if (!res.ok) {
      msgErro.textContent = '⚠️ ' + (data.message || t('selecao.errCodeExpired'));
      msgErro.classList.add('ativo');
      return;
    }

    localStorage.setItem('pacienteSelecionado', JSON.stringify(data));
    localStorage.setItem('patientIdentifierSelecionado', digits);
    localStorage.setItem('cpfSelecionado', digits);

    const tokenPaciente = btoa(
      JSON.stringify({
        type: identifierMode,
        identifier: digits,
        cpf: identifierMode === 'cpf' ? digits : undefined,
        ssn: identifierMode === 'ssn' ? digits : undefined,
      })
    );
    localStorage.setItem('tokenPaciente', tokenPaciente);

    window.location.href = 'perfilPaciente.html';
  } catch (err) {
    console.error(err);
    msgErro.textContent = '⚠️ ' + t('selecao.errConnection');
    msgErro.classList.add('ativo');
  }
}
