import { API_URL } from '/client/public/js/config.js';
import { t, getLanguage } from '/client/public/js/i18n.js';

const STORAGE_KEY = 'pf_notifications';
let currentFilter = 'all';

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const lang = getLanguage();
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';

  if (seconds < 60) return t('notificacoes.now');
  if (minutes < 60) return t('notificacoes.minutesAgo', { count: minutes });
  if (hours < 24) return hours === 1 ? t('notificacoes.hoursAgo', { count: hours }) : t('notificacoes.hoursAgoPlural', { count: hours });
  if (days === 1) return t('notificacoes.yesterday');
  if (days < 7) return t('notificacoes.daysAgo', { count: days });
  return date.toLocaleDateString(locale);
}

/**
 * Translates notification title and description from backend (PT) to current language.
 */
function translateNotificationContent(title, description) {
  if (!title && !description) return { title: '', description: '' };

  // Title mapping supports PT/EN sources from backend.
  const titleMap = {
    'novo agendamento': 'notificacoes.msgNewAppointment',
    'new appointment': 'notificacoes.msgNewAppointment',
    'agendamento cancelado pelo paciente': 'notificacoes.msgAppointmentCancelledByPatient',
    'appointment cancelled by patient': 'notificacoes.msgAppointmentCancelledByPatient',
    'appointment canceled by patient': 'notificacoes.msgAppointmentCancelledByPatient',
    'consulta agendada': 'notificacoes.msgAppointmentScheduled',
    'appointment scheduled': 'notificacoes.msgAppointmentScheduled',
    'consulta cancelada': 'notificacoes.msgAppointmentCancelled',
    'appointment cancelled': 'notificacoes.msgAppointmentCancelled',
    'appointment canceled': 'notificacoes.msgAppointmentCancelled',
    'dados do perfil alterados': 'notificacoes.msgProfileUpdated',
    'perfil atualizado': 'notificacoes.msgProfileUpdated',
    'profile updated': 'notificacoes.msgProfileUpdated',
    'foto de perfil atualizada': 'notificacoes.msgProfilePhotoUpdated',
    'profile photo updated': 'notificacoes.msgProfilePhotoUpdated'
  };

  let translatedTitle = title;
  const normalizedTitle = String(title || '').trim().toLowerCase();
  if (normalizedTitle && titleMap[normalizedTitle]) {
    translatedTitle = t(titleMap[normalizedTitle]);
  }

  let translatedDesc = description || '';
  if (description) {
    const patterns = [
      { regex: /^(.+?)\s+agendou uma consulta para\s+(.+)$/i, key: 'notificacoes.msgNewAppointmentDesc', map: m => ({ name: m[1].trim(), date: m[2].trim() }) },
      { regex: /^(.+?)\s+scheduled an appointment for\s+(.+)$/i, key: 'notificacoes.msgNewAppointmentDesc', map: m => ({ name: m[1].trim(), date: m[2].trim() }) },
      { regex: /^(.+?)\s+cancelou a consulta agendada para\s+(.+)$/i, key: 'notificacoes.msgCancelledByPatientDesc', map: m => ({ name: m[1].trim(), date: m[2].trim() }) },
      { regex: /^(.+?)\s+cancelled the appointment scheduled for\s+(.+)$/i, key: 'notificacoes.msgCancelledByPatientDesc', map: m => ({ name: m[1].trim(), date: m[2].trim() }) },
      { regex: /^Sua consulta com\s+(.+?)\s+foi agendada para\s+(.+)$/i, key: 'notificacoes.msgYourAppointmentScheduled', map: m => ({ doctor: m[1].trim(), date: m[2].trim() }) },
      { regex: /^Your appointment with\s+(.+?)\s+was scheduled for\s+(.+)$/i, key: 'notificacoes.msgYourAppointmentScheduled', map: m => ({ doctor: m[1].trim(), date: m[2].trim() }) }
    ];

    const matched = patterns.find(p => p.regex.test(description));
    if (matched) {
      const m = description.match(matched.regex);
      translatedDesc = t(matched.key, matched.map(m));
    } else {
      const cancelRegexPt = /^Sua consulta com\s+(.+?)\s+agendada para\s+(.+?)\s+foi cancelada(.*)$/i;
      const cancelRegexEn = /^Your appointment with\s+(.+?)\s+scheduled for\s+(.+?)\s+was cancelled(.*)$/i;
      const mCancel = description.match(cancelRegexPt) || description.match(cancelRegexEn);

      if (mCancel) {
        const reasonSuffix = (mCancel[3] || '').trim();
        const reasonMatch = reasonSuffix.match(/(?:Motivo|Reason):\s*(.+)$/i);
        const reasonText = reasonMatch ? reasonMatch[1].trim() : '';
        const reasonParam = reasonText ? t('notificacoes.msgCancelReason', { reason: reasonText }) : '';
        translatedDesc = t('notificacoes.msgYourAppointmentCancelled', {
          doctor: mCancel[1].trim(),
          date: mCancel[2].trim(),
          reason: reasonParam
        });
      } else if (titleMap[normalizedTitle] === 'notificacoes.msgProfilePhotoUpdated') {
        translatedDesc = t('notificacoes.msgProfilePhotoUpdatedDesc');
      } else if (titleMap[normalizedTitle] === 'notificacoes.msgProfileUpdated') {
        translatedDesc = t('notificacoes.msgProfileUpdatedDesc');
      }
    }
  }

  return { title: translatedTitle, description: translatedDesc };
}

