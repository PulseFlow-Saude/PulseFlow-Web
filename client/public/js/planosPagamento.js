import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

async function loadProfile() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/client/views/login.html';
    return null;
  }
  const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    window.location.href = '/client/views/login.html';
    return null;
  }
  const perfil = await res.json();
  if (perfil.role === 'admin' || perfil.isAdmin) {
    window.location.href = '/client/views/admin-dashboard.html';
    return null;
  }
  if (perfil.validationStatus !== 'approved') {
    window.location.href = '/client/views/perfilMedico.html';
    return null;
  }
  if (!perfil.hasChosenPlan) {
    window.location.href = '/client/views/escolhaPlano.html';
    return null;
  }
  localStorage.setItem('validationStatus', perfil.validationStatus || '');
  localStorage.setItem('hasChosenPlan', perfil.hasChosenPlan ? 'true' : 'false');
  if (window.updateSidebarInfo) {
    window.updateSidebarInfo(perfil.nome, perfil.areaAtuacao, perfil.genero, perfil.crm);
  }
  return perfil;
}

async function loadPlanSettings() {
  try {
    const res = await fetch(`${API_URL}/api/platform/plan-settings`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatMoney(n, currency) {
  const ccy = currency || 'BRL';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: ccy }).format(n);
  } catch {
    return `${n} ${ccy}`;
  }
}

async function choosePaidPlan() {
  const token = localStorage.getItem('token');
  const btn = document.getElementById('btnChoosePaid');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/api/usuarios/perfil/choose-plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ option: 'paid' })
    });
    const data = await res.json();
    if (res.ok) {
      await Swal.fire({
        title: t('planosPagamento.successTitle'),
        text: data.message || t('planosPagamento.successPaid'),
        icon: 'success',
        confirmButtonColor: '#002A42'
      });
      // Plano só ativa após confirmar no checkout
      window.location.href = '/client/views/checkoutPlano.html';
    } else {
      Swal.fire({ title: t('perfilMedico.swalError'), text: data.message || t('planosPagamento.errorGeneric'), icon: 'error', confirmButtonColor: '#002A42' });
    }
  } catch {
    Swal.fire({ title: t('perfilMedico.swalError'), text: t('planosPagamento.errorGeneric'), icon: 'error', confirmButtonColor: '#002A42' });
  } finally {
    if (btn) btn.disabled = false;
  }
}

function render(perfil, cfg) {
  const banner = document.getElementById('planPayBanner');
  const cards = document.getElementById('planPayCards');
  if (!banner || !cards) return;

  const isPaid = perfil.planChoice === 'paid';
  const trialActive = perfil.trialActive === true;
  const trialExpired = perfil.trialExpired === true;
  const days = perfil.trialDaysRemaining;

  if (isPaid) {
    banner.className = 'plan-pay-banner plan-pay-banner--paid';
    banner.innerHTML = `
      <strong>${t('planosPagamento.bannerPaidTitle')}</strong>
      <p>${t('planosPagamento.bannerPaidText')}</p>
    `;
  } else if (trialExpired) {
    banner.className = 'plan-pay-banner plan-pay-banner--expired';
    banner.innerHTML = `
      <strong>${t('planosPagamento.bannerExpiredTitle')}</strong>
      <p>${t('planosPagamento.bannerExpiredText')}</p>
    `;
  } else if (trialActive && days != null) {
    banner.className = 'plan-pay-banner';
    banner.innerHTML = `
      <strong>${t('planosPagamento.bannerTrialTitle', { count: days })}</strong>
      <p>${t('planosPagamento.bannerTrialText')}</p>
    `;
  } else {
    banner.className = 'plan-pay-banner plan-pay-banner--paid';
    banner.innerHTML = `
      <strong>${t('planosPagamento.bannerGenericTitle')}</strong>
      <p>${t('planosPagamento.bannerGenericText')}</p>
    `;
  }

  const ccy = cfg?.currency || 'BRL';
  const monthly = Number(cfg?.paidMonthlyPrice) || 0;
  const yearly = Number(cfg?.paidYearlyPrice) || 0;
  const disc = Number(cfg?.yearlyDiscountPercent) || 0;
  const trialDays = Math.min(365, Math.max(1, Number(cfg?.trialDaysDefault) || 14));

  const priceBlockPaid =
    monthly > 0 || yearly > 0
      ? `${monthly > 0 ? `<div class="plan-pay-price">${formatMoney(monthly, ccy)}<small>${t('planosPagamento.perMonth')}</small></div>` : ''}${
          yearly > 0
            ? `<div class="plan-pay-price" style="margin-top:0.5rem">${formatMoney(yearly, ccy)}<small>${t('planosPagamento.perYear')}${
                disc > 0 ? ` · ${t('planosPagamento.yearlyDisc', { disc })}` : ''
              }</small></div>`
            : ''
        }`
      : `<p>${t('planosPagamento.priceOnRequest')}</p>`;

  const showPaidCta = !isPaid;
  const paidDisabled = isPaid ? 'disabled' : '';

  cards.innerHTML = `
    <div class="plan-pay-card">
      <h3><i class="fas fa-gift" style="color:#d97706;margin-right:0.35rem"></i> ${t('planosPagamento.cardTrialTitle')}</h3>
      <p>${t('planosPagamento.cardTrialDesc', { days: trialDays })}</p>
      <div class="plan-pay-actions">
        <button type="button" class="plan-pay-btn plan-pay-btn--secondary" disabled>${
          trialActive ? t('planosPagamento.trialRunning') : perfil.planChoice === 'trial' ? t('planosPagamento.trialEndedHint') : t('planosPagamento.trialInfoOnly')
        }</button>
      </div>
    </div>
    <div class="plan-pay-card plan-pay-card--highlight">
      <h3><i class="fas fa-crown" style="color:#0ea5e9;margin-right:0.35rem"></i> ${t('planosPagamento.cardPaidTitle')}</h3>
      ${priceBlockPaid}
      <p>${t('planosPagamento.cardPaidDesc')}</p>
      <div class="plan-pay-actions">
        <button type="button" class="plan-pay-btn" id="btnChoosePaid" ${paidDisabled} ${showPaidCta ? '' : 'disabled'}>
          ${isPaid ? t('planosPagamento.alreadyPaid') : t('planosPagamento.ctaPaid')}
        </button>
      </div>
    </div>
  `;

  if (showPaidCta) {
    document.getElementById('btnChoosePaid')?.addEventListener('click', choosePaidPlan);
  }

  applyPageTranslations();
}

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await loadProfile();
  if (!perfil) return;
  await initApp({ titleKey: 'planosPagamento.pageTitle', activePage: 'planospagamento' });
  const cfg = await loadPlanSettings();
  render(perfil, cfg);
});
