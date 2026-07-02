import { ensureDoctorProfile } from '../authGuard.js';
import { ensureActivePatient } from '../patientGuard.js';

/** Páginas públicas — sem autenticação. */
const PUBLIC_PAGES = new Set([
  'index.html',
  'homePage.html',
  'login.html',
  'register.html',
  'verify-2fa.html',
  'reset-password.html',
  'reset-password-form.html',
  'termos.html',
  'privacidade.html',
  'termos-us.html',
  'privacidade-us.html',
  'faq.html',
  'contato.html',
  'sobreNos.html',
  'seguranca.html'
]);

/** Médico logado, mas conta ainda em cadastro/plano. */
const ONBOARDING_PAGES = new Set([
  'perfilMedico.html',
  'escolhaPlano.html',
  'checkoutPlano.html',
  'planosPagamento.html'
]);

/** Painel administrativo. */
const ADMIN_PAGES = new Set([
  'painel-admin.html',
  'painel-usuarios.html',
  'admin-dashboard.html',
  'admin-contatos.html',
  'admin-newsletter.html',
  'admin-medico-detalhe.html',
  'admin-usuario-detalhe.html',
  'admin-financeiro.html',
  'admin-planos.html',
  'admin-audit.html'
]);

/** Área clínica — exige paciente selecionado. */
const PATIENT_PAGES = new Set([
  'diabetes.html',
  'enxaqueca.html',
  'pressaoArterial.html',
  'batimentosCardiacos.html',
  'contagemPassos.html',
  'insonia.html',
  'hormonal.html',
  'cicloMenstrual.html',
  'historicoCicloMenstrual.html',
  'historicoCriseGastrite.html',
  'visualizacaoCriseGastrite.html',
  'historicoEventoClinico.html',
  'vizualizacaoEventoClinico.html',
  'RegistroDoEventoClinico.html',
  'historicoProntuario.html',
  'vizualizacaoAnotacao.html',
  'criarAnotações.html',
  'anexoExame.html',
  'gravarConsulta.html',
  'historicoResumos.html',
  'perfilPaciente.html'
]);

export function getCurrentPage() {
  const segment = window.location.pathname.split('/').filter(Boolean).pop();
  return segment || 'index.html';
}

/**
 * Aplica guardiões conforme a página atual ou opções explícitas.
 * @returns {Promise<{ok: boolean, profile?: object, patient?: object}>}
 */
export async function runPageGuards(overrides = {}) {
  const page = overrides.page || getCurrentPage();

  if (overrides.public === true || PUBLIC_PAGES.has(page)) {
    return { ok: true };
  }

  if (ADMIN_PAGES.has(page)) {
    const profile = await ensureDoctorProfile({
      requireApproved: false,
      requirePlan: false,
      updateSidebar: false
    });
    if (!profile) return { ok: false };
    if (profile.role !== 'admin' && profile.isAdmin !== true) {
      window.location.href = 'dashboardMedico.html';
      return { ok: false };
    }
    return { ok: true, profile };
  }

  const isOnboarding = ONBOARDING_PAGES.has(page);
  const profile = await ensureDoctorProfile({
    requireApproved: !isOnboarding,
    requirePlan: !isOnboarding,
    redirectAdminTo: page === 'selecao.html' ? null : 'admin-dashboard.html'
  });
  if (!profile) return { ok: false };

  const needsPatient =
    overrides.requirePatient === true ||
    (overrides.requirePatient !== false && PATIENT_PAGES.has(page));

  if (needsPatient) {
    const patient = ensureActivePatient();
    if (!patient) return { ok: false };
    return { ok: true, profile, patient };
  }

  return { ok: true, profile };
}