function normalizeNotification(raw, fallbackIndex = 0) {
  if (!raw) return null;
  const id = raw.id || raw._id || raw.codigo || raw.docId || `ntf-${fallbackIndex}-${Date.now()}`;
  let createdAt = raw.createdAt || raw.criadoEm || raw.created || raw.timestamp;

  if (createdAt && typeof createdAt === 'object' && createdAt.seconds !== undefined) {
    createdAt = new Date(createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1e6).toISOString();
  } else if (typeof createdAt === 'number') {
    createdAt = new Date(createdAt).toISOString();
  } else if (typeof createdAt === 'string') {
    const parsedDate = new Date(createdAt);
    createdAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  } else {
    createdAt = new Date().toISOString();
  }

  const rawType = (raw.type || raw.tipo || '').toString().toLowerCase();
  const allowedTypes = ['alerta', 'appointments', 'updates', 'info'];
  let type = allowedTypes.includes(rawType) ? rawType : 'updates';
  
  if (rawType === 'critical' || rawType === 'críticas') {
    type = 'alerta';
  }
  
  if (rawType === 'appointment') {
    type = 'appointments';
  }
  
  if (raw.title && (raw.title.toLowerCase().includes('cancel') || raw.title.toLowerCase().includes('cancelado'))) {
    type = 'alerta';
  }
  
  if (raw.title && (raw.title.toLowerCase().includes('agendamento') || raw.title.toLowerCase().includes('consulta'))) {
    if (type !== 'alerta') {
      type = 'appointments';
    }
  }

  const unread = raw.unread !== undefined ? raw.unread : !(raw.lido ?? false);
  const archived = raw.archived !== undefined ? raw.archived : false;

  const rawTitle = raw.title || raw.titulo || '';
  const rawDesc = raw.description || raw.descricao || '';
  const rawAction = raw.action || raw.rotuloAcao || '';
  const { title: translatedTitle, description: translatedDesc } = translateNotificationContent(rawTitle, rawDesc);

  // Translate action label if it's the default PT text
  const actionLabel = (rawAction === 'Visualizar detalhes' || rawAction === 'View details') ? t('notificacoes.viewDetails') : (rawAction || t('notificacoes.viewDetails'));

  return {
    id,
    type,
    title: translatedTitle || rawTitle || t('notificacoes.notificationFallback'),
    description: translatedDesc || rawDesc,
    createdAt,
    link: raw.link || '#',
    action: actionLabel,
    unread: Boolean(unread),
    archived: Boolean(archived)
  };
}

function mergeNotifications(...sources) {
  const map = new Map();
  let fallbackIndex = 0;

  sources
    .flat()
    .filter(Boolean)
    .forEach(item => {
      const normalized = normalizeNotification(item, fallbackIndex++);
      if (normalized) {
        map.set(normalized.id, { ...map.get(normalized.id), ...normalized });
      }
    });

  return Array.from(map.values());
}

function loadNotifications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return mergeNotifications(parsed);
      }
    }
  } catch (error) {
    console.error('Erro ao carregar notificações da API:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: t('notificacoes.error'),
        text: t('notificacoes.errorLoadInfo'),
        confirmButtonColor: '#002A42'
      });
    }
  }
  return [];
}

