import { initApp } from '/client/public/js/initApp.js';
import { initHeaderComponent } from '/client/public/js/components/header.js';
import { initSidebar } from '/client/public/js/components/sidebar.js';
import { t, getLanguage, changeLanguage } from '/client/public/js/i18n.js';
import { API_URL } from '/client/public/js/config.js';

const selectors = {
  editModal: '#editModal',
  editForm: '#editForm',
  editLabel: '#editLabel',
  editInput: '#editInput',
  editError: '#editError',
  changePasswordModal: '#changePasswordModal',
  changePasswordForm: '#changePasswordForm',
  currentPassword: '#currentPassword',
  newPassword: '#newPassword',
  confirmPassword: '#confirmPassword'
};

function toggleModal(modalId, visible) {
  const modal = document.querySelector(modalId);
  if (!modal) return;
  if (visible) {
    modal.classList.add('visible');
  } else {
    modal.classList.remove('visible');
  }
}

function bindModals() {
  const editProfileBtn = document.getElementById('editProfileBtn');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const closePasswordBtn = document.getElementById('closePasswordModal');
  const cancelPasswordBtn = document.getElementById('cancelPassword');

  editProfileBtn?.addEventListener('click', () => {
    window.location.href = '/client/views/perfilMedico.html';
  });

  changePasswordBtn?.addEventListener('click', () => {
    toggleModal(selectors.changePasswordModal, true);
  });

  closePasswordBtn?.addEventListener('click', () => {
    toggleModal(selectors.changePasswordModal, false);
  });

  cancelPasswordBtn?.addEventListener('click', () => {
    toggleModal(selectors.changePasswordModal, false);
  });

  document.addEventListener('click', (event) => {
    const modal = document.querySelector(selectors.changePasswordModal);
    if (event.target === modal && modal?.classList.contains('visible')) {
      toggleModal(selectors.changePasswordModal, false);
    }
  });

  document.querySelector(selectors.changePasswordForm)?.addEventListener('submit', async event => {
    event.preventDefault();
    const current = document.querySelector(selectors.currentPassword);
    const next = document.querySelector(selectors.newPassword);
    const confirm = document.querySelector(selectors.confirmPassword);
    const errors = {
      current: document.getElementById('currentPasswordError'),
      next: document.getElementById('newPasswordError'),
      confirm: document.getElementById('confirmPasswordError')
    };

    errors.current.textContent = '';
    errors.next.textContent = '';
    errors.confirm.textContent = '';

    if (!current.value.trim()) {
      errors.current.textContent = t('configuracoes.errorCurrentRequired');
      return;
    }

    if (next.value.length < 6) {
      errors.next.textContent = t('configuracoes.errorPasswordMin');
      return;
    }

    if (next.value !== confirm.value) {
      errors.confirm.textContent = t('configuracoes.errorPasswordMatch');
      return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = t('configuracoes.changing');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          senhaAtual: current.value,
          senha: next.value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || t('configuracoes.errorChangePassword'));
      }

      toggleModal(selectors.changePasswordModal, false);
      current.value = '';
      next.value = '';
      confirm.value = '';

      await Swal.fire({
        icon: 'success',
        title: t('configuracoes.passwordUpdated'),
        text: t('configuracoes.passwordUpdatedText'),
        confirmButtonColor: '#002A42'
      });
    } catch (error) {
      errors.current.textContent = error.message || t('configuracoes.errorChangePassword');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function loadPreferences() {
  const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  
  const twoFactorToggle = document.getElementById('twoFactorToggle');
  const emailToggle = document.getElementById('emailNotificationsToggle');
  const pushToggle = document.getElementById('pushNotificationsToggle');

  if (twoFactorToggle) {
    twoFactorToggle.checked = preferences.twoFactorEnabled || false;
    const twoFactorLabel = document.getElementById('twoFactorLabel');
    if (twoFactorLabel) {
      twoFactorLabel.textContent = twoFactorToggle.checked ? t('configuracoes.twoFactorOn') : t('configuracoes.twoFactorOff');
    }
  }

  if (emailToggle) {
    emailToggle.checked = preferences.emailNotifications !== false;
    const emailLabel = document.getElementById('emailNotificationsLabel');
    if (emailLabel) {
      emailLabel.textContent = emailToggle.checked
        ? t('configuracoes.emailNotificationsOn')
        : t('configuracoes.emailNotificationsOff');
    }
  }

  if (pushToggle) {
    pushToggle.checked = preferences.pushNotifications !== false;
    const pushLabel = document.getElementById('pushNotificationsLabel');
    if (pushLabel) {
      pushLabel.textContent = pushToggle.checked
        ? t('configuracoes.pushNotificationsOn')
        : t('configuracoes.pushNotificationsOff');
    }
  }
}

function savePreferences(preferences) {
  const current = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  const updated = { ...current, ...preferences };
  localStorage.setItem('userPreferences', JSON.stringify(updated));
}

function bindToggles() {
  const twoFactorToggle = document.getElementById('twoFactorToggle');
  const emailToggle = document.getElementById('emailNotificationsToggle');
  const pushToggle = document.getElementById('pushNotificationsToggle');

  twoFactorToggle?.addEventListener('change', event => {
    const label = document.getElementById('twoFactorLabel');
    label.textContent = event.target.checked ? t('configuracoes.twoFactorOn') : t('configuracoes.twoFactorOff');
    savePreferences({ twoFactorEnabled: event.target.checked });
  });

  emailToggle?.addEventListener('change', event => {
    const label = document.getElementById('emailNotificationsLabel');
    label.textContent = event.target.checked
      ? t('configuracoes.emailNotificationsOn')
      : t('configuracoes.emailNotificationsOff');
    savePreferences({ emailNotifications: event.target.checked });
  });

  pushToggle?.addEventListener('change', event => {
    const label = document.getElementById('pushNotificationsLabel');
    label.textContent = event.target.checked
      ? t('configuracoes.pushNotificationsOn')
      : t('configuracoes.pushNotificationsOff');
    savePreferences({ pushNotifications: event.target.checked });
  });

  loadPreferences();
}

function bindThemeSelect() {
  const select = document.getElementById('themeSelect');
  const display = document.getElementById('themeDisplay');

  if (!select || !display) {
    return;
  }

  const currentTheme = typeof window.getCurrentTheme === 'function' ? window.getCurrentTheme() : 'light';
  select.value = currentTheme;
  display.textContent = currentTheme === 'dark' ? t('configuracoes.themeDark') : currentTheme === 'auto' ? t('configuracoes.themeAuto') : t('configuracoes.themeLight');

  select.addEventListener('change', event => {
    const value = event.target.value;
    const label = value === 'dark' ? t('configuracoes.themeDark') : value === 'auto' ? t('configuracoes.themeAuto') : t('configuracoes.themeLight');
    display.textContent = label;
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(value);
    }
  });
}

function bindLanguageSelect() {
  const select = document.getElementById('languageSelect');
  const display = document.getElementById('languageDisplay');

  if (!select || !display) {
    return;
  }

  const lang = getLanguage();
  select.value = lang;
  display.textContent = lang === 'en' ? t('configuracoes.languageEn') : t('configuracoes.languagePt');

  select.addEventListener('change', event => {
    const value = event.target.value;
    if (value === getLanguage()) return;
    changeLanguage(value);
  });
}

async function ensureProfile() {
  const token = localStorage.getItem('token');
  if (!token) {
    await Swal.fire({
      title: t('configuracoes.error'),
      text: t('configuracoes.errorMustLogin'),
      icon: 'error',
      confirmButtonText: t('configuracoes.goToLogin'),
      confirmButtonColor: '#002A42'
    });
    window.location.href = '/client/views/login.html';
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(t('configuracoes.errorLoadUser'));
    }

    const data = await response.json();
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');
    if (nameEl) nameEl.textContent = data.nome ?? '—';
    if (emailEl) emailEl.textContent = data.email ?? '—';

    if (window.updateSidebarInfo) {
      window.updateSidebarInfo(data.nome, data.areaAtuacao, data.genero, data.crm);
    }

    return data;
  } catch (error) {
    await Swal.fire({
      title: t('configuracoes.error'),
      text: t('configuracoes.errorLoadProfile'),
      icon: 'error',
      confirmButtonText: t('configuracoes.goToLogin'),
      confirmButtonColor: '#002A42'
    });
    localStorage.removeItem('token');
    window.location.href = '/client/views/login.html';
    return null;
  }
}

function bindPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = button.querySelector('i');
      
      if (input && icon) {
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    });
  });
}

function bindDeleteAccount() {
  const deleteBtn = document.getElementById('deleteAccountBtn');
  
  deleteBtn?.addEventListener('click', async () => {
    const result = await Swal.fire({
      title: t('configuracoes.deleteAccountTitle'),
      text: t('configuracoes.deleteAccountText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: t('configuracoes.confirmDelete'),
      cancelButtonText: t('configuracoes.cancel'),
      input: 'password',
      inputPlaceholder: t('configuracoes.deletePasswordPlaceholder'),
      inputValidator: (value) => {
        if (!value) {
          return t('configuracoes.deletePasswordRequired');
        }
      }
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/auth/delete-account`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            senha: result.value
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || t('configuracoes.errorDelete'));
        }

        await Swal.fire({
          icon: 'success',
          title: t('configuracoes.accountDeleted'),
          text: t('configuracoes.accountDeletedText'),
          confirmButtonColor: '#002A42'
        });

        localStorage.clear();
        window.location.href = '/client/views/login.html';
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: t('configuracoes.error'),
          text: error.message || t('configuracoes.errorDeleteAccount'),
          confirmButtonColor: '#002A42'
        });
      }
    }
  });
}

async function init() {
  await initApp({ titleKey: 'configuracoes.title', activePage: 'configuracoes' });

  const toggleButton = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  toggleButton?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
    toggleButton.classList.toggle('shifted');
  });

  bindModals();
  bindToggles();
  bindThemeSelect();
  bindLanguageSelect();
  bindPasswordToggles();
  bindDeleteAccount();
  await ensureProfile();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

