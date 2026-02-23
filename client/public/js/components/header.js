import { API_URL } from '../config.js';
import { initializeNotifications } from '../initNotifications.js';
import { t, getLanguage, changeLanguage } from '../i18n.js';

export function initHeaderComponent({ title = '', titleKey = '' } = {}) {
  initializeNotifications();
  const container = document.getElementById('header-component');
  if (!container) {
    return;
  }

  const heading = titleKey ? t(titleKey) : (title.trim() ? title : t('header.clinicalPanel'));
  const lang = getLanguage();
  const isEn = lang === 'en';
  const langToggleLabel = isEn ? 'PT' : 'EN';
  const langToggleTarget = isEn ? 'pt-BR' : 'en';

  container.innerHTML = `
    <header class="app-header">
      <div class="header-left">
        <button type="button" class="menu-toggle" aria-label="Alternar menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="header-title-group">
          <img class="header-logo" src="/client/public/assets/PulseNegativo.png" alt="PulseFlow">
          <h1 class="header-title">${heading}</h1>
        </div>
      </div>
      <div class="header-right">
        <button type="button" class="header-lang-toggle" id="headerLangToggle" aria-label="${isEn ? 'Switch to Portuguese' : 'Switch to English'}">${langToggleLabel}</button>
        <div class="header-actions">
          <button type="button" class="header-action" aria-label="${t('header.notifications')}" data-action="notifications" id="notificationButton">
            <i class="far fa-bell"></i>
            <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
          </button>
          <button type="button" class="header-action" aria-label="${t('header.appointments')}" data-action="appointments">
            <i class="far fa-calendar"></i>
          </button>
        </div>
        <button type="button" class="header-logout" id="headerLogoutButton" aria-label="${t('header.logout')}">
          <i class="fas fa-power-off"></i>
          <span>${t('header.logout')}</span>
        </button>
      </div>
    </header>
  `;

  const langToggle = container.querySelector('#headerLangToggle');
  if (langToggle) {
    langToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      changeLanguage(langToggleTarget);
    });
  }

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  const menuToggle = container.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  function toggleSidebar() {
    const isActive = sidebar.classList.toggle('active');
    menuToggle.classList.toggle('shifted', isActive);
    menuToggle.setAttribute('aria-expanded', isActive);
    
    if (window.innerWidth <= 1024) {
      if (isActive) {
        overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
      } else {
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
      }
    }
  }

  function closeSidebar() {
    sidebar.classList.remove('active');
    menuToggle.classList.remove('shifted');
    menuToggle.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', toggleSidebar);

    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('click', (event) => {
      const isClickInsideSidebar = sidebar.contains(event.target);
      const isClickOnToggle = menuToggle.contains(event.target);
      const isClickInsideHeader = container.contains(event.target);

      if (!isClickInsideSidebar && !isClickOnToggle && !isClickInsideHeader && sidebar.classList.contains('active') && window.innerWidth <= 1024) {
        closeSidebar();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        sidebar.classList.add('active');
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
      } else if (window.innerWidth <= 1024 && !sidebar.classList.contains('active')) {
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
      }
    });

    if (window.innerWidth > 1024) {
      sidebar.classList.add('active');
    }
  }

  const actions = [
    { selector: '[data-action="notifications"]', target: '/client/views/notificacoes.html' },
    { selector: '[data-action="appointments"]', target: '/client/views/agendamentos.html' }
  ];

  actions.forEach(action => {
    const button = container.querySelector(action.selector);
    if (button) {
      button.addEventListener('click', () => {
        window.location.href = action.target;
      });
    }
  });

  const logoutButton = container.querySelector('#headerLogoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: t('header.logoutConfirmTitle'),
          text: t('header.logoutConfirmText'),
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#1d4ed8',
          cancelButtonColor: '#64748b',
          confirmButtonText: t('header.logoutConfirmYes'),
          cancelButtonText: t('header.logoutConfirmCancel')
        }).then((result) => {
          if (result.isConfirmed) {
            localStorage.removeItem('token');
            localStorage.removeItem('tokenPaciente');
            window.location.href = '/client/views/login.html';
          }
        });
      } else {
        if (confirm(t('header.logoutConfirmText'))) {
          localStorage.removeItem('token');
          localStorage.removeItem('tokenPaciente');
          window.location.href = '/client/views/login.html';
        }
      }
    });
  }

  window.updateHeaderDoctorInfo = function() {};

  async function updateNotificationBadge() {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
      if (!token) {
        return;
      }

      const endpoint = localStorage.getItem('token') 
        ? '/api/notificacoes/unread-count' 
        : '/api/notificacoes-paciente/unread-count';

      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.count || 0;
        const badge = document.getElementById('notificationBadge');
        
        if (badge) {
          if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.display = 'inline-flex';
          } else {
            badge.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar badge de notificações:', error);
    }
  }

  updateNotificationBadge();
  setInterval(updateNotificationBadge, 30000);
  
  window.updateNotificationBadge = updateNotificationBadge;
}