function persistNotifications(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let notifications = [];

function renderSummary(list) {
  const activeList = list.filter(item => !item.archived);
  const archivedList = list.filter(item => item.archived);
  const pending = activeList.filter(item => item.unread).length;
  const alerta = activeList.filter(item => item.type === 'alerta' && item.unread).length;
  const archived = archivedList.length;

  const pendingEl = document.getElementById('summaryPending');
  const criticalEl = document.getElementById('summaryCritical');
  const archivedEl = document.getElementById('summaryArchived');
  
  if (pendingEl) pendingEl.textContent = pending.toString();
  if (criticalEl) criticalEl.textContent = alerta.toString();
  if (archivedEl) archivedEl.textContent = archived.toString();
}

function createCard(notification) {
  const card = document.createElement('article');
  card.className = `notification-card ${notification.type} ${notification.unread ? 'unread' : ''}`;
  card.dataset.type = notification.type;

  const createdAt = new Date(notification.createdAt);

  const alertaTag = notification.type === 'alerta' ? `<span class="notification-tag alerta-tag">${t('notificacoes.alertTag')}</span>` : '';
  
  const archivedBadge = notification.archived ? `<span class="archived-badge">${t('notificacoes.archivedBadge')}</span>` : '';

  card.innerHTML = `
    <header>
      <div>
        <div class="notification-title-wrapper">
        <h2>${notification.title}</h2>
          ${alertaTag}
          ${archivedBadge}
        </div>
        <p>${notification.description}</p>
      </div>
      <span class="timestamp">${formatRelativeTime(createdAt)}</span>
    </header>
    <footer>
      <button type="button" data-link="${notification.link}">${notification.action}</button>
      <button type="button" class="mark-read" data-id="${notification.id}">
        ${notification.unread ? t('notificacoes.markAsRead') : t('notificacoes.moveToPending')}
      </button>
      ${!notification.archived ? `
        <button type="button" class="archive-btn" data-id="${notification.id}" title="${t('notificacoes.archiveTitle')}">
          <i class="fas fa-archive"></i>
        </button>
      ` : `
        <button type="button" class="unarchive-btn" data-id="${notification.id}" title="${t('notificacoes.unarchiveTitle')}">
          <i class="fas fa-inbox"></i>
        </button>
      `}
      <button type="button" class="delete-btn" data-id="${notification.id}" title="${t('notificacoes.deleteTitle')}">
        <i class="fas fa-trash"></i>
      </button>
    </footer>
  `;

  return card;
}

function renderFeed(list) {
  const feed = document.getElementById('notificationsFeed');
  const emptyState = document.getElementById('notificationsEmpty');

  if (!feed) return;

  feed.innerHTML = '';

  if (!list || !list.length) {
    if (emptyState) {
    emptyState.hidden = false;
    }
    return;
  }

  if (emptyState) {
  emptyState.hidden = true;
  }

  list
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .forEach(notification => {
      const card = createCard(notification);
      feed.appendChild(card);
    });
}

function applyFilter(filter) {
  currentFilter = filter;
  let filtered = [...notifications];

  switch (filter) {
    case 'alerta':
      filtered = filtered.filter(item => item.type === 'alerta' && !item.archived);
      break;
    case 'appointments':
      filtered = filtered.filter(item => (item.type === 'appointments' || item.type === 'appointment') && !item.archived);
      break;
    case 'updates':
      filtered = filtered.filter(item => (item.type === 'updates' || item.type === 'update') && !item.archived);
      break;
    case 'today': {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(item => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= todayStart && !item.archived;
      });
      break;
    }
    case 'archived':
      filtered = filtered.filter(item => item.archived === true);
      break;
    case 'all':
    default:
      filtered = filtered.filter(item => !item.archived);
      break;
  }

  updateActiveFilters(filter);
  renderFeed(filtered);
  renderSummary(notifications);
}

function updateActiveFilters(activeFilter) {
  document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.summary-card').forEach(card => card.classList.remove('active'));
  
  const filterButton = document.querySelector(`.filter-chip[data-filter="${activeFilter}"]`);
  if (filterButton) {
    filterButton.classList.add('active');
  }
  
  const summaryCard = document.querySelector(`.summary-card[data-filter="${activeFilter}"]`);
  if (summaryCard) {
    summaryCard.classList.add('active');
  }
  
}

async function markAllAsRead() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) return;

    const endpoint = localStorage.getItem('token') 
      ? '/api/notificacoes/mark-all-read' 
      : '/api/notificacoes-paciente/mark-all-read';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      await synchronizeNotifications();
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
    }
  } catch (error) {
  }
}

