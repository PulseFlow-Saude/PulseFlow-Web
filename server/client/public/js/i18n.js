/**
 * PulseFlow i18n - Tradução EN/PT para área do paciente.
 * Uso: await i18n.init(); depois initHeader/initSidebar; depois i18n.applyPageTranslations().
 */

const STORAGE_KEY = 'pulseflow_lang';
const DEFAULT_LANG = 'pt-BR';
const SUPPORTED = ['pt-BR', 'en'];

let translations = { 'pt-BR': {}, 'en': {} };
let currentLang = DEFAULT_LANG;
let initialized = false;

function getStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch (_) {}
  return null;
}

function getBrowserLang() {
  const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('pt')) return 'pt-BR';
  return DEFAULT_LANG;
}

// Já ao carregar o módulo, ler idioma do localStorage para o botão EN|PT funcionar em todas as telas
if (typeof localStorage !== 'undefined') {
  const stored = getStoredLang();
  if (stored) currentLang = stored;
  else currentLang = getBrowserLang();
}

/** Fallbacks quando i18n ainda não foi inicializado (ex.: páginas só do médico) */
const DEFAULT_PT = {
  header: { clinicalPanel: 'Painel Clínico', notifications: 'Notificações', appointments: 'Agendamentos', logout: 'Sair', logoutConfirmTitle: 'Sair da conta?', logoutConfirmText: 'Tem certeza que deseja fazer logout?', logoutConfirmYes: 'Sim, sair', logoutConfirmCancel: 'Cancelar' },
  sidebar: { perfilMedico: 'Perfil do Médico', agendamentos: 'Agendamentos', notificacoes: 'Notificações', buscarPacientes: 'Buscar Pacientes', configuracoes: 'Configurações', perfilPaciente: 'Perfil do Paciente', resumirConsulta: 'Resumir Consulta', historicoResumos: 'Histórico de Resumos', registroClinico: 'Registro Clínico', anexoExames: 'Anexo de Exames', eventosClinicos: 'Eventos Clínicos', relatoriosDashboards: 'Relatórios e Dashboards', diabetes: 'Relatório de Diabetes', pressaoArterial: 'Pressão Arterial', batimentosCardiacos: 'Batimentos Cardíacos', contagemPassos: 'Contagem de Passos', criseGastrite: 'Crise de Gastrite', cicloMenstrual: 'Ciclo Menstrual', saudeHormonal: 'Saúde Hormonal', insonia: 'Relatório de Insônia', enxaqueca: 'Relatório de Enxaqueca', trocarPaciente: 'Trocar de Paciente', suportePulseFlow: 'Suporte PulseFlow', sobrePlataforma: 'Sobre a Plataforma' }
};
function getNested(obj, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

export function getLanguage() {
  return getStoredLang() || currentLang;
}

/**
 * Retorna o texto traduzido. Chaves com ponto: 'header.logout'
 */
export function t(key, options = {}) {
  if (!key) return '';
  const fallback = options.fallback !== undefined ? options.fallback : key;
  const lang = options.lng || currentLang;
  let out;
  if (!initialized) {
    const def = getNested(DEFAULT_PT, key);
    out = (def !== undefined && def !== null) ? String(def) : fallback;
  } else {
    const dict = translations[lang] || translations[DEFAULT_LANG];
    const value = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), dict);
    if (value !== undefined && value !== null) {
      out = String(value);
    } else {
      const fallbackDict = lang !== DEFAULT_LANG ? translations[DEFAULT_LANG] : null;
      const fallbackVal = fallbackDict ? key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), fallbackDict) : undefined;
      out = fallbackVal !== undefined && fallbackVal !== null ? String(fallbackVal) : fallback;
    }
  }
  const { fallback: _f, lng: _l, ...interpolation } = options;
  if (Object.keys(interpolation).length > 0) {
    Object.entries(interpolation).forEach(([k, v]) => {
      out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    });
  }
  return out;
}

/**
 * Altera o idioma e recarrega a página para aplicar em todo o conteúdo.
 */
export function changeLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {}
  currentLang = lang;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  }
  window.location.reload();
}

/**
 * Inicializa i18n: define idioma e carrega os JSONs de tradução.
 * Deve ser await antes de initHeader/initSidebar.
 */
export async function init() {
  if (initialized) return;
  currentLang = getStoredLang() || getBrowserLang();
  if (!SUPPORTED.includes(currentLang)) currentLang = DEFAULT_LANG;

  const base = typeof window !== 'undefined' && window.location && window.location.origin
    ? `${window.location.origin}/client/public/locales`
    : '/client/public/locales';

  const load = async (lang) => {
    const url = `${base}/${lang}.json`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        translations[lang] = data;
        return data;
      }
    } catch (e) {
      console.warn('[i18n] Falha ao carregar', lang, e);
    }
    return {};
  };

  await Promise.all([load('pt-BR'), load('en')]);
  if (!translations[currentLang] || Object.keys(translations[currentLang]).length === 0) {
    currentLang = DEFAULT_LANG;
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt-BR';
  }
  initialized = true;
}

/**
 * Aplica traduções na página: elementos com data-i18n="key", data-i18n-placeholder="key", etc.
 */
export function applyPageTranslations() {
  if (!initialized) return;
  const attrMap = {
    'data-i18n': 'textContent',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-title': 'title',
    'data-i18n-aria-label': 'ariaLabel'
  };
  for (const [attr, prop] of Object.entries(attrMap)) {
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      const key = el.getAttribute(attr);
      if (!key) return;
      const value = t(key);
      if (prop === 'ariaLabel') {
        el.setAttribute('aria-label', value);
      } else {
        el[prop] = value;
      }
    });
  }
}

// Expose t and getLanguage globally for non-module scripts (e.g. agendamentos.js)
if (typeof window !== 'undefined') {
  window.pulseflowT = t;
  window.pulseflowGetLanguage = getLanguage;
}

export default { init, t, getLanguage, changeLanguage, applyPageTranslations };
