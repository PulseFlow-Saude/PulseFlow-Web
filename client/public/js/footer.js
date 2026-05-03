(function () {
  const footerHost = document.getElementById('footer-container');
  if (!footerHost) return;

  /** Mesma lógica que client/public/js/config.js (sem import, para script clássico) */
  function getApiUrl() {
    if (typeof window !== 'undefined' && window.API_URL) {
      return window.API_URL;
    }
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (hostname.includes('onrender.com')) {
      return `${protocol}//${hostname}`;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:65432';
    }
    return `${protocol}//${hostname}`;
  }

  const API_URL = getApiUrl();

  const fallbackT = (key, opts) => opts?.fallback ?? key;
  const t = () => typeof window.pulseflowT === 'function' ? window.pulseflowT : fallbackT;

  function renderFooter() {
    const translate = t();
    const currentYear = new Date().getFullYear();
    footerHost.innerHTML = `
    <footer class="main-footer">
      <div class="footer-container">
        <div class="footer-logo-section">
          <img src="/client/public/assets/9-removebg-preview.png" alt="Oryon Health" class="footer-logo">
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
            <li><a href="../views/sobreNos.html">${translate('homePage.footerAbout', { fallback: 'Sobre a Oryon Health' })}</a></li>
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
        <div class="footer-section footer-newsletter">
          <h4 class="footer-title">${translate('homePage.footerNewsletter', { fallback: 'Newsletter' })}</h4>
          <p>${translate('homePage.footerNewsletterHint', { fallback: 'Receba novidades sobre produto e saúde digital.' })}</p>
          <form class="footer-newsletter-form" id="footerNewsletterForm" action="#" method="post" novalidate>
            <input type="email" name="email" autocomplete="email" placeholder="${translate('homePage.footerNewsletterPlaceholder', { fallback: 'Seu e-mail' })}" aria-label="${translate('homePage.footerNewsletterPlaceholder', { fallback: 'Seu e-mail' })}">
            <button type="submit" aria-label="${translate('homePage.footerNewsletterSubmit', { fallback: 'Inscrever' })}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </form>
          <p class="footer-newsletter-feedback" id="footerNewsletterFeedback" role="status" aria-live="polite" hidden></p>
        </div>
      </div>
      <div class="footer-legal-bar">
        <p>© ${currentYear} Oryon Health. ${translate('homePage.footerRights', { fallback: 'Todos os direitos reservados.' })}</p>
        <div class="footer-legal-links">
          <a href="../views/privacidade.html">${translate('homePage.footerLegalPrivacy', { fallback: 'Privacidade' })}</a>
          <a href="../views/termos.html">${translate('homePage.footerLegalTerms', { fallback: 'Termos' })}</a>
          <a href="../views/privacidade.html#cookies">${translate('homePage.footerLegalCookies', { fallback: 'Cookies' })}</a>
        </div>
      </div>
    </footer>
  `;

    const form = document.getElementById('footerNewsletterForm');
    const feedback = document.getElementById('footerNewsletterFeedback');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const translate = t();
        const email = (form.querySelector('[name="email"]')?.value || '').trim();
        if (!email) {
          if (feedback) {
            feedback.textContent = translate('homePage.footerNewsletterErrEmpty', { fallback: 'Informe um e-mail.' });
            feedback.hidden = false;
          }
          return;
        }
        if (feedback) {
          feedback.textContent = translate('homePage.footerNewsletterSending', { fallback: 'Enviando…' });
          feedback.hidden = false;
        }
        try {
          const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'fail');
          }
          if (feedback) {
            feedback.textContent = data.already
              ? translate('homePage.footerNewsletterOkAlready', { fallback: 'Este e-mail já está inscrito.' })
              : translate('homePage.footerNewsletterOk', { fallback: 'Inscrição realizada! Obrigado.' });
            feedback.hidden = false;
          }
          form.reset();
        } catch {
          if (feedback) {
            feedback.textContent = translate('homePage.footerNewsletterErr', { fallback: 'Não foi possível concluir. Tente novamente.' });
            feedback.hidden = false;
          }
        }
      });
    }
  }

  let rendered = false;
  const doRender = () => {
    if (rendered) return;
    rendered = true;
    renderFooter();
  };

  document.addEventListener('pulseflow-i18n-ready', doRender);

  const fallback = () => { if (!rendered) doRender(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fallback, 500));
  } else {
    setTimeout(fallback, 500);
  }
})();