async function archiveAll() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) return;

    const endpoint = localStorage.getItem('token') 
      ? '/api/notificacoes/archive-all' 
      : '/api/notificacoes-paciente/archive-all';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      await synchronizeNotifications();
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: t('notificacoes.success'),
          text: t('notificacoes.allArchivedSuccess'),
          confirmButtonColor: '#002A42'
        });
      }
    }
  } catch (error) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: t('notificacoes.error'),
        text: t('notificacoes.errorArchiveAll'),
        confirmButtonColor: '#002A42'
      });
    }
  }
}

async function deleteAll() {
  const result = await Swal.fire({
    title: t('notificacoes.deleteAllConfirm'),
    text: t('notificacoes.actionCannotBeUndone'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: t('notificacoes.confirmDeleteAll'),
    cancelButtonText: t('notificacoes.cancel')
  });

  if (!result.isConfirmed) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) return;

    const endpoint = localStorage.getItem('token') 
      ? '/api/notificacoes' 
      : '/api/notificacoes-paciente';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      notifications = [];
      persistNotifications(notifications);
      renderSummary(notifications);
      applyFilter('all');
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
      Swal.fire({
        icon: 'success',
        title: t('notificacoes.success'),
        text: t('notificacoes.allDeletedSuccess'),
        confirmButtonColor: '#002A42'
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: t('notificacoes.error'),
      text: t('notificacoes.errorDeleteAll'),
      confirmButtonColor: '#002A42'
    });
  }
}

async function archiveNotification(id) {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) {
      return;
    }

    if (!id) {
      return;
    }

    const endpoint = localStorage.getItem('token') 
      ? `/api/notificacoes/${id}/archive` 
      : `/api/notificacoes-paciente/${id}/archive`;


    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      const itemIndex = notifications.findIndex(n => n.id === id || n._id === id);
      if (itemIndex !== -1) {
        notifications[itemIndex].archived = true;
        persistNotifications(notifications);
      }
      
      renderSummary(notifications);
      applyFilter(currentFilter);
      
      await synchronizeNotifications();
      
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: t('notificacoes.success'),
          text: t('notificacoes.archivedSuccess'),
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: t('notificacoes.error'),
          text: errorData.message || t('notificacoes.errorArchiveOne'),
          confirmButtonColor: '#002A42'
        });
      }
    }
  } catch (error) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: t('notificacoes.error'),
        text: t('notificacoes.errorArchiveOne'),
        confirmButtonColor: '#002A42'
      });
    }
  }
}

async function unarchiveNotification(id) {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) {
      return;
    }

    if (!id) {
      return;
    }

    const endpoint = localStorage.getItem('token') 
      ? `/api/notificacoes/${id}/unarchive` 
      : `/api/notificacoes-paciente/${id}/unarchive`;


    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      const itemIndex = notifications.findIndex(n => n.id === id || n._id === id);
      if (itemIndex !== -1) {
        notifications[itemIndex].archived = false;
        persistNotifications(notifications);
      }
      
      renderSummary(notifications);
      applyFilter(currentFilter);
      
      await synchronizeNotifications();
      
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: t('notificacoes.success'),
          text: t('notificacoes.unarchivedSuccess'),
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: t('notificacoes.error'),
          text: errorData.message || t('notificacoes.errorUnarchiveOne'),
          confirmButtonColor: '#002A42'
        });
      }
    }
  } catch (error) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: t('notificacoes.error'),
        text: t('notificacoes.errorUnarchiveOne'),
        confirmButtonColor: '#002A42'
      });
    }
  }
}

async function deleteNotification(id) {
  const result = await Swal.fire({
    title: t('notificacoes.deleteConfirm'),
    text: t('notificacoes.actionCannotBeUndone'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: t('notificacoes.confirmDelete'),
    cancelButtonText: t('notificacoes.cancel')
  });

  if (!result.isConfirmed) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) return;

    const endpoint = localStorage.getItem('token') 
      ? `/api/notificacoes/${id}` 
      : `/api/notificacoes-paciente/${id}`;

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      notifications = notifications.filter(n => n.id !== id);
  persistNotifications(notifications);
  renderSummary(notifications);
  applyFilter(currentFilter);
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
      }
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: t('notificacoes.error'),
      text: t('notificacoes.errorDeleteOne'),
      confirmButtonColor: '#002A42'
    });
  }
}

function clearAll() {
  deleteAll();
}

