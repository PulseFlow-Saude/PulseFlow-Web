import { API_URL } from '../config.js';
import { hasActivePatient, getActivePatient } from '../utils/patientValidation.js';
import { t } from '../i18n.js';

// Carregar serviço de gravação em background se disponível
if (typeof window !== 'undefined') {
  import('../recordingBackground.js').catch(() => {
    // Ignorar erro se o arquivo não existir
  });
}

const icons = {
  perfilmedico: '<i class="fas fa-user-md"></i>',
  agendamentos: '<i class="fas fa-calendar-alt"></i>',
  selecao: '<i class="fas fa-search"></i>',
  notificacoes: '<i class="fas fa-bell"></i>',
  configuracoes: '<i class="fas fa-cog"></i>',
  admin: '<i class="fas fa-user-shield"></i>',
  perfilpaciente: '<i class="fas fa-user"></i>',
  historicoprontuario: '<i class="fas fa-file-medical"></i>',
  anexoexame: '<i class="fas fa-paperclip"></i>',
  historicoeventoclinico: '<i class="fas fa-clipboard-check"></i>',
  diabetes: '<i class="fas fa-tint"></i>',
  pressaoarterial: '<i class="fas fa-heartbeat"></i>',
  batimentoscardiacos: '<i class="fas fa-heart-pulse"></i>',
  contagempassos: '<i class="fas fa-walking"></i>',
  historicocrisegastrite: '<i class="fas fa-chart-line"></i>',
  ciclomenstrual: '<i class="fas fa-circle"></i>',
  hormonal: '<i class="fas fa-balance-scale"></i>',
  insonia: '<i class="fas fa-moon"></i>',
  enxaqueca: '<i class="fas fa-head-side-virus"></i>',
  gravarconsulta: '<i class="fas fa-microphone"></i>',
  historicoresumos: '<i class="fas fa-file-alt"></i>',
  suporte: '<i class="fas fa-comments"></i>',
  sobre: '<i class="fas fa-info-circle"></i>'
};

const primaryLinks = [
  { page: 'perfilmedico', labelKey: 'sidebar.perfilMedico', href: 'perfilMedico.html', icon: icons.perfilmedico },
  { page: 'agendamentos', labelKey: 'sidebar.agendamentos', href: 'agendamentos.html', icon: icons.agendamentos },
  { page: 'notificacoes', labelKey: 'sidebar.notificacoes', href: 'notificacoes.html', icon: icons.notificacoes },
  { page: 'selecao', labelKey: 'sidebar.buscarPacientes', href: 'selecao.html', icon: icons.selecao }
];

const secondaryLinks = [
  { page: 'configuracoes', labelKey: 'sidebar.configuracoes', href: 'configuracoes.html', icon: icons.configuracoes }
];

const patientMainLinks = [
  { page: 'perfilpaciente', labelKey: 'sidebar.perfilPaciente', href: 'perfilPaciente.html', icon: icons.perfilpaciente },
  { page: 'agendamentos', labelKey: 'sidebar.agendamentos', href: 'agendamentos.html', icon: icons.agendamentos },
  { page: 'notificacoes', labelKey: 'sidebar.notificacoes', href: 'notificacoes.html', icon: icons.notificacoes },
  { page: 'gravarconsulta', labelKey: 'sidebar.resumirConsulta', href: 'gravarConsulta.html', icon: icons.gravarconsulta },
  { page: 'historicoresumos', labelKey: 'sidebar.historicoResumos', href: 'historicoResumos.html', icon: icons.historicoresumos },
  { page: 'historicoprontuario', labelKey: 'sidebar.registroClinico', href: 'historicoProntuario.html', icon: icons.historicoprontuario },
  { page: 'anexoexame', labelKey: 'sidebar.anexoExames', href: 'anexoExame.html', icon: icons.anexoexame },
  { page: 'historicoeventoclinico', labelKey: 'sidebar.eventosClinicos', href: 'historicoEventoClinico.html', icon: icons.historicoeventoclinico }
];

