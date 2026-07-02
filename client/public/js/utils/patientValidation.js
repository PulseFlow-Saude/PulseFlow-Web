import { t, getLanguage } from '../i18n.js';

const tx = (pt, en) => (getLanguage() === 'en' ? en : pt);

export function hasActivePatient() {
  const pacienteSelecionado = localStorage.getItem('pacienteSelecionado');
  const tokenPaciente = localStorage.getItem('tokenPaciente');
  return !!(pacienteSelecionado && tokenPaciente);
}

export function getActivePatient() {
  try {
    const pacienteSelecionado = localStorage.getItem('pacienteSelecionado');
    if (pacienteSelecionado) {
      return JSON.parse(pacienteSelecionado);
    }
  } catch (error) {
    console.error('Erro ao obter informações do paciente:', error);
  }
  return null;
}

function decodeTokenPaciente() {
  const tokenPaciente = localStorage.getItem('tokenPaciente');
  if (!tokenPaciente) return null;
  try {
    return JSON.parse(atob(tokenPaciente));
  } catch (error) {
    console.error('Erro ao decodificar token do paciente:', error);
    return null;
  }
}

/** Retorna { type: 'cpf'|'ssn', value: string } */
export function getPatientIdentifier() {
  const paciente = getActivePatient();
  if (paciente?.identifier && paciente?.identifierType) {
    return {
      type: paciente.identifierType,
      value: String(paciente.identifier).replace(/\D/g, ''),
    };
  }

  if (paciente?.socialSecurityNumber) {
    const ssn = String(paciente.socialSecurityNumber).replace(/\D/g, '');
    if (ssn.length === 9) return { type: 'ssn', value: ssn };
  }

  if (paciente?.cpf) {
    const cpf = String(paciente.cpf).replace(/\D/g, '');
    if (cpf.length === 11) return { type: 'cpf', value: cpf };
    if (cpf.length === 9 && paciente.residenceCountry === 'US') {
      return { type: 'ssn', value: cpf };
    }
  }

  const decoded = decodeTokenPaciente();
  if (decoded?.identifier && decoded?.type) {
    return {
      type: decoded.type,
      value: String(decoded.identifier).replace(/\D/g, ''),
    };
  }
  if (decoded?.ssn) {
    return { type: 'ssn', value: String(decoded.ssn).replace(/\D/g, '') };
  }
  if (decoded?.cpf) {
    return { type: 'cpf', value: String(decoded.cpf).replace(/\D/g, '') };
  }

  return null;
}

/** Extrai identificador de um objeto paciente (localStorage / API). */
export function resolveIdentifierFromPacienteObject(paciente = {}) {
  if (!paciente || typeof paciente !== 'object') return null;

  if (paciente.identifier && paciente.identifierType) {
    return {
      type: paciente.identifierType,
      value: String(paciente.identifier).replace(/\D/g, ''),
    };
  }

  const ssn = String(paciente.socialSecurityNumber || '').replace(/\D/g, '');
  if (ssn.length === 9) return { type: 'ssn', value: ssn };

  const rc = String(paciente.residenceCountry || '').toUpperCase();
  const cpfDigits = String(paciente.cpf || '').replace(/\D/g, '');
  if (rc === 'US' && cpfDigits.length === 9) return { type: 'ssn', value: cpfDigits };
  if (cpfDigits.length === 11) return { type: 'cpf', value: cpfDigits };
  if (cpfDigits.length === 9) return { type: 'ssn', value: cpfDigits };

  return null;
}

export function buildPatientQueryParamFromObject(paciente) {
  const id = resolveIdentifierFromPacienteObject(paciente);
  if (!id?.value) return '';
  if (id.type === 'ssn') return `ssn=${encodeURIComponent(id.value)}`;
  return `cpf=${encodeURIComponent(id.value)}`;
}

/** Campos para body JSON (cpf ou ssn). */
export function buildPatientBodyFields(source = null) {
  let id = null;
  if (source?.identifierType && source?.identifier) {
    id = {
      type: source.identifierType,
      value: String(source.identifier).replace(/\D/g, ''),
    };
  } else if (source?.type && (source?.identifier || source?.value)) {
    id = {
      type: source.type,
      value: String(source.identifier || source.value).replace(/\D/g, ''),
    };
  } else if (source?.ssn) {
    id = { type: 'ssn', value: String(source.ssn).replace(/\D/g, '') };
  } else if (source && typeof source === 'object' && !source.type && !source.identifierType) {
    id = resolveIdentifierFromPacienteObject(source);
  } else if (source?.cpf) {
    const digits = String(source.cpf).replace(/\D/g, '');
    if (digits.length === 9) id = { type: 'ssn', value: digits };
    else if (digits.length === 11) id = { type: 'cpf', value: digits };
  } else {
    id = getPatientIdentifier();
  }
  if (!id?.value) return {};
  return id.type === 'ssn' ? { ssn: id.value } : { cpf: id.value };
}

