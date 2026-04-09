import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { getLanguage, t } from './i18n.js';

const getToken = () => localStorage.getItem('token');

const statusLabels = {
  pending_complement: 'Pendente',
  under_review: 'Em análise',
  denied: 'Negado',
  approved: 'Aprovado'
};

const statusLabelsEn = {
  pending_complement: 'Pending',
  under_review: 'Under review',
  denied: 'Denied',
  approved: 'Approved'
};

let chartInstances = [];
let lastDashData = null;

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function chartTextColor() {
  return isDarkTheme() ? '#cbd5e1' : '#475569';
}

function chartGridColor() {
  return isDarkTheme() ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.35)';
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  return new Date(y, m - 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

function formatMoney(n, currency) {
  const c = currency || 'BRL';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
}

function destroyCharts() {
  chartInstances.forEach((c) => {
    try {
      c.destroy();
    } catch (_) {}
  });
  chartInstances = [];
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

function renderLinks() {
  const el = document.getElementById('dashLinks');
  if (!el) return;
  const isEn = getLanguage() === 'en';
  el.innerHTML = `
    <a class="admin-dash-link" href="/client/views/painel-admin.html">
      <i class="fas fa-user-check" aria-hidden="true"></i>
      <span>${isEn ? 'Doctor validation' : 'Validação de médicos'} <span class="admin-dash-link__sub">${isEn ? 'Review registrations' : 'Filtrar, aprovar e negar'}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/painel-usuarios.html">
      <i class="fas fa-users" aria-hidden="true"></i>
      <span>${isEn ? 'Platform users' : 'Usuários da plataforma'} <span class="admin-dash-link__sub">${isEn ? 'Doctors, patients, admins' : 'Médicos, pacientes e admins'}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/admin-newsletter.html">
      <i class="fas fa-envelope-open-text" aria-hidden="true"></i>
      <span>${t('adminDashboard.shortcutNewsletter', { fallback: 'Newsletter' })} <span class="admin-dash-link__sub">${t('adminDashboard.shortcutNewsletterSub', { fallback: 'Inscritos do rodapé' })}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/admin-contatos.html">
      <i class="fas fa-inbox" aria-hidden="true"></i>
      <span>${t('adminDashboard.shortcutContact', { fallback: 'Mensagens de contato' })} <span class="admin-dash-link__sub">${t('adminDashboard.shortcutContactSub', { fallback: 'Formulário do site' })}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/admin-audit.html">
      <i class="fas fa-history" aria-hidden="true"></i>
      <span>${t('adminDashboard.shortcutAudit', { fallback: 'Auditoria' })} <span class="admin-dash-link__sub">${t('adminDashboard.shortcutAuditSub', { fallback: 'Registro de ações' })}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/admin-financeiro.html">
      <i class="fas fa-wallet" aria-hidden="true"></i>
      <span>${t('sidebar.adminFinance', { fallback: 'Financeiro' })} <span class="admin-dash-link__sub">${t('adminDashboard.financialRealCta', { fallback: 'Extrato completo' })}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/admin-planos.html">
      <i class="fas fa-sliders-h" aria-hidden="true"></i>
      <span>${isEn ? 'Plans & fees' : 'Planos e taxas'} <span class="admin-dash-link__sub">${isEn ? 'Pricing & trial' : 'Preços e trial'}</span></span>
    </a>
    <a class="admin-dash-link" href="/client/views/perfilMedico.html">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <span>${isEn ? 'Doctor profile' : 'Perfil do médico'} <span class="admin-dash-link__sub">${isEn ? 'Your account' : 'Sua conta'}</span></span>
    </a>
  `;
}

function renderFinancialSection(d) {
  const fin = d.financial || {};
  const ccy = fin.currency || 'BRL';
  const isEn = getLanguage() === 'en';
  const grossMrr = Number(fin.estimatedMrrGross ?? fin.estimatedMrr) || 0;
  const netMrr = Number(fin.estimatedMrrNetAfterFees) || 0;
  const grossArr = Number(fin.estimatedArrGross ?? fin.estimatedArrFromYearly) || 0;
  const netArr = Number(fin.estimatedArrNetAfterFees) || 0;
  const pm = Number(fin.paidMonthlyPrice) || 0;
  const py = Number(fin.paidYearlyPrice) || 0;
  const payers = fin.medicosPagantes ?? 0;
  const pFee = Number(fin.platformFeePercent) || 0;
  const gFee = Number(fin.gatewayFeePercent) || 0;

  const finWrap = document.getElementById('dashFinancial');
  const finGrid = document.getElementById('dashFinancialGrid');
  const feesEl = document.getElementById('dashFinancialFees');
  if (!finWrap || !finGrid) return;
  finWrap.hidden = false;

  finGrid.innerHTML = `
    <div class="admin-fin-card admin-fin-card--gross">
      <div class="admin-fin-card__icon"><i class="fas fa-coins" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'MRR gross (est.)' : 'MRR bruto (estimado)'}</div>
      <div class="admin-fin-card__value">${formatMoney(grossMrr, ccy)}</div>
      <div class="admin-fin-card__sub">${isEn ? 'Monthly × paying doctors' : 'Preço mensal × médicos pagantes'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--net">
      <div class="admin-fin-card__icon"><i class="fas fa-hand-holding-usd" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'MRR net after fees (est.)' : 'MRR líquido após taxas (est.)'}</div>
      <div class="admin-fin-card__value">${formatMoney(netMrr, ccy)}</div>
      <div class="admin-fin-card__sub">${isEn ? 'After platform + gateway %' : 'Após taxa plataforma e gateway'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--gross">
      <div class="admin-fin-card__icon"><i class="fas fa-calendar-alt" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'ARR gross (est.)' : 'ARR bruto anual (est.)'}</div>
      <div class="admin-fin-card__value">${formatMoney(grossArr, ccy)}</div>
      <div class="admin-fin-card__sub">${isEn ? 'Yearly price × payers' : 'Preço anual × pagantes'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--net">
      <div class="admin-fin-card__icon"><i class="fas fa-piggy-bank" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'ARR net after fees (est.)' : 'ARR líquido após taxas (est.)'}</div>
      <div class="admin-fin-card__value">${formatMoney(netArr, ccy)}</div>
      <div class="admin-fin-card__sub">${isEn ? 'Same fee model as MRR' : 'Mesmo modelo de taxas do MRR'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--price">
      <div class="admin-fin-card__icon"><i class="fas fa-tag" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'Reference prices' : 'Preços de referência'}</div>
      <div class="admin-fin-card__value">${formatMoney(pm, ccy)}</div>
      <div class="admin-fin-card__sub">${isEn ? 'Monthly' : 'Mensal'} · ${formatMoney(py, ccy)} ${isEn ? '(yearly)' : '(anual)'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--payers">
      <div class="admin-fin-card__icon"><i class="fas fa-user-md" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${isEn ? 'Paying doctors' : 'Médicos pagantes'}</div>
      <div class="admin-fin-card__value">${payers}</div>
      <div class="admin-fin-card__sub">${isEn ? 'planChoice = paid' : 'Plano pago registrado'}</div>
    </div>
  `;

  if (feesEl) {
    feesEl.hidden = false;
    feesEl.innerHTML = `
      <span><i class="fas fa-percentage" aria-hidden="true"></i> ${isEn ? 'Platform fee' : 'Taxa plataforma'}: <strong>${pFee}%</strong></span>
      <span><i class="fas fa-credit-card" aria-hidden="true"></i> ${isEn ? 'Gateway fee' : 'Taxa gateway'}: <strong>${gFee}%</strong></span>
    `;
  }
}

function renderFinancialRealSection(d) {
  const fr = d.financialReal;
  const wrap = document.getElementById('dashFinancialReal');
  const grid = document.getElementById('dashFinancialRealGrid');
  if (!wrap || !grid) return;
  if (!fr) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const ccy = fr.currency || 'BRL';
  const gross = Number(fr.totalGross) || 0;
  const net = Number(fr.totalNet) || 0;
  const count = Number(fr.transactionCount) || 0;

  grid.innerHTML = `
    <div class="admin-fin-card admin-fin-card--gross">
      <div class="admin-fin-card__icon"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${t('adminDashboard.financialRealGross', { fallback: 'Total bruto' })}</div>
      <div class="admin-fin-card__value">${formatMoney(gross, ccy)}</div>
      <div class="admin-fin-card__sub">${t('adminDashboard.financialRealTitle', { fallback: 'Checkout' })}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--net">
      <div class="admin-fin-card__icon"><i class="fas fa-coins" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${t('adminDashboard.financialRealNet', { fallback: 'Total líquido' })}</div>
      <div class="admin-fin-card__value">${formatMoney(net, ccy)}</div>
      <div class="admin-fin-card__sub">${getLanguage() === 'en' ? 'After platform + gateway fees' : 'Após taxas plataforma e gateway'}</div>
    </div>
    <div class="admin-fin-card admin-fin-card--payers">
      <div class="admin-fin-card__icon"><i class="fas fa-receipt" aria-hidden="true"></i></div>
      <div class="admin-fin-card__label">${t('adminDashboard.financialRealCount', { fallback: 'Transações' })}</div>
      <div class="admin-fin-card__value">${count}</div>
      <div class="admin-fin-card__sub">${getLanguage() === 'en' ? 'Completed checkouts' : 'Checkouts concluídos'}</div>
    </div>
  `;
}

function renderKpis(d) {
  const u = d.users || {};
  const a = d.agendamentos || {};
  const p = d.plans || {};
  const fin = d.financial || {};
  const ccy = fin.currency || 'BRL';
  const isEn = getLanguage() === 'en';

  const kpi = document.getElementById('dashKpis');
  if (!kpi) return;

  const grossMrr = Number(fin.estimatedMrrGross ?? fin.estimatedMrr) || 0;
  const netMrr = Number(fin.estimatedMrrNetAfterFees) || 0;
  const mrrStr = formatMoney(grossMrr, ccy);
  const mrrHintExtra =
    grossMrr !== netMrr && grossMrr > 0
      ? isEn
        ? ` · Net: ${formatMoney(netMrr, ccy)}`
        : ` · Líq.: ${formatMoney(netMrr, ccy)}`
      : '';

  kpi.innerHTML = `
    <div class="admin-kpi admin-kpi--users">
      <div class="admin-kpi__label">${isEn ? 'Total accounts' : 'Total de contas'}</div>
      <div class="admin-kpi__value">${u.total ?? '—'}</div>
      <div class="admin-kpi__hint">${isEn ? 'Doctors + patients + admins' : 'Médicos + pacientes + admins'}</div>
    </div>
    <div class="admin-kpi admin-kpi--revenue">
      <div class="admin-kpi__label">MRR ${isEn ? '(gross est.)' : '(bruto est.)'}</div>
      <div class="admin-kpi__value">${mrrStr}</div>
      <div class="admin-kpi__hint">${isEn ? 'Ref. price × payers' : 'Preço ref. × pagantes'}${mrrHintExtra}</div>
    </div>
    <div class="admin-kpi admin-kpi--appointments">
      <div class="admin-kpi__label">${isEn ? 'Appointments' : 'Agendamentos'}</div>
      <div class="admin-kpi__value">${a.total ?? '—'}</div>
      <div class="admin-kpi__hint">${isEn ? 'From today (UTC): ' : 'Data ≥ hoje (UTC): '}${a.fromTodayOnward ?? '—'}</div>
    </div>
    <div class="admin-kpi admin-kpi--alerts">
      <div class="admin-kpi__label">${isEn ? 'Trials expiring (7d)' : 'Trials a expirar (7 dias)'}</div>
      <div class="admin-kpi__value">${p.trialsExpiringWithin7Days ?? '—'}</div>
      <div class="admin-kpi__hint">${isEn ? 'Follow up' : 'Acompanhar conversão'}</div>
    </div>
  `;

  renderFinancialSection(d);
  renderFinancialRealSection(d);
}

function buildCharts(d) {
  const Chart = window.Chart;
  if (!Chart) return;

  Chart.defaults.font.family = "'Montserrat', system-ui, sans-serif";
  Chart.defaults.color = chartTextColor();

  const an = d.analytics || {};
  const months = Array.isArray(an.months) ? an.months : [];
  const labels = months.map(formatMonthLabel);
  const v = d.validation || {};
  const by = v.byStatus || {};
  const st = getLanguage() === 'en' ? statusLabelsEn : statusLabels;
  const isEn = getLanguage() === 'en';

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: chartTextColor() }
      }
    },
    scales: {}
  };

  const elS = document.getElementById('chartSignups');
  if (elS) {
    const c1 = new Chart(elS, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: isEn ? 'New doctors' : 'Novos médicos',
            data: an.medicosSignupsByMonth || [],
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2
          },
          {
            label: isEn ? 'New patients' : 'Novos pacientes',
            data: an.pacientesSignupsByMonth || [],
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2
          }
        ]
      },
      options: {
        ...commonOpts,
        scales: {
          x: {
            grid: { color: chartGridColor() },
            ticks: { color: chartTextColor(), maxRotation: 45 }
          },
          y: {
            beginAtZero: true,
            grid: { color: chartGridColor() },
            ticks: { color: chartTextColor() }
          }
        }
      }
    });
    chartInstances.push(c1);
  }

  const elV = document.getElementById('chartValidation');
  if (elV) {
    const c2 = new Chart(elV, {
      type: 'doughnut',
      data: {
        labels: ['pending_complement', 'under_review', 'denied', 'approved'].map((k) => st[k] || k),
        datasets: [
          {
            data: [
              by.pending_complement ?? 0,
              by.under_review ?? 0,
              by.denied ?? 0,
              by.approved ?? 0
            ],
            backgroundColor: ['#94a3b8', '#f59e0b', '#ef4444', '#22c55e'],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: chartTextColor(), boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
    chartInstances.push(c2);
  }

  const elA = document.getElementById('chartAppointments');
  if (elA) {
    const c3 = new Chart(elA, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: isEn ? 'Appointments' : 'Agendamentos',
            data: an.agendamentosByMonth || [],
            backgroundColor: 'rgba(124, 58, 237, 0.65)',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        ...commonOpts,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTextColor(), maxRotation: 45 }
          },
          y: {
            beginAtZero: true,
            grid: { color: chartGridColor() },
            ticks: { color: chartTextColor() }
          }
        }
      }
    });
    chartInstances.push(c3);
  }

  const elP = document.getElementById('chartPlans');
  if (elP) {
    const pd = an.planDistribution || {};
    const c4 = new Chart(elP, {
      type: 'doughnut',
      data: {
        labels: [
          isEn ? 'Trial' : 'Em trial',
          isEn ? 'Paid' : 'Plano pago',
          isEn ? 'Other / no plan' : 'Outros / sem plano'
        ],
        datasets: [
          {
            data: [pd.trial ?? 0, pd.paid ?? 0, pd.other ?? 0],
            backgroundColor: ['#0ea5e9', '#22c55e', '#cbd5e1'],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: chartTextColor(), boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
    chartInstances.push(c4);
  }
}

async function loadDashboard() {
  const errEl = document.getElementById('dashError');
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/dashboard-stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent =
        getLanguage() === 'en' ? 'Could not load dashboard.' : 'Não foi possível carregar o dashboard.';
    }
    return;
  }
  if (errEl) errEl.hidden = true;
  const d = await res.json();
  lastDashData = d;

  destroyCharts();
  renderKpis(d);
  buildCharts(d);
  renderLinks();
  applyPageTranslations();
}

function rebuildChartsForTheme() {
  if (!lastDashData || !window.Chart) return;
  destroyCharts();
  buildCharts(lastDashData);
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await ensureAdmin();
  if (!ok) return;
  await initApp({ titleKey: 'adminDashboard.title', activePage: 'adminDashboard' });
  await loadDashboard();

  new MutationObserver(() => rebuildChartsForTheme()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});