const patientReportLinks = [
  { page: 'diabetes', labelKey: 'sidebar.diabetes', href: 'diabetes.html', icon: icons.diabetes },
  { page: 'pressaoarterial', labelKey: 'sidebar.pressaoArterial', href: 'pressaoArterial.html', icon: icons.pressaoarterial },
  { page: 'batimentoscardiacos', labelKey: 'sidebar.batimentosCardiacos', href: 'batimentosCardiacos.html', icon: icons.batimentoscardiacos },
  { page: 'contagempassos', labelKey: 'sidebar.contagemPassos', href: 'contagemPassos.html', icon: icons.contagempassos },
  { page: 'historicocrisegastrite', labelKey: 'sidebar.criseGastrite', href: 'historicoCriseGastrite.html', icon: icons.historicocrisegastrite },
  { page: 'ciclomenstrual', labelKey: 'sidebar.cicloMenstrual', href: 'cicloMenstrual.html', icon: icons.ciclomenstrual },
  { page: 'hormonal', labelKey: 'sidebar.saudeHormonal', href: 'hormonal.html', icon: icons.hormonal },
  { page: 'insonia', labelKey: 'sidebar.insonia', href: 'insonia.html', icon: icons.insonia },
  { page: 'enxaqueca', labelKey: 'sidebar.enxaqueca', href: 'enxaqueca.html', icon: icons.enxaqueca }
];

function buildLinks(links, activePage) {
  return links
    .map(link => {
      const isActive = link.page === activePage ? ' active' : '';
      const icon = link.icon || '<i class="fas fa-circle"></i>';
      const label = link.labelKey ? t(link.labelKey) : link.label;
      return `<li><a class="sidebar-link${isActive}" data-page="${link.page}" href="${link.href}"><span class="sidebar-link-icon">${icon}</span><span class="sidebar-link-text">${label}</span></a></li>`;
    })
    .join('');
}

async function loadDoctorNameForPatientSidebar() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return;

    const medico = await response.json();
    
    if (window.updateSidebarInfo) {
      window.updateSidebarInfo(medico.nome, medico.areaAtuacao, medico.genero, medico.crm);
    }
  } catch (error) {
  }
}

function isDoctor() {
  const token = localStorage.getItem('token');
  return !!token;
}

function isDoctorApproved() {
  const status = localStorage.getItem('validationStatus');
  return status === 'approved';
}

function hasDoctorChosenPlan() {
  return localStorage.getItem('hasChosenPlan') === 'true';
}

function isAdminUser() {
  return localStorage.getItem('isAdmin') === 'true';
}

