import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t, getLanguage } from './i18n.js';

async function applyPlanSettingsCopy() {
  try {
    const res = await fetch(`${API_URL}/api/platform/plan-settings`);
    if (!res.ok) return;
    const cfg = await res.json();
    const days = Math.min(365, Math.max(1, Number(cfg.trialDaysDefault) || 14));
    const trialEl = document.querySelector('[data-plan-trial-desc]');
    const paidEl = document.querySelector('[data-plan-paid-desc]');
    const isEn = getLanguage() === 'en';
    if (trialEl) {
      trialEl.textContent = isEn
        ? `${days} days of full access to the platform, with no commitment.`
        : `${days} dias de acesso completo à plataforma, sem compromisso.`;
    }
    if (paidEl) {
      const ccy = cfg.currency || 'BRL';
      const fmt = new Intl.NumberFormat(isEn ? 'en-US' : 'pt-BR', { style: 'currency', currency: ccy });
      const m = Number(cfg.paidMonthlyPrice) || 0;
      const y = Number(cfg.paidYearlyPrice) || 0;
      const disc = Number(cfg.yearlyDiscountPercent) || 0;
      let line = isEn
        ? 'Subscription with all features. Our team will get in touch.'
        : 'Assinatura com todos os recursos. Nossa equipe entrará em contato.';
      if (m > 0 || y > 0) {
        const parts = [];
        if (m > 0) parts.push(isEn ? `${fmt.format(m)}/month` : `${fmt.format(m)}/mês`);
        if (y > 0) parts.push(isEn ? `${fmt.format(y)}/year` : `${fmt.format(y)}/ano`);
        if (disc > 0) parts.push(isEn ? `${disc}% off yearly` : `${disc}% de desconto no anual`);
        line = isEn
          ? `Reference: ${parts.join(' · ')}. We will confirm pricing with you.`
          : `Referência: ${parts.join(' · ')}. Confirmaremos valores e condições com você.`;
      }
      paidEl.textContent = line;
    }
  } catch (_) {
    /* mantém texto i18n padrão */
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({ titleKey: 'escolhaPlano.title', activePage: 'escolhaplano' });

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }

  let perfil;
  try {
    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error();
    perfil = await res.json();
  } catch (e) {
    window.location.href = '/client/views/login.html';
    return;
  }

  if (perfil.validationStatus !== 'approved') {
    window.location.href = '/client/views/perfilMedico.html';
    return;
  }
  if (perfil.hasChosenPlan) {
    window.location.href = '/client/views/dashboardMedico.html';
    return;
  }

  await applyPlanSettingsCopy();

  async function choosePlan(option) {
    const btn = option === 'trial' ? document.getElementById('btnTrial') : document.getElementById('btnPaid');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${API_URL}/api/usuarios/perfil/choose-plan`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ option })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: t('escolhaPlano.successTitle', { fallback: 'Tudo certo!' }),
          text: data.message || (option === 'trial' ? t('escolhaPlano.trialSuccess', { fallback: 'Teste de 14 dias ativado.' }) : t('escolhaPlano.paidSuccess', { fallback: 'Em breve entraremos em contato.' })),
          icon: 'success',
          confirmButtonColor: '#002A42'
        }).then(() => {
          if (option === 'paid' && data.requiresCheckout) {
            window.location.href = '/client/views/checkoutPlano.html';
          } else {
            // Trial ativa diretamente o plano
            window.location.href = '/client/views/dashboardMedico.html';
          }
        });
      } else {
        Swal.fire({ title: t('perfilMedico.swalError'), text: data.message || 'Erro', icon: 'error', confirmButtonColor: '#002A42' });
        if (btn) btn.disabled = false;
      }
    } catch (err) {
      Swal.fire({ title: t('perfilMedico.swalError'), text: t('validacao.submitError', { fallback: 'Erro. Tente novamente.' }), icon: 'error', confirmButtonColor: '#002A42' });
      if (btn) btn.disabled = false;
    }
  }

  document.getElementById('btnTrial')?.addEventListener('click', () => choosePlan('trial'));
  document.getElementById('btnPaid')?.addEventListener('click', () => choosePlan('paid'));
});
