(function () {
  const footerHost = document.getElementById('footer-container');
  if (!footerHost) return;

  const fallbackT = (key, opts) => opts?.fallback ?? key;
  const t = () => typeof window.pulseflowT === 'function' ? window.pulseflowT : fallbackT;

  function renderFooter() {
    const translate = t();
    const currentYear = new Date().getFullYear();
    footerHost.innerHTML = `
    <footer class="main-footer">
      <div class="footer-container">
        <div class="footer-logo-section">
          <img src="/client/public/assets/PulseNegativo.png" alt="PulseFlow" class="footer-logo">
          <p class="footer-tagline">${translate('homePage.footerTagline', { fallback: 'Tecnologia e cuidado unidos para entregar um ecossistema completo de saúde digital.' })}</p>
          <div class="social-icons">
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer noopener" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.895 3 3 3.895 3 5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V5C21 3.895 20.105 3 19 3Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 17V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M8 8V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M12 17V13.5C12 12.672 12.672 12 13.5 12C14.328 12 15 12.672 15 13.5V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </a>
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer noopener" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="17" cy="7" r="1" fill="currentColor"/>
              </svg>
            </a>
            <a href="mailto:contato@pulseflow.com" aria-label="E-mail">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3 7L12 13L21 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </a>
          </div>
        </div>
        <div class="footer-section">
          <h4 class="footer-title">${translate('homePage.footerInstitutional', { fallback: 'Institucional' })}</h4>
          <ul class="footer-links">
            <li><a href="../views/sobreNos.html">${translate('homePage.footerAbout', { fallback: 'Sobre a PulseFlow' })}</a></li>
            <li><a href="../views/contato.html">${translate('homePage.footerContact', { fallback: 'Contato' })}</a></li>
            <li><a href="../views/faq.html">${translate('homePage.footerFaq', { fallback: 'Perguntas Frequentes' })}</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4 class="footer-title">${translate('homePage.footerSupport', { fallback: 'Suporte' })}</h4>
          <ul class="footer-links">
            <li><a href="../views/privacidade.html">${translate('homePage.footerPrivacy', { fallback: 'Política de Privacidade' })}</a></li>
            <li><a href="../views/termos.html">${translate('homePage.footerTerms', { fallback: 'Termos de Uso' })}</a></li>
            <li><a href="../views/seguranca.html">${translate('homePage.footerSecurity', { fallback: 'Segurança e Compliance' })}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-bottom-content">
          <p>© ${currentYear} PulseFlow. ${translate('homePage.footerRights', { fallback: 'Todos os direitos reservados.' })}</p>
        </div>
      </div>
    </footer>
  `;
  }

  let rendered = false;
  const doRender = () => {
    if (rendered) return;
    rendered = true;
    renderFooter();
  };

  // Na home: i18n pronto (evento disparado pelo módulo após init)
  document.addEventListener('pulseflow-i18n-ready', doRender);

  // Fallback: páginas sem i18n (evento nunca dispara)
  const fallback = () => { if (!rendered) doRender(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fallback, 500));
  } else {
    setTimeout(fallback, 500);
  }
})();

