import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t } from './i18n.js';

const getToken = () => localStorage.getItem('token');

let selectedMethod = null; // 'card' | 'pix'
let currentStep = 'method'; // 'method' | 'details' | 'review'

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

/** Algoritmo de Luhn — dígitos da direita para a esquerda, dobra um sim / um não */
function luhnValid(digits) {
  const d = onlyDigits(digits);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

function parseExp(exp) {
  const m = String(exp || '').replace(/\D/g, '');
  if (m.length !== 4) return null;
  const mm = parseInt(m.slice(0, 2), 10);
  const yy = parseInt(m.slice(2, 4), 10);
  if (mm < 1 || mm > 12) return null;
  return { month: mm, year: 2000 + yy };
}

function isExpNotExpired(exp) {
  const p = parseExp(exp);
  if (!p) return false;
  const now = new Date();
  const expDate = new Date(p.year, p.month, 0, 23, 59, 59);
  return expDate >= new Date(now.getFullYear(), now.getMonth(), 1);
}

function maskCardNumber(v) {
  const d = onlyDigits(v);
  const last4 = d.slice(-4);
  return last4 ? `•••• •••• •••• ${last4}` : '••••';
}

function formatCardInput(value) {
  const d = onlyDigits(value).slice(0, 19);
  const parts = [];
  for (let i = 0; i < d.length; i += 4) {
    parts.push(d.slice(i, i + 4));
  }
  return parts.join(' ');
}

function formatExpInput(value) {
  const d = onlyDigits(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function isValidCpf(cpf) {
  const s = onlyDigits(cpf);
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(s[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(s[10], 10);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

function isValidPhoneBr(v) {
  const d = onlyDigits(v);
  return d.length >= 10 && d.length <= 11;
}

function validatePixKey(type, key) {
  const k = String(key || '').trim();
  if (!k) return t('checkout.errPixKey');
  switch (type) {
    case 'cpf':
      return isValidCpf(k) ? null : t('checkout.errPixCpf');
    case 'email':
      return isValidEmail(k) ? null : t('checkout.errPixEmail');
    case 'phone':
      return isValidPhoneBr(k) ? null : t('checkout.errPixPhone');
    case 'random':
      return k.length >= 32 ? null : t('checkout.errPixRandom');
    default:
      return t('checkout.errPixKey');
  }
}

function getCardModality() {
  const c = document.getElementById('modCredit');
  const d = document.getElementById('modDebit');
  if (c?.checked) return 'credit';
  if (d?.checked) return 'debit';
  return null;
}

function setFieldError(el, invalid) {
  if (!el) return;
  el.classList.toggle('input-error', !!invalid);
}

function clearFieldErrors() {
  document.querySelectorAll('.checkout-input.input-error').forEach((el) => el.classList.remove('input-error'));
}

function showInlineError(msg) {
  const el = document.getElementById('fieldError');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function updateWizardUI() {
  const order = ['method', 'details', 'review'];
  const idx = order.indexOf(currentStep);
  document.querySelectorAll('.checkout-wizard__item').forEach((item) => {
    const s = item.dataset.wizardStep;
    const i = order.indexOf(s);
    item.classList.toggle('is-active', s === currentStep);
    item.classList.toggle('is-done', i < idx);
    item.removeAttribute('aria-current');
    if (s === currentStep) item.setAttribute('aria-current', 'step');
  });
}

function showStep(step) {
  currentStep = step;
  const methodEl = document.getElementById('stepMethod');
  const detailsEl = document.getElementById('stepDetails');
  const reviewEl = document.getElementById('stepReview');
  if (methodEl) methodEl.hidden = step !== 'method';
  if (detailsEl) detailsEl.hidden = step !== 'details';
  if (reviewEl) reviewEl.hidden = step !== 'review';

  if (step === 'details') {
    const blockPix = document.getElementById('blockPix');
    const blockCard = document.getElementById('blockCard');
    const title = document.getElementById('detailsTitle');
    if (selectedMethod === 'pix') {
      if (blockPix) blockPix.hidden = false;
      if (blockCard) blockCard.hidden = true;
      if (title) title.textContent = t('checkout.detailsTitlePix');
    } else {
      if (blockPix) blockPix.hidden = true;
      if (blockCard) blockCard.hidden = false;
      if (title) title.textContent = t('checkout.detailsTitleCard');
    }
  }
  updateWizardUI();
  showInlineError('');
  clearFieldErrors();
}

async function loadProfile() {
  const token = getToken();
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
  if (perfil.validationStatus !== 'approved') {
    window.location.href = '/client/views/perfilMedico.html';
    return null;
  }

  if (perfil.paymentStatus !== 'pending') {
    window.location.href = perfil.hasChosenPlan ? '/client/views/dashboardMedico.html' : '/client/views/escolhaPlano.html';
    return null;
  }

  return perfil;
}

function validateDetailsForReview() {
  showInlineError('');
  clearFieldErrors();

  if (selectedMethod === 'pix') {
    const key = document.getElementById('pixKey');
    const type = document.getElementById('pixType')?.value || 'cpf';
    const err = validatePixKey(type, key?.value);
    setFieldError(key, !!err);
    return err;
  }

  const mod = getCardModality();
  if (!mod) {
    return t('checkout.errModality');
  }

  const name = document.getElementById('cardName');
  const num = document.getElementById('cardNumber');
  const exp = document.getElementById('cardExp');
  const cvv = document.getElementById('cardCvv');

  const nome = String(name?.value || '').trim();
  if (nome.length < 3) {
    setFieldError(name, true);
    return t('checkout.errCardName');
  }

  const digits = onlyDigits(num?.value);
  if (!luhnValid(digits)) {
    setFieldError(num, true);
    return t('checkout.errCardNumber');
  }

  if (!parseExp(exp?.value)) {
    setFieldError(exp, true);
    return t('checkout.errCardExpFormat');
  }
  if (!isExpNotExpired(exp?.value)) {
    setFieldError(exp, true);
    return t('checkout.errCardExpPast');
  }

  const cvvLen = onlyDigits(cvv?.value).length;
  if (cvvLen < 3 || cvvLen > 4) {
    setFieldError(cvv, true);
    return t('checkout.errCvv');
  }

  return null;
}

function buildReviewHtml() {
  if (selectedMethod === 'pix') {
    const type = document.getElementById('pixType')?.value || 'cpf';
    const key = document.getElementById('pixKey')?.value || '';
    const typeLabel = { cpf: 'CPF', email: 'E-mail', phone: t('checkout.phone'), random: t('checkout.randomKey') }[type] || type;
    return `
      <div><strong>${t('checkout.revMethod')}:</strong> ${t('checkout.methodPix')}</div>
      <div><strong>${t('checkout.revPixType')}:</strong> ${typeLabel}</div>
      <div><strong>${t('checkout.revPixKey')}:</strong> ${String(key).trim()}</div>
    `;
  }

  const mod = getCardModality();
  const modLabel = mod === 'credit' ? t('checkout.credit') : t('checkout.debit');
  const nome = document.getElementById('cardName')?.value || '';
  const num = document.getElementById('cardNumber')?.value || '';
  const exp = document.getElementById('cardExp')?.value || '';
  return `
    <div><strong>${t('checkout.revMethod')}:</strong> ${t('checkout.methodCard')}</div>
    <div><strong>${t('checkout.revModality')}:</strong> ${modLabel}</div>
    <div><strong>${t('checkout.revName')}:</strong> ${nome}</div>
    <div><strong>${t('checkout.revNumber')}:</strong> ${maskCardNumber(num)}</div>
    <div><strong>${t('checkout.revExp')}:</strong> ${formatExpInput(exp)}</div>
  `;
}

async function confirmPayment() {
  const token = getToken();
  if (!token) return;

  const payload = { method: selectedMethod };
  if (selectedMethod === 'card') {
    payload.card = {
      modality: getCardModality(),
      name: document.getElementById('cardName')?.value || '',
      number: onlyDigits(document.getElementById('cardNumber')?.value),
      exp: document.getElementById('cardExp')?.value || '',
      cvv: onlyDigits(document.getElementById('cardCvv')?.value)
    };
  } else {
    payload.pix = {
      type: document.getElementById('pixType')?.value || 'cpf',
      key: String(document.getElementById('pixKey')?.value || '').trim()
    };
  }

  const btn = document.getElementById('btnConfirmPayment');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/api/usuarios/pagamento/confirmar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || t('checkout.errConfirm'));

    localStorage.setItem('hasChosenPlan', 'true');
    localStorage.setItem('paymentStatus', 'paid');
    window.location.href = '/client/views/dashboardMedico.html';
  } catch (e) {
    Swal.fire({
      title: t('checkout.swalErrorTitle'),
      text: e?.message || t('checkout.errConfirm'),
      icon: 'error',
      confirmButtonColor: '#002A42'
    });
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindMethodButtons() {
  const pickCard = document.getElementById('pickCard');
  const pickPix = document.getElementById('pickPix');
  const next = document.getElementById('btnMethodNext');

  const select = (method) => {
    selectedMethod = method;
    [pickCard, pickPix].forEach((b) => {
      if (!b) return;
      const on = b.dataset.method === method;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    if (next) next.disabled = !method;
  };

  pickCard?.addEventListener('click', () => select('card'));
  pickPix?.addEventListener('click', () => select('pix'));

  document.getElementById('btnMethodNext')?.addEventListener('click', () => {
    if (!selectedMethod) {
      Swal.fire({ title: t('checkout.swalWarnTitle'), text: t('checkout.errPickMethod'), icon: 'warning', confirmButtonColor: '#002A42' });
      return;
    }
    showStep('details');
  });
}

function bindDetails() {
  document.getElementById('btnDetailsBack')?.addEventListener('click', () => {
    showStep('method');
  });

  document.getElementById('cardNumber')?.addEventListener('input', (e) => {
    e.target.value = formatCardInput(e.target.value);
  });

  document.getElementById('cardExp')?.addEventListener('input', (e) => {
    e.target.value = formatExpInput(e.target.value);
  });

  document.getElementById('cardCvv')?.addEventListener('input', (e) => {
    e.target.value = onlyDigits(e.target.value).slice(0, 4);
  });

  document.getElementById('btnDetailsReview')?.addEventListener('click', () => {
    const err = validateDetailsForReview();
    if (err) {
      showInlineError(err);
      return;
    }
    const el = document.getElementById('reviewSummary');
    if (el) el.innerHTML = buildReviewHtml();
    showStep('review');
  });
}

function bindReview() {
  document.getElementById('btnReviewBack')?.addEventListener('click', () => {
    showStep('details');
  });
  document.getElementById('btnConfirmPayment')?.addEventListener('click', confirmPayment);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({ titleKey: 'checkout.pageTitle', activePage: 'checkoutplano' });
  applyPageTranslations();
  const pixKeyEl = document.getElementById('pixKey');
  if (pixKeyEl) pixKeyEl.placeholder = t('checkout.pixKeyPlaceholder');

  const perfil = await loadProfile();
  if (!perfil) return;

  bindMethodButtons();
  bindDetails();
  bindReview();

  selectedMethod = null;
  showStep('method');
});