export function initSidebar(activePage = '') {
  const container = document.getElementById('sidebar-component');
  if (!container) {
    return;
  }

  const normalizedPage = activePage.trim().toLowerCase();
  const isMedico = isDoctor();
  const hasPatient = hasActivePatient();
  const isAdmin = isAdminUser();

  if (isAdmin) {
    const adminLinks = [
      { page: 'admin', labelKey: 'sidebar.adminValidation', href: 'painel-admin.html', icon: icons.admin },
      { page: 'perfilmedico', labelKey: 'sidebar.perfilMedico', href: 'perfilMedico.html', icon: icons.perfilmedico },
      { page: 'configuracoes', labelKey: 'sidebar.configuracoes', href: 'configuracoes.html', icon: icons.configuracoes }
    ];
    const adminHtml = buildLinks(adminLinks, normalizedPage);
    container.innerHTML = `
      <aside class="sidebar">
        <div class="profile">
          <div class="profile-info">
            <h3 id="sidebarName">${t('sidebar.defaultDoctorName')}</h3>
            <p class="profile-role" id="sidebarSpecialty">${t('sidebar.adminRole', { fallback: 'Administrador' })}</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          <ul class="nav-main">
            ${adminHtml}
          </ul>
        </nav>
        <div class="sidebar-footer">
          <a class="sidebar-link alt" data-page="configuracoes" href="configuracoes.html">
            <span class="sidebar-link-icon">${icons.configuracoes}</span>
            <span class="sidebar-link-text">${t('sidebar.configuracoes')}</span>
          </a>
          <a class="sidebar-link alt" data-page="suporte" href="contato.html">
            <span class="sidebar-link-icon">${icons.suporte}</span>
            <span class="sidebar-link-text">${t('sidebar.suportePulseFlow')}</span>
          </a>
        </div>
      </aside>
    `;
    container.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === normalizedPage) link.classList.add('active');
    });
    window.updateSidebarInfo = function(name, specialty) {
      const nameElement = container.querySelector('#sidebarName');
      const specialtyElement = container.querySelector('#sidebarSpecialty');
      if (nameElement && name) nameElement.textContent = name;
      if (specialtyElement) specialtyElement.textContent = specialty || t('sidebar.adminRole', { fallback: 'Administrador' });
    };
    loadDoctorNameForPatientSidebar().catch(() => {});
    return;
  }

  const doctorApproved = isDoctorApproved();
  const doctorChosePlan = hasDoctorChosenPlan();

  if (isMedico && !doctorApproved) {
    const restrictedLinks = [
      { page: 'perfilmedico', labelKey: 'sidebar.perfilMedico', href: 'perfilMedico.html', icon: icons.perfilmedico },
      { page: 'configuracoes', labelKey: 'sidebar.configuracoes', href: 'configuracoes.html', icon: icons.configuracoes }
    ];
    const restrictedHtml = buildLinks(restrictedLinks, normalizedPage);
    container.innerHTML = `
      <aside class="sidebar">
        <div class="profile">
          <div class="profile-info">
            <h3 id="sidebarName">${t('sidebar.defaultDoctorName')}</h3>
            <p class="profile-role" id="sidebarSpecialty">${t('validacao.contaEmValidacao', { fallback: 'Conta em validação' })}</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          <ul class="nav-main">
            ${restrictedHtml}
          </ul>
        </nav>
        <div class="sidebar-footer">
          <a class="sidebar-link alt" data-page="configuracoes" href="configuracoes.html">
            <span class="sidebar-link-icon">${icons.configuracoes}</span>
            <span class="sidebar-link-text">${t('sidebar.configuracoes')}</span>
          </a>
        </div>
      </aside>
    `;
    container.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === normalizedPage) link.classList.add('active');
    });
    window.updateSidebarInfo = function(name, specialty) {
      const nameElement = container.querySelector('#sidebarName');
      const specialtyElement = container.querySelector('#sidebarSpecialty');
      if (nameElement && name) nameElement.textContent = name;
      if (specialtyElement) specialtyElement.textContent = specialty || t('validacao.contaEmValidacao', { fallback: 'Conta em validação' });
    };
    return;
  }

  if (isMedico && doctorApproved && !doctorChosePlan) {
    const approvedNoPlanLinks = [
      { page: 'perfilmedico', labelKey: 'sidebar.perfilMedico', href: 'perfilMedico.html', icon: icons.perfilmedico },
      { page: 'escolhaplano', labelKey: 'sidebar.escolherPlano', href: 'escolhaPlano.html', icon: '<i class="fas fa-credit-card"></i>' },
      { page: 'configuracoes', labelKey: 'sidebar.configuracoes', href: 'configuracoes.html', icon: icons.configuracoes }
    ];
    const approvedNoPlanHtml = buildLinks(approvedNoPlanLinks, normalizedPage);
    container.innerHTML = `
      <aside class="sidebar">
        <div class="profile">
          <div class="profile-info">
            <h3 id="sidebarName">${t('sidebar.defaultDoctorName')}</h3>
            <p class="profile-role" id="sidebarSpecialty">${t('sidebar.aprovadoEscolhaPlano', { fallback: 'Aprovado — escolha seu plano' })}</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          <ul class="nav-main">
            ${approvedNoPlanHtml}
          </ul>
        </nav>
      </aside>
    `;
    container.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === normalizedPage) link.classList.add('active');
    });
    window.updateSidebarInfo = function(name, specialty) {
      const nameElement = container.querySelector('#sidebarName');
      const specialtyElement = container.querySelector('#sidebarSpecialty');
      if (nameElement && name) nameElement.textContent = name;
      if (specialtyElement) specialtyElement.textContent = specialty || t('sidebar.aprovadoEscolhaPlano', { fallback: 'Aprovado — escolha seu plano' });
    };
    loadDoctorNameForPatientSidebar().catch(() => {});
    return;
  }

  if (isMedico && doctorChosePlan && hasPatient) {
    const mainLinksHtml = buildLinks(patientMainLinks, normalizedPage);
    const reportLinksHtml = buildLinks(patientReportLinks, normalizedPage);
    const reportsActive = patientReportLinks.some(link => link.page === normalizedPage);
    const sectionClass = reportsActive ? 'nav-section active' : 'nav-section';
    
    const doctorName = t('sidebar.defaultDoctorName');

    container.innerHTML = `
      <aside class="sidebar">
        <div class="profile">
          <div class="profile-info">
            <h3 id="sidebarName">${doctorName}</h3>
            <p class="profile-role" id="sidebarSpecialty">${t('sidebar.defaultSpecialty')}</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          <ul class="nav-main">
            ${mainLinksHtml}
          </ul>
          <div class="${sectionClass}">
            <p class="nav-heading">${t('sidebar.relatoriosDashboards')}</p>
            <ul class="nav-sub">
              ${reportLinksHtml}
            </ul>
          </div>
        </nav>
        <div class="sidebar-footer">
          <a class="sidebar-link alt" data-page="selecao" href="selecao.html">
            <span class="sidebar-link-icon">${icons.selecao}</span>
            <span class="sidebar-link-text">${t('sidebar.trocarPaciente')}</span>
          </a>
          <a class="sidebar-link alt" data-page="configuracoes" href="configuracoes.html">
            <span class="sidebar-link-icon">${icons.configuracoes}</span>
            <span class="sidebar-link-text">${t('sidebar.configuracoes')}</span>
          </a>
        </div>
      </aside>
    `;

    container.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === normalizedPage) {
        link.classList.add('active');
      }
    });

    window.updateSidebarInfo = function(name, specialty, genero, crm) {
      const nameElement = container.querySelector('#sidebarName');
      const specialtyElement = container.querySelector('#sidebarSpecialty');
      const resolvedName = name && name.trim() ? name.trim() : t('sidebar.defaultName');
      const isFeminino = (genero || '').toString().toLowerCase().startsWith('f');
      const prefix = isFeminino ? 'Dra.' : 'Dr.';
      
      if (nameElement) {
        const nameParts = resolvedName.split(' ');
        if (nameParts.length > 2) {
          const firstName = nameParts.slice(0, -1).join(' ');
          const lastName = nameParts[nameParts.length - 1];
          nameElement.innerHTML = `${prefix} ${firstName}<br>${lastName}`;
        } else {
          nameElement.textContent = `${prefix} ${resolvedName}`;
        }
      }
      if (specialtyElement) {
        const specialtyText = specialty && specialty.trim() ? specialty : t('sidebar.defaultSpecialty');
        const crmText = crm && crm.trim() ? `CRM ${crm.trim()}` : '';
        specialtyElement.textContent = crmText ? `${specialtyText} - ${crmText}` : specialtyText;
      }
    };

    loadDoctorNameForPatientSidebar();
    return;
  }

  if (isMedico && doctorChosePlan) {
    const primary = buildLinks(primaryLinks, normalizedPage);

    container.innerHTML = `
      <aside class="sidebar">
        <div class="profile">
          <div class="profile-info">
            <h3 id="sidebarName">${t('sidebar.defaultDoctorName')}</h3>
            <p class="profile-role" id="sidebarSpecialty">${t('sidebar.specialistPulseFlow')}</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          <ul class="nav-main">
            ${primary}
          </ul>
        </nav>
        <div class="sidebar-footer">
          <a class="sidebar-link alt" data-page="configuracoes" href="configuracoes.html">
            <span class="sidebar-link-icon">${icons.configuracoes}</span>
            <span class="sidebar-link-text">${t('sidebar.configuracoes')}</span>
          </a>
          <a class="sidebar-link alt" data-page="suporte" href="contato.html">
            <span class="sidebar-link-icon">${icons.suporte}</span>
            <span class="sidebar-link-text">${t('sidebar.suportePulseFlow')}</span>
          </a>
          <a class="sidebar-link alt" data-page="sobre" href="sobreNos.html">
            <span class="sidebar-link-icon">${icons.sobre}</span>
            <span class="sidebar-link-text">${t('sidebar.sobrePlataforma')}</span>
          </a>
        </div>
      </aside>
    `;

    container.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === normalizedPage) {
        link.classList.add('active');
      }
    });

    window.updateSidebarInfo = function(name, specialty, genero, crm) {
      const nameElement = container.querySelector('#sidebarName');
      const specialtyElement = container.querySelector('#sidebarSpecialty');
      const resolvedName = name && name.trim() ? name.trim() : t('sidebar.defaultName');
      const isFeminino = (genero || '').toString().toLowerCase().startsWith('f');
      const prefix = isFeminino ? 'Dra.' : 'Dr.';
      
      if (nameElement) {
        const nameParts = resolvedName.split(' ');
        if (nameParts.length > 2) {
          const firstName = nameParts.slice(0, -1).join(' ');
          const lastName = nameParts[nameParts.length - 1];
          nameElement.innerHTML = `${prefix} ${firstName}<br>${lastName}`;
        } else {
          nameElement.textContent = `${prefix} ${resolvedName}`;
        }
      }
      if (specialtyElement) {
        const specialtyText = specialty && specialty.trim() ? specialty : t('sidebar.specialistPulseFlow');
        const crmText = crm && crm.trim() ? `CRM ${crm.trim()}` : '';
        specialtyElement.textContent = crmText ? `${specialtyText} - ${crmText}` : specialtyText;
      }
    };
    return;
  }

  const mainLinksHtml = buildLinks(patientMainLinks, normalizedPage);
  const reportLinksHtml = buildLinks(patientReportLinks, normalizedPage);
  const reportsActive = patientReportLinks.some(link => link.page === normalizedPage);
  const sectionClass = reportsActive ? 'nav-section active' : 'nav-section';

  container.innerHTML = `
    <aside class="sidebar">
      <div class="profile">
        <div class="profile-info">
          <h3 id="sidebarName">${t('sidebar.defaultDoctorName')}</h3>
          <p class="profile-role">${t('sidebar.defaultSpecialty')}</p>
        </div>
      </div>
      <nav class="sidebar-nav">
        <ul class="nav-main">
          ${mainLinksHtml}
        </ul>
        <div class="${sectionClass}">
          <p class="nav-heading">${t('sidebar.relatoriosDashboards')}</p>
          <ul class="nav-sub">
            ${reportLinksHtml}
          </ul>
        </div>
      </nav>
      <div class="sidebar-footer">
        <a class="sidebar-link alt" data-page="selecao" href="selecao.html">
          <span class="sidebar-link-icon">${icons.selecao}</span>
          <span class="sidebar-link-text">${t('sidebar.trocarPaciente')}</span>
        </a>
        <a class="sidebar-link alt" data-page="configuracoes" href="configuracoes.html">
          <span class="sidebar-link-icon">${icons.configuracoes}</span>
          <span class="sidebar-link-text">${t('sidebar.configuracoes')}</span>
        </a>
      </div>
    </aside>
  `;

  container.querySelectorAll('[data-page]').forEach(link => {
    if (link.dataset.page === normalizedPage) {
      link.classList.add('active');
    }
  });

  window.updateSidebarInfo = function(name) {
    const sidebarName = container.querySelector('#sidebarName');
    if (sidebarName) {
      sidebarName.textContent = name && name.trim() ? name : t('sidebar.defaultDoctorName');
    }
  };
}