/** Segmento de URL (/perfil/:id, /insights/:id). */
export function getPatientPathSegment() {
  return getPatientIdentifier()?.value || '';
}

export function getPatientCPF() {
  const id = getPatientIdentifier();
  return id?.value || null;
}

export function buildPatientQueryParam() {
  const id = getPatientIdentifier();
  if (!id?.value) return '';
  if (id.type === 'ssn') return `ssn=${encodeURIComponent(id.value)}`;
  return `cpf=${encodeURIComponent(id.value)}`;
}

export function maskPatientIdentifier(type, value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (type === 'ssn' || digits.length === 9) {
    if (digits.length < 4) return '***-**-****';
    return `***-**-${digits.slice(-4)}`;
  }
  if (digits.length < 2) return '***.***.***-**';
  return `***.***.***-${digits.slice(-2)}`;
}

export function getPatientResidenceCountry(paciente) {
  if (!paciente) return 'BR';
  const rc = String(paciente.residenceCountry || '').toUpperCase();
  if (rc === 'US') return 'US';
  const id = resolveIdentifierFromPacienteObject(paciente);
  if (id?.type === 'ssn') return 'US';
  return 'BR';
}

export function getPatientIdentifierLabel(type) {
  return type === 'ssn'
    ? t('common.ssn', { fallback: 'SSN' })
    : t('common.cpf', { fallback: 'CPF' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPatientHeaderBadgeHtml() {
  if (!hasActivePatient()) return '';
  const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
  if (path.includes('selecao.html')) return '';

  const paciente = getActivePatient();
  const id = getPatientIdentifier();
  if (!paciente || !id?.value) return '';

  const country = getPatientResidenceCountry(paciente);
  const name = paciente.nome || paciente.name || tx('Paciente', 'Patient');
  const masked = maskPatientIdentifier(id.type, id.value);
  const label = getPatientIdentifierLabel(id.type);
  const countryClass =
    country === 'US' ? 'header-patient-chip__flag--us' : 'header-patient-chip__flag--br';
  const title = tx('Ver perfil do paciente', 'View patient profile');

  return `
    <a href="/client/views/perfilPaciente.html" class="header-patient-chip" title="${title}">
      <span class="header-patient-chip__flag ${countryClass}">${country}</span>
      <span class="header-patient-chip__name">${escapeHtml(name)}</span>
      <span class="header-patient-chip__sep" aria-hidden="true">·</span>
      <span class="header-patient-chip__id">${label} ${masked}</span>
    </a>
  `;
}

export function patientIdentifierNotFoundMessage() {
  return t('common.patientIdentifierNotFound', {
    fallback: tx(
      'Identificador do paciente não encontrado.',
      'Patient identifier not found.'
    ),
  });
}

export function validateActivePatient() {
  if (!hasActivePatient()) {
    return {
      valid: false,
      error: tx(
        'Nenhum paciente selecionado. Por favor, selecione um paciente primeiro.',
        'No patient selected. Please select a patient first.'
      ),
      redirect: 'selecao.html',
    };
  }

  const paciente = getActivePatient();
  const identifier = getPatientIdentifier();

  if (!paciente || !identifier?.value) {
    return {
      valid: false,
      error: tx(
        'Dados do paciente incompletos. Por favor, selecione um paciente novamente.',
        'Incomplete patient data. Please select a patient again.'
      ),
      redirect: 'selecao.html',
    };
  }

  return {
    valid: true,
    paciente,
    cpf: identifier.value,
    identifierType: identifier.type,
    identifier: identifier.value,
  };
}

export function redirectToPatientSelection(message = null) {
  clearPatientData();
  if (message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: t('agendamentos.error', { fallback: tx('Atenção', 'Attention') }),
        text: message,
        confirmButtonText: tx('Selecionar Paciente', 'Select Patient'),
        confirmButtonColor: '#002A42',
      }).then(() => {
        window.location.href = 'selecao.html';
      });
    } else {
      alert(message);
      window.location.href = 'selecao.html';
    }
  } else {
    window.location.href = 'selecao.html';
  }
}

export function clearPatientData() {
  localStorage.removeItem('pacienteSelecionado');
  localStorage.removeItem('tokenPaciente');
  localStorage.removeItem('cpfSelecionado');
  localStorage.removeItem('patientIdentifierSelecionado');
}

export async function handleApiError(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 403 && errorData.codigo === 'CONEXAO_INATIVA') {
      clearPatientData();
      const message =
        errorData.message ||
        tx(
          'Acesso negado. Você não tem uma conexão ativa com este paciente. Por favor, solicite acesso novamente.',
          'Access denied. You do not have an active connection with this patient. Please request access again.'
        );

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: tx('Acesso Revogado', 'Access Revoked'),
          text: message,
          confirmButtonText: tx('Selecionar Paciente', 'Select Patient'),
          confirmButtonColor: '#002A42',
        }).then(() => {
          window.location.href = 'selecao.html';
        });
      } else {
        alert(message);
        window.location.href = 'selecao.html';
      }
      return true;
    }
  }
  return false;
}
