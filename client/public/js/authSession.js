import { API_URL } from './config.js';

let refreshInFlight = null;

export function getDoctorToken() {
  return localStorage.getItem('token');
}

export function getPatientToken() {
  return localStorage.getItem('tokenPaciente');
}

export function getAccessToken() {
  return getDoctorToken() || getPatientToken();
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenPaciente');
}

export async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  const currentRefreshToken = localStorage.getItem('refreshToken');
  if (!currentRefreshToken) {
    clearAuthSession();
    throw new Error('Sessão expirada');
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken })
    });

    if (!response.ok) {
      clearAuthSession();
      throw new Error('Falha ao renovar sessão');
    }

    const data = await response.json();
    if (!data.token || !data.refreshToken) {
      clearAuthSession();
      throw new Error('Resposta inválida de renovação de sessão');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.token;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetchWithAuth(url, options = {}) {
  const token = getAccessToken();
  if (!token) return fetch(url, options);

  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  let response = await fetch(url, { ...options, headers });

  // Renovação automática somente para sessão de médico (tem refresh token).
  if (response.status === 401 && getDoctorToken() && localStorage.getItem('refreshToken')) {
    const newToken = await refreshAccessToken();
    const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${newToken}` };
    response = await fetch(url, { ...options, headers: retryHeaders });
  }

  return response;
}
