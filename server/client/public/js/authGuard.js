import { API_URL } from './config.js';
import { getDoctorToken, clearAuthSession } from './authSession.js';
import { t } from './i18n.js';

function loginUrl() {
  return window.location.pathname.includes('/client/views/')
    ? 'login.html'
    : '/client/views/login.html';
}

export async function redirectToLogin(message) {
  if (typeof Swal !== 'undefined' && message) {
    await Swal.fire({
      title: t('selecao.swalError'),
      text: message,
      icon: 'error',
      confirmButtonText: t('selecao.swalGoLogin'),
      confirmButtonColor: '#002A42'
    });
  }
  clearAuthSession();
  window.location.href = loginUrl();
}

function persistProfileSession(data) {
  if (data.validationStatus) {
    localStorage.setItem('validationStatus', data.validationStatus);
  }
  if (data.hasChosenPlan !== undefined) {
    localStorage.setItem('hasChosenPlan', data.hasChosenPlan ? 'true' : 'false');
  }
  if (data.role === 'admin' || data.isAdmin === true) {
    localStorage.setItem('isAdmin', 'true');
  } else {
    localStorage.removeItem('isAdmin');
  }
}

/**
 * Garante sessão de médico válida. Redireciona automaticamente em falha.
 * @returns {Promise<object|null>} Perfil do médico ou null se redirecionou.
 */
export async function ensureDoctorProfile({
  requireApproved = true,
  requirePlan = true,
  redirectAdminTo = null,
  updateSidebar = true
} = {}) {
  const token = getDoctorToken();
  if (!token) {
    await redirectToLogin(t('selecao.swalLoginRequired'));
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      await redirectToLogin(t('selecao.swalLoadError'));
      return null;
    }

    const data = await response.json();

    if (redirectAdminTo && (data.role === 'admin' || data.isAdmin === true)) {
      window.location.href = redirectAdminTo;
      return null;
    }

    if (requireApproved && data.validationStatus && data.validationStatus !== 'approved') {
      window.location.href = 'perfilMedico.html';
      return null;
    }

    if (requirePlan && data.validationStatus === 'approved' && !data.hasChosenPlan) {
      window.location.href =
        data.paymentStatus === 'pending' ? 'checkoutPlano.html' : 'escolhaPlano.html';
      return null;
    }

    persistProfileSession(data);

    if (updateSidebar && typeof window.updateSidebarInfo === 'function') {
      window.updateSidebarInfo(data.nome, data.areaAtuacao, data.genero, data.crm);
    }

    return data;
  } catch {
    await redirectToLogin(t('selecao.swalLoadError'));
    return null;
  }
}
