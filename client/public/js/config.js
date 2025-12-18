// Configuração da API - detecta automaticamente a URL baseada no hostname
const getApiUrl = () => {
  if (window.API_URL) {
    return window.API_URL;
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Se estiver no Render (pulseflow-web.onrender.com)
  if (hostname.includes('onrender.com')) {
    return `${protocol}//${hostname}`;
  }
  
  // Se estiver em localhost, usar a porta padrão
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:65432';
  }
  
  // Para outros ambientes, usar o mesmo hostname e protocolo
  return `${protocol}//${hostname}`;
};

export const API_URL = getApiUrl();
export const RESET_PASSWORD_URL = `${API_URL}/reset-password`;