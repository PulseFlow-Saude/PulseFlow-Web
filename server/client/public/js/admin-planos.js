import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');

let syncTimer = null;

function normalizeCurrencyCode(raw) {
  const c = String(raw ?? 'BRL')
    .trim()
    .toUpperCase();
  return c === 'USD' ? 'USD' : 'BRL';
}

function formatMoney(n, currency) {
  const c = normalizeCurrencyCode(currency);
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${c}`;
  }
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncAll();
  }, 120);
}

function syncAll() {
  updateShowcase();
  updateFeesPipeline();
  updateCalculator();
}

async function ensureAdmin() {
  const token = getToken();
  if (!token) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  const perfil = await res.json();
  const isAdmin = perfil.role === 'admin' || perfil.isAdmin === true;
  if (!isAdmin) {
    window.location.href = '/client/views/login.html';
    return false;
  }
  localStorage.setItem('isAdmin', 'true');
  return true;
}

function updateShowcase() {
  const trialDays = document.getElementById('trialDaysDefault')?.value ?? '14';
  const pm = Number(document.getElementById('paidMonthlyPrice')?.value) || 0;
  const py = Number(document.getElementById('paidYearlyPrice')?.value) || 0;
  const disc = Number(document.getElementById('yearlyDiscountPercent')?.value) || 0;
  const ccy = normalizeCurrencyCode(document.getElementById('currency')?.value);

  const elDays = document.getElementById('showTrialDays');
  if (elDays) elDays.textContent = trialDays;

  const showM = document.getElementById('showMonthlyPrice');
  const showY = document.getElementById('showYearlyPrice');
  if (showM) showM.textContent = formatMoney(pm, ccy);
  if (showY) showY.textContent = formatMoney(py, ccy);

  const discEl = document.getElementById('showYearlyDiscount');
  if (discEl) {
    if (disc > 0) {
      discEl.hidden = false;
      discEl.textContent = t('adminPlans.yearlyDiscountLine', { disc: String(disc) });
    } else {
      discEl.hidden = true;
    }
  }
}

function updateFeesPipeline() {
  const pf = Number(document.getElementById('platformFeePercent')?.value) || 0;
  const gf = Number(document.getElementById('paymentGatewayFeePercent')?.value) || 0;

  const gross = 100;
  const afterPlat = gross * (1 - pf / 100);
  const net = afterPlat * (1 - gf / 100);
  const pPlat = ((gross - afterPlat) / gross) * 100;
  const pGate = ((afterPlat - net) / gross) * 100;
  const pNet = (net / gross) * 100;

  const el = document.getElementById('feesPipeline');
  if (!el) return;

  const minFlex = 0.001;
  const fPlat = Math.max(pPlat, pPlat > 0 ? minFlex : 0);
  const fGate = Math.max(pGate, pGate > 0 ? minFlex : 0);
  const fNet = Math.max(pNet, pNet > 0 ? minFlex : 0);

  const tPlat = t('adminPlans.feesBarPlatform');
  const tGate = t('adminPlans.feesBarGateway');
  const tNet = t('adminPlans.feesBarNet');

  el.innerHTML = `
    <div class="fees-bar" role="img" aria-label="${t('adminPlans.sectionFees')}">
      ${pPlat > 0.01 ? `<div class="fees-bar__seg fees-bar__seg--plat" style="flex:${fPlat} 1 0" title="${tPlat}">${pPlat.toFixed(1)}%</div>` : ''}
      ${pGate > 0.01 ? `<div class="fees-bar__seg fees-bar__seg--gate" style="flex:${fGate} 1 0" title="${tGate}">${pGate.toFixed(1)}%</div>` : ''}
      ${pNet > 0.01 ? `<div class="fees-bar__seg fees-bar__seg--net" style="flex:${fNet} 1 0" title="${tNet}">${pNet.toFixed(1)}%</div>` : ''}
    </div>
    <div class="fees-flow-labels">
      <span><strong>100%</strong> ${t('adminPlans.feesFlowGross')}</span>
      <span>→ ${t('adminPlans.feesFlowAfterPlat')}: <strong>${afterPlat.toFixed(2)}</strong></span>
      <span>→ ${t('adminPlans.feesFlowAfterGate')}: <strong>${net.toFixed(2)}</strong></span>
    </div>
  `;

  const lg = document.getElementById('feesLegendPlatform');
  const gg = document.getElementById('feesLegendGateway');
  if (lg) lg.textContent = t('adminPlans.feesLegendPlatformPct', { pct: String(pf) });
  if (gg) gg.textContent = t('adminPlans.feesLegendGatewayPct', { pct: String(gf) });
}

function updateCalculator() {
  const payers = Number(document.getElementById('calcPayers')?.value) || 0;
  const pm = Number(document.getElementById('paidMonthlyPrice')?.value) || 0;
  const py = Number(document.getElementById('paidYearlyPrice')?.value) || 0;
  const pf = Number(document.getElementById('platformFeePercent')?.value) || 0;
  const gf = Number(document.getElementById('paymentGatewayFeePercent')?.value) || 0;
  const ccy = normalizeCurrencyCode(document.getElementById('currency')?.value);

  const factor = (1 - pf / 100) * (1 - gf / 100);
  const grossMrr = pm * payers;
  const afterPlat = grossMrr * (1 - pf / 100);
  const netMrr = grossMrr * factor;
  const grossArr = py * payers;
  const afterPlatArr = grossArr * (1 - pf / 100);
  const netArr = grossArr * factor;

  const out = document.getElementById('calcResults');
  if (!out) return;

  out.innerHTML = `
    <div class="calc-result-card">
      <div class="calc-result-card__label">${t('adminPlans.calcGross')}</div>
      <div class="calc-result-card__value">${formatMoney(grossMrr, ccy)}</div>
    </div>
    <div class="calc-result-card">
      <div class="calc-result-card__label">${t('adminPlans.calcAfterPlatform')}</div>
      <div class="calc-result-card__value">${formatMoney(afterPlat, ccy)}</div>
    </div>
    <div class="calc-result-card calc-result-card--net">
      <div class="calc-result-card__label">${t('adminPlans.calcNet')}</div>
      <div class="calc-result-card__value">${formatMoney(netMrr, ccy)}</div>
    </div>
    <div class="calc-result-card">
      <div class="calc-result-card__label">${t('adminPlans.calcAnnualGross')}</div>
      <div class="calc-result-card__value">${formatMoney(grossArr, ccy)}</div>
    </div>
    <div class="calc-result-card">
      <div class="calc-result-card__label">${t('adminPlans.calcAfterPlatformAnnual')}</div>
      <div class="calc-result-card__value">${formatMoney(afterPlatArr, ccy)}</div>
    </div>
    <div class="calc-result-card calc-result-card--net">
      <div class="calc-result-card__label">${t('adminPlans.calcAnnualNet')}</div>
      <div class="calc-result-card__value">${formatMoney(netArr, ccy)}</div>
    </div>
  `;
}

function fillForm(s) {
  const form = document.getElementById('planSettingsForm');
  if (!form || !s) return;
  document.getElementById('trialDaysDefault').value = s.trialDaysDefault ?? 14;
  const cur = document.getElementById('currency');
  if (cur) cur.value = normalizeCurrencyCode(s.currency);
  document.getElementById('paidMonthlyPrice').value = s.paidMonthlyPrice ?? 0;
  document.getElementById('paidYearlyPrice').value = s.paidYearlyPrice ?? 0;
  document.getElementById('yearlyDiscountPercent').value = s.yearlyDiscountPercent ?? 0;
  document.getElementById('platformFeePercent').value = s.platformFeePercent ?? 0;
  document.getElementById('paymentGatewayFeePercent').value = s.paymentGatewayFeePercent ?? 0;
  document.getElementById('notes').value = s.notes ?? '';
  const meta = document.getElementById('planSettingsMeta');
  if (meta && s.updatedAt) {
    const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
    const ds = new Date(s.updatedAt).toLocaleString(locale);
    meta.textContent = t('adminPlans.metaLastSaved', { date: ds });
  }
  syncAll();
}

function collectPayload() {
  return {
    trialDaysDefault: Number(document.getElementById('trialDaysDefault').value),
    currency: normalizeCurrencyCode(document.getElementById('currency').value),
    paidMonthlyPrice: Number(document.getElementById('paidMonthlyPrice').value),
    paidYearlyPrice: Number(document.getElementById('paidYearlyPrice').value),
    yearlyDiscountPercent: Number(document.getElementById('yearlyDiscountPercent').value),
    platformFeePercent: Number(document.getElementById('platformFeePercent').value),
    paymentGatewayFeePercent: Number(document.getElementById('paymentGatewayFeePercent').value),
    notes: document.getElementById('notes').value
  };
}

async function loadSettings() {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/platform-settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    await Swal.fire({
      title: 'PulseFlow',
      text: t('adminPlans.swalLoadError'),
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
    return;
  }
  const s = await res.json();
  fillForm(s);
  applyPageTranslations();
}

async function saveSettings(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSavePlans');
  if (btn) btn.disabled = true;
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/admin/platform-settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(collectPayload())
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.settings) fillForm(data.settings);
      else syncAll();
      await Swal.fire({
        title: 'PulseFlow',
        text: data.message || t('adminPlans.swalSaveOk'),
        icon: 'success',
        confirmButtonColor: '#002A42'
      });
      applyPageTranslations();
    } else {
      await Swal.fire({
        title: 'PulseFlow',
        text: data.message || t('adminPlans.swalSaveError'),
        icon: 'error',
        confirmButtonColor: '#002A42'
      });
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindFormSync() {
  const form = document.getElementById('planSettingsForm');
  if (!form) return;
  form.addEventListener('input', scheduleSync);
  form.addEventListener('change', scheduleSync);

  document.getElementById('calcPayers')?.addEventListener('input', scheduleSync);
  document.getElementById('btnCalcSync')?.addEventListener('click', () => {
    syncAll();
    document.getElementById('calcResults')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await ensureAdmin();
  if (!ok) return;
  await initApp({ titleKey: 'adminPlans.title', activePage: 'adminPlans' });
  document.getElementById('planSettingsForm')?.addEventListener('submit', saveSettings);
  bindFormSync();
  await loadSettings();
});
