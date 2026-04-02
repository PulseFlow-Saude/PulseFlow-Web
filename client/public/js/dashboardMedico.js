import { API_URL } from './config.js';
import { initApp, applyPageTranslations } from './initApp.js';
import { t, getLanguage } from './i18n.js';

const getToken = () => localStorage.getItem('token');

let chartMes = null;
let lastStats = null;

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function chartTextColor() {
  return isDarkTheme() ? '#cbd5e1' : '#475569';
}

function chartGridColor() {
  return isDarkTheme() ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.35)';
}

function destroyCharts() {
  try {
    chartMes?.destroy();
  } catch (_) {}
  chartMes = null;
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  return new Date(y, m - 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

function getAgDateTime(ag) {
  if (ag.dataHora) return new Date(ag.dataHora);
  if (ag.data && ag.horaInicio) {
    const ds = ag.data.toString().split('T')[0];
    const [yy, mm, dd] = ds.split('-').map(Number);
    const [hh, mi] = String(ag.horaInicio).split(':').map(Number);
    return new Date(yy, mm - 1, dd, hh || 0, mi || 0);
  }
  return null;
}

function formatDateTime(dt) {
  if (!dt || isNaN(dt.getTime())) return '—';
  const locale = getLanguage() === 'en' ? 'en-US' : 'pt-BR';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dt);
}

function tipoLabel(tipo) {
  if (tipo === 'online') return t('dashboardMedico.typeOnline');
  if (tipo === 'domiciliar') return t('dashboardMedico.typeHome');
  return t('dashboardMedico.typeInPerson');
}

function statusLabel(status) {
  const map = {
    agendada: t('dashboardMedico.kpiScheduled'),
    confirmada: t('dashboardMedico.kpiConfirmed'),
    remarcada: t('dashboardMedico.kpiRescheduled'),
    realizada: t('dashboardMedico.kpiDone'),
    cancelada: t('dashboardMedico.kpiCancelled')
  };
  return map[status] || status || '—';
}

async function ensureProfile() {
  const token = getToken();
  if (!token) {
    await Swal.fire({
      title: t('selecao.swalError'),
      text: t('selecao.swalLoginRequired'),
      icon: 'error',
      confirmButtonText: t('selecao.swalGoLogin'),
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/login.html';
    return null;
  }

  const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    window.location.href = '/client/views/login.html';
    return null;
  }

  const data = await response.json();

  if (data.role === 'admin' || data.isAdmin === true) {
    window.location.href = '/client/views/admin-dashboard.html';
    return null;
  }

  if (data.validationStatus && data.validationStatus !== 'approved') {
    window.location.href = '/client/views/perfilMedico.html';
    return null;
  }
  if (data.validationStatus === 'approved' && !data.hasChosenPlan) {
    if (data.paymentStatus === 'pending') {
      window.location.href = '/client/views/checkoutPlano.html';
    } else {
      window.location.href = '/client/views/escolhaPlano.html';
    }
    return null;
  }

  if (data.validationStatus) {
    localStorage.setItem('validationStatus', data.validationStatus);
  }
  if (data.hasChosenPlan !== undefined) {
    localStorage.setItem('hasChosenPlan', data.hasChosenPlan ? 'true' : 'false');
  }
  localStorage.removeItem('isAdmin');

  return data;
}

function renderPlan(perfil) {
  const el = document.getElementById('dashMedicoPlan');
  if (!el) return;

  const paid = perfil.planChoice === 'paid';
  const trial = perfil.planChoice === 'trial';
  const expired = trial && perfil.trialExpired === true;
  const activeTrial = trial && perfil.trialActive === true;

  let cardClass = '';
  let badgeClass = 'dash-medico__plan-badge';
  let badgeText = t('dashboardMedico.planPaid');
  let lead = t('dashboardMedico.planPaidLead');
  let metaHtml = '';
  let asideHtml = '';
  let innerModClass = '';
  let planIcon = 'fa-layer-group';

  if (paid) {
    planIcon = 'fa-check-circle';
    cardClass = 'dash-medico__plan-card--paid';
    badgeClass += ' dash-medico__plan-badge--paid';
  } else if (trial) {
    planIcon = 'fa-gift';
    badgeText = `${t('dashboardMedico.trialFreeBadge')} · ${t('dashboardMedico.planTrial')}`;
    lead = t('dashboardMedico.planTrialLead');
    badgeClass += ' dash-medico__plan-badge--trial';
    cardClass = expired ? 'dash-medico__plan-card--expired' : 'dash-medico__plan-card--trial';

    if (expired) {
      planIcon = 'fa-exclamation-triangle';
      badgeClass = 'dash-medico__plan-badge dash-medico__plan-badge--danger';
      badgeText = t('dashboardMedico.planTrial');
      metaHtml = `<p class="dash-medico__plan-meta dash-medico__plan-meta--danger">${t('dashboardMedico.trialExpired')}</p>`;
      innerModClass = 'dash-medico__plan-inner--split';
      asideHtml = `
        <div class="dash-medico__plan-aside">
          <a class="dash-medico__btn dash-medico__btn--lg" href="planosPagamento.html"><i class="fas fa-credit-card"></i> ${t('dashboardMedico.planUpgradeCta')}</a>
        </div>`;
    } else if (activeTrial && perfil.trialDaysRemaining != null) {
      const endDate = perfil.trialEndsAt
        ? new Date(perfil.trialEndsAt).toLocaleDateString(getLanguage() === 'en' ? 'en-US' : 'pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })
        : '';
      metaHtml = `
        ${endDate ? `<p class="dash-medico__plan-text dash-medico__plan-text--muted"><i class="fas fa-calendar-alt"></i> ${t('dashboardMedico.trialEndsAt', { date: endDate })}</p>` : ''}
      `;
      innerModClass = 'dash-medico__plan-inner--split';
      asideHtml = `
        <div class="dash-medico__plan-aside">
          <p class="dash-medico__plan-aside-eyebrow">${t('dashboardMedico.trialFreeBadge')}</p>
          <div class="dash-medico__plan-countdown" aria-label="${t('dashboardMedico.trialDaysLeft', { count: perfil.trialDaysRemaining })}">
            <span class="dash-medico__plan-countdown-value">${perfil.trialDaysRemaining}</span>
            <span class="dash-medico__plan-countdown-unit">${t('dashboardMedico.planDaysUnit')}</span>
          </div>
          <a class="dash-medico__btn dash-medico__btn--lg" href="planosPagamento.html"><i class="fas fa-arrow-right"></i> ${t('dashboardMedico.planUpgradeCta')}</a>
        </div>`;
    }
  } else {
    badgeText = t('dashboardMedico.planRegistered');
    badgeClass += ' dash-medico__plan-badge--paid';
    cardClass = 'dash-medico__plan-card--paid';
    lead = t('dashboardMedico.planRegisteredLead');
  }

  el.className = `dash-medico__plan-card ${cardClass}`.trim();
  el.innerHTML = `
    <div class="dash-medico__plan-inner ${innerModClass}">
      <div class="dash-medico__plan-body">
        <div class="dash-medico__plan-head">
          <span class="${badgeClass}"><i class="fas ${planIcon}"></i> ${badgeText}</span>
        </div>
        <h2 class="dash-medico__plan-title">${t('dashboardMedico.planTitle')}</h2>
        <p class="dash-medico__plan-text">${lead}</p>
        ${activeTrial && perfil.trialDaysRemaining != null && !expired ? `<p class="dash-medico__plan-meta dash-medico__plan-meta--warn">${t('dashboardMedico.trialDaysLeft', { count: perfil.trialDaysRemaining })}</p>` : ''}
        ${metaHtml}
      </div>
      ${asideHtml}
    </div>
  `;
}

function renderKpis(d) {
  const row = document.getElementById('dashMedicoKpis');
  if (!row) return;

  const items = [
    { label: t('dashboardMedico.kpiTotal'), value: d.total ?? 0, accent: '#6366f1' },
    { label: t('dashboardMedico.kpiScheduled'), value: d.agendadas ?? 0, accent: '#0ea5e9' },
    { label: t('dashboardMedico.kpiConfirmed'), value: d.confirmadas ?? 0, accent: '#22c55e' },
    { label: t('dashboardMedico.kpiRescheduled'), value: d.remarcadas ?? 0, accent: '#a855f7' },
    { label: t('dashboardMedico.kpiDone'), value: d.realizadas ?? 0, accent: '#14b8a6' },
    { label: t('dashboardMedico.kpiCancelled'), value: d.canceladas ?? 0, accent: '#f43f5e' }
  ];

  row.innerHTML = items
    .map(
      (it) => `
    <div class="dash-medico__kpi" style="--dash-kpi-accent:${it.accent}">
      <div class="dash-medico__kpi-label">${it.label}</div>
      <div class="dash-medico__kpi-value">${it.value}</div>
    </div>
  `
    )
    .join('');
}

function buildCharts(d) {
  const mesLabels = (d.agendamentosPorMes || []).map((x) => formatMonthLabel(x.mes));
  const mesData = (d.agendamentosPorMes || []).map((x) => x.total);

  const ctxMes = document.getElementById('chartMedicoMes');
  if (ctxMes && window.Chart) {
    chartMes = new window.Chart(ctxMes, {
      type: 'line',
      data: {
        labels: mesLabels,
        datasets: [
          {
            label: t('dashboardMedico.chartMonthly'),
            data: mesData,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: chartTextColor(), maxRotation: 45, minRotation: 0 },
            grid: { color: chartGridColor() }
          },
          y: {
            beginAtZero: true,
            ticks: { color: chartTextColor(), precision: 0 },
            grid: { color: chartGridColor() }
          }
        }
      }
    });
  }

}

function renderClinicalInsights(d) {
  const total = Number(d.total || 0);
  const confirmadas = Number(d.confirmadas || 0);
  const realizadas = Number(d.realizadas || 0);
  const canceladas = Number(d.canceladas || 0);
  const proximas = Array.isArray(d.proximasConsultas) ? d.proximasConsultas : [];

  const pct = (value) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const confirmRateEl = document.getElementById('dashInsightConfirmRate');
  const completionRateEl = document.getElementById('dashInsightCompletionRate');
  const cancellationRateEl = document.getElementById('dashInsightCancellationRate');
  const uniquePatientsEl = document.getElementById('dashInsightUniquePatients');
  const noteEl = document.getElementById('dashInsightNote');

  const uniquePatients = new Set(
    proximas
      .map((ag) => ag?.pacienteNome || ag?.pacienteId?.name || ag?.pacienteId?.nome || '')
      .filter(Boolean)
  ).size;

  if (confirmRateEl) confirmRateEl.textContent = `${pct(confirmadas)}%`;
  if (completionRateEl) completionRateEl.textContent = `${pct(realizadas)}%`;
  if (cancellationRateEl) cancellationRateEl.textContent = `${pct(canceladas)}%`;
  if (uniquePatientsEl) uniquePatientsEl.textContent = String(uniquePatients);

  if (noteEl) {
    noteEl.textContent = t('dashboardMedico.insightNote', {
      total: total,
      upcoming: proximas.length,
      fallback: `Base: ${total} agendamentos e ${proximas.length} consultas futuras.`
    });
  }
}

function renderUpcoming(list) {
  const ul = document.getElementById('dashMedicoUpcoming');
  const empty = document.getElementById('dashMedicoUpcomingEmpty');
  if (!ul || !empty) return;

  const sorted = [...(list || [])].sort((a, b) => {
    const ta = getAgDateTime(a)?.getTime() ?? 0;
    const tb = getAgDateTime(b)?.getTime() ?? 0;
    return ta - tb;
  });

  if (!sorted.length) {
    ul.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  ul.innerHTML = sorted
    .map((ag) => {
      const dt = getAgDateTime(ag);
      const nome =
        ag.pacienteNome ||
        (ag.pacienteId && (ag.pacienteId.name || ag.pacienteId.nome)) ||
        '—';
      const tipo = tipoLabel(ag.tipoConsulta || 'presencial');
      const st = statusLabel(ag.status);
      return `
      <li>
        <div>
          <span class="dash-medico__apt-name">${nome}</span>
          <span class="dash-medico__apt-badge">${st}</span>
          <div class="dash-medico__apt-meta">${tipo}</div>
        </div>
        <div class="dash-medico__apt-time">${formatDateTime(dt)}</div>
      </li>`;
    })
    .join('');
}

function renderShortcuts() {
  const el = document.getElementById('dashMedicoShortcuts');
  if (!el) return;
  el.innerHTML = `
    <a class="dash-medico__shortcut" href="planosPagamento.html"><i class="fas fa-file-invoice-dollar"></i> ${t('dashboardMedico.shortcutPlansPayment')}</a>
    <a class="dash-medico__shortcut" href="selecao.html"><i class="fas fa-search"></i> ${t('dashboardMedico.shortcutPatients')}</a>
    <a class="dash-medico__shortcut" href="agendamentos.html"><i class="fas fa-calendar-alt"></i> ${t('dashboardMedico.shortcutAppointments')}</a>
    <a class="dash-medico__shortcut" href="notificacoes.html"><i class="fas fa-bell"></i> ${t('dashboardMedico.shortcutNotifications')}</a>
    <a class="dash-medico__shortcut" href="perfilMedico.html"><i class="fas fa-user-md"></i> ${t('dashboardMedico.shortcutProfile')}</a>
  `;
}

function rebuildChartsForTheme() {
  if (!lastStats || !window.Chart) return;
  destroyCharts();
  buildCharts(lastStats);
}

async function loadStats() {
  const token = getToken();
  const errEl = document.getElementById('dashMedicoError');
  const res = await fetch(`${API_URL}/api/agendamentos/estatisticas?limitProximas=12`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = t('dashboardMedico.loadError');
    }
    return;
  }
  if (errEl) errEl.hidden = true;

  const d = await res.json();
  lastStats = d;
  destroyCharts();
  renderKpis(d);
  buildCharts(d);
  renderClinicalInsights(d);
  renderUpcoming(d.proximasConsultas || []);
  applyPageTranslations();
}

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await ensureProfile();
  if (!perfil) return;

  await initApp({ titleKey: 'dashboardMedico.title', activePage: 'dashboardmedico' });
  if (window.updateSidebarInfo) {
    window.updateSidebarInfo(perfil.nome, perfil.areaAtuacao, perfil.genero, perfil.crm);
  }
  renderPlan(perfil);
  renderShortcuts();
  await loadStats();

  new MutationObserver(() => rebuildChartsForTheme()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});
