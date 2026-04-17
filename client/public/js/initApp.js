/**
 * Inicializa app com i18n, header e sidebar.
 * Use em todas as telas que têm header/sidebar para garantir tradução EN|PT.
 */
import { init, applyPageTranslations } from './i18n.js';
import { initHeaderComponent } from './components/header.js';
import { initSidebar } from './components/sidebar.js';

export async function initApp({ titleKey = '', title = '', activePage = '' } = {}) {
  await init();
  initSidebar(activePage);
  await initHeaderComponent({ titleKey: titleKey || undefined, title: title || undefined });
  applyPageTranslations();
}

export { applyPageTranslations } from './i18n.js';
