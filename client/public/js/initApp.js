/**
 * Inicializa app com i18n, header e sidebar.
 * Aplica guardiões de autenticação e paciente conforme a página atual.
 */
import { init, applyPageTranslations } from './i18n.js';
import { initHeaderComponent } from './components/header.js';
import { initSidebar } from './components/sidebar.js';
import { runPageGuards } from './utils/pageGuards.js';

export async function initApp({
  titleKey = '',
  title = '',
  activePage = '',
  public: isPublic = false,
  requirePatient = undefined
} = {}) {
  const guard = await runPageGuards({ public: isPublic, requirePatient });
  if (!guard.ok) {
    return guard;
  }

  await init();
  initSidebar(activePage);
  await initHeaderComponent({ titleKey: titleKey || undefined, title: title || undefined });
  applyPageTranslations();
  return guard;
}

export { applyPageTranslations } from './i18n.js';
