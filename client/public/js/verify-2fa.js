import { API_URL } from './config.js';
import { t, getLanguage } from './i18n.js';

function showUserMessage(msg, type = 'info') {
  const mensagemTexto = document.getElementById('mensagemTexto');
  const mensagemIcone = document.getElementById('mensagemIcone');
  const mensagemGeral = document.getElementById('user-message');
  
  mensagemTexto.textContent = msg;
  mensagemGeral.className = `mensagem-geral ${type}`;
  mensagemIcone.className = type === "sucesso" ? "fas fa-check-circle" : "fas fa-exclamation-triangle";
  mensagemGeral.style.display = "flex";
  mensagemGeral.setAttribute("role", "alert");
  mensagemGeral.setAttribute("aria-live", "polite");

  setTimeout(() => {
    mensagemGeral.style.display = "none";
  }, 4000);
}

function clearUserMessage() {
  const mensagemGeral = document.getElementById('user-message');
  mensagemGeral.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('verifyForm');
  const otpInput = document.getElementById('otpInput');
  const verifyBtn = document.getElementById('verifyBtn');
  const resendBtn = document.getElementById('resendBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const cancelModal = document.getElementById('cancel-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel');
  const closeModalBtn = document.getElementById('close-modal');

  // Auto-focus no campo OTP
  otpInput.focus();

  // Formatação automática do campo OTP
  otpInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    if (value.length > 6) value = value.slice(0, 6);
    e.target.value = value;
  });

  // Submit do formulário
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otp = otpInput.value.trim();
    const errorMessage = document.getElementById('error-message');
    clearUserMessage();

    // Limpa mensagens de erro
    errorMessage.textContent = '';

    // Validação de entrada
    if (otp.length !== 6 || isNaN(otp)) {
      errorMessage.textContent = t('verify2fa.errInvalidCode');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      showUserMessage(t('verify2fa.errSessionExpired'), 'erro');
      setTimeout(() => window.location.href = '/client/views/login.html', 2000);
      return;
    }

    // Ativa carregamento no botão
    verifyBtn.disabled = true;
    const buttonText = verifyBtn.querySelector('span');
    const buttonIcon = verifyBtn.querySelector('i');
    
    buttonText.textContent = t('verify2fa.btnVerifying');
    buttonIcon.className = 'fas fa-spinner fa-spin';

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: otp }),
      });

      const data = await response.json();
      
      if (response.ok && data.token) {
        localStorage.setItem('token', data.token);
        
        // Verificar status de validação do cadastro para redirecionar
        const profileRes = await fetch(`${API_URL}/api/usuarios/perfil`, {
          headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (profileRes.ok) {
          const perfil = await profileRes.json();
          localStorage.setItem('validationStatus', perfil.validationStatus || 'pending_complement');
          localStorage.setItem('hasChosenPlan', perfil.hasChosenPlan ? 'true' : 'false');
          if (perfil.role === 'admin' || perfil.isAdmin === true) {
            localStorage.setItem('isAdmin', 'true');
            window.location.href = '/client/views/painel-admin.html';
            return;
          }
          if (perfil.validationStatus !== 'approved') {
            Swal.fire({
              title: t('verify2fa.swalSuccess'),
              text: t('validacao.concluaCadastro', { fallback: 'Conclua o cadastro e envie os documentos para liberar o acesso completo.' }),
              icon: 'success',
              confirmButtonText: t('verify2fa.swalOk'),
              confirmButtonColor: '#00324A',
              background: '#FFFFFF',
              customClass: {
                title: 'swal-title-custom',
                content: 'swal-content-custom',
                confirmButton: 'swal-button-custom'
              }
            }).then(() => {
              window.location.href = '/client/views/perfilMedico.html';
            });
            return;
          }
          if (!perfil.hasChosenPlan) {
            Swal.fire({
              title: t('verify2fa.swalSuccess'),
              text: t('verify2fa.swalVerifySuccess'),
              icon: 'success',
              confirmButtonText: t('verify2fa.swalOk'),
              confirmButtonColor: '#00324A',
              background: '#FFFFFF',
              customClass: {
                title: 'swal-title-custom',
                content: 'swal-content-custom',
                confirmButton: 'swal-button-custom'
              }
            }).then(() => {
              window.location.href = '/client/views/escolhaPlano.html';
            });
            return;
          }
        }

        if (typeof window.onDoctorLogin === 'function') {
          window.onDoctorLogin();
        }

        Swal.fire({
          title: t('verify2fa.swalSuccess'),
          text: t('verify2fa.swalVerifySuccess'),
          icon: 'success',
          confirmButtonText: t('verify2fa.swalOk'),
          confirmButtonColor: '#00324A',
          background: '#FFFFFF',
          customClass: {
            title: 'swal-title-custom',
            content: 'swal-content-custom',
            confirmButton: 'swal-button-custom'
          }
        }).then(() => {
          window.location.href = '/client/views/selecao.html';
        });
      } else {
        Swal.fire({
          title: t('verify2fa.swalError'),
          text: data.message || t('verify2fa.swalCodeInvalid'),
          icon: 'error',
          confirmButtonText: t('verify2fa.swalOk'),
          confirmButtonColor: '#00324A',
          background: '#FFFFFF'
        });
      }
    } catch (err) {
      Swal.fire({
        title: t('verify2fa.swalError'),
        text: t('verify2fa.swalVerifyError'),
        icon: 'error',
        confirmButtonText: t('verify2fa.swalOk'),
        confirmButtonColor: '#00324A',
        background: '#FFFFFF'
      });
      console.error('Erro ao verificar o código:', err);
    } finally {
      // Restaura botão
      verifyBtn.disabled = false;
      buttonText.textContent = t('verify2fa.btnVerify');
      buttonIcon.className = 'fas fa-check-circle';
    }
  });

  // Modal de confirmação ao cancelar
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    cancelModal.style.display = 'flex';
  });

  confirmCancelBtn.addEventListener('click', () => {
    window.location.href = '/client/views/login.html';
  });

  closeModalBtn.addEventListener('click', () => {
    cancelModal.style.display = 'none';
  });

  // Fechar modal clicando fora
  cancelModal.addEventListener('click', (e) => {
    if (e.target === cancelModal) {
      cancelModal.style.display = 'none';
    }
  });

  // Reenviar código
  resendBtn.addEventListener('click', async () => {
    const userId = localStorage.getItem('userId');
    const email = localStorage.getItem('email');
    
    if (!userId || !email) {
      showUserMessage(t('verify2fa.errSessionExpired'), 'erro');
      setTimeout(() => window.location.href = '/client/views/login.html', 2000);
      return;
    }

    resendBtn.disabled = true;
    const buttonText = resendBtn.querySelector('span');
    const buttonIcon = resendBtn.querySelector('i');
    
    buttonText.textContent = t('verify2fa.btnResending');
    buttonIcon.className = 'fas fa-spinner fa-spin';

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: getLanguage() }),
      });

      const data = await response.json();
      
      if (response.ok) {
        Swal.fire({
          title: t('verify2fa.swalSuccess'),
          text: t('verify2fa.swalResendSuccess'),
          icon: 'success',
          confirmButtonText: t('verify2fa.swalOk'),
          confirmButtonColor: '#00324A',
          background: '#FFFFFF'
        });
      } else {
        Swal.fire({
          title: t('verify2fa.swalError'),
          text: data.message || t('verify2fa.swalResendError'),
          icon: 'error',
          confirmButtonText: t('verify2fa.swalOk'),
          confirmButtonColor: '#00324A',
          background: '#FFFFFF'
        });
      }
    } catch (err) {
      Swal.fire({
        title: t('verify2fa.swalError'),
        text: t('verify2fa.swalResendTryAgain'),
        icon: 'error',
        confirmButtonText: t('verify2fa.swalOk'),
        confirmButtonColor: '#00324A',
        background: '#FFFFFF'
      });
      console.error('Erro ao reenviar código:', err);
    } finally {
      resendBtn.disabled = false;
      buttonText.textContent = t('verify2fa.btnResend');
      buttonIcon.className = 'fas fa-sync-alt';
    }
  });
});