async function fetchNotificationsFromApi(includeArchived = false) {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
    if (!token) {
      return [];
    }
    
    const endpoint = localStorage.getItem('token') 
      ? '/api/notificacoes' 
      : '/api/notificacoes-paciente';
    
    let url = `${API_URL}${endpoint}`;
    if (includeArchived) {
      url += '?archived=true';
    }
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      if (response.status === 401) {
        return [];
      }
      throw new Error(`Falha ao carregar notificações: ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
  }
  return [];
}

async function fetchNotificationsFromFirestore() {
      return [];
}

async function synchronizeNotifications() {
  try {
    const apiDataActive = await fetchNotificationsFromApi(false);
    const apiDataArchived = await fetchNotificationsFromApi(true);
    const firestoreData = await fetchNotificationsFromFirestore();

    const allApiData = [...apiDataActive, ...apiDataArchived];
  const localData = loadNotifications();
    const merged = mergeNotifications(localData, allApiData, firestoreData);

  notifications = merged;

  if (!notifications.length) {
    persistNotifications([]);
  } else {
    persistNotifications(notifications);
  }

  renderSummary(notifications);
  applyFilter(currentFilter);
  } catch (error) {
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await synchronizeNotifications();
  
  renderSummary(notifications);
  applyFilter('all');

  document.querySelectorAll('.filter-chip').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = button.dataset.filter || 'all';
      applyFilter(filter);
    });
  });

  document.querySelectorAll('.summary-card[data-filter]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = card.dataset.filter || 'all';
      applyFilter(filter);
    });
  });

  const markAllBtn = document.querySelector('.hero-btn[data-action="mark-all"]');
  const archiveAllBtn = document.querySelector('.hero-btn[data-action="archive-all"]');
  const deleteAllBtn = document.querySelector('.hero-btn[data-action="delete-all"]');

  if (markAllBtn) {
    markAllBtn.addEventListener('click', markAllAsRead);
  }

  if (archiveAllBtn) {
    archiveAllBtn.addEventListener('click', archiveAll);
  }

  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', deleteAll);
  }

  const feed = document.getElementById('notificationsFeed');
  if (!feed) {
    return;
  }

  feed.addEventListener('click', event => {
    const target = event.target;
    const clickedButton = target.closest('button');
    
    if (!clickedButton) return;
    
    const actionLink = clickedButton.closest('button[data-link]');
    const markButton = clickedButton.classList.contains('mark-read') ? clickedButton : clickedButton.closest('button.mark-read');
    const archiveBtn = clickedButton.classList.contains('archive-btn') ? clickedButton : clickedButton.closest('button.archive-btn');
    const unarchiveBtn = clickedButton.classList.contains('unarchive-btn') ? clickedButton : clickedButton.closest('button.unarchive-btn');
    const deleteBtn = clickedButton.classList.contains('delete-btn') ? clickedButton : clickedButton.closest('button.delete-btn');

    if (actionLink) {
      let destination = actionLink.getAttribute('data-link');
      if (destination && destination !== '#') {
        if (destination.startsWith('/agendamentos/') || destination.startsWith('/appointments/')) {
          destination = '/client/views/agendamentos.html';
        }
        window.location.href = destination;
      }
      return;
    }

    if (markButton) {
      const notificationId = markButton.dataset.id;
      const itemIndex = notifications.findIndex(notification => notification.id === notificationId);
      if (itemIndex !== -1) {
        const newUnreadStatus = !notifications[itemIndex].unread;
        notifications[itemIndex].unread = newUnreadStatus;
        persistNotifications(notifications);
        renderSummary(notifications);
        applyFilter(currentFilter);
        
        const token = localStorage.getItem('token') || localStorage.getItem('tokenPaciente');
        if (token) {
          const endpoint = localStorage.getItem('token') 
            ? `/api/notificacoes/${notificationId}/read` 
            : `/api/notificacoes-paciente/${notificationId}/read`;
          
          fetch(`${API_URL}${endpoint}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ unread: newUnreadStatus })
          }).catch(error => {
          });
        }
        
        if (window.updateNotificationBadge) {
          window.updateNotificationBadge();
        }
      }
      return;
    }

    if (archiveBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = archiveBtn.getAttribute('data-id');
      if (id) {
        archiveNotification(id);
      } else {
        console.warn('ID da notificação ausente para arquivar.');
      }
      return;
    }

    if (unarchiveBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = unarchiveBtn.getAttribute('data-id');
      if (id) {
        unarchiveNotification(id);
      } else {
        console.warn('ID da notificação ausente para desarquivar.');
      }
      return;
    }

    if (deleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      if (id) {
        deleteNotification(id);
      } else {
        console.warn('ID da notificação ausente para excluir.');
      }
      return;
    }
  });
});

