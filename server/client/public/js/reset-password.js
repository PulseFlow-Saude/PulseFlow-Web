document.addEventListener("DOMContentLoaded", () => {
    const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (key, opts) => opts?.fallback ?? key;
    const form = document.getElementById("resetPasswordForm");
    const emailInput = document.getElementById("email");
    const emailError = document.getElementById("emailError");
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      // Limpa mensagens anteriores
      emailError.textContent = "";
  
      const email = emailInput.value.trim();
      let hasError = false;
  
      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        emailError.textContent = t("resetPassword.errEmailInvalid", { fallback: "Email inválido." });
        hasError = true;
      }
  
      if (hasError) return;
  
      const data = { email };
  
      try {
        const response = await fetch("http://localhost:65432/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          Swal.fire({
            title: t("resetPassword.swalEmailSentTitle", { fallback: 'Email Enviado!' }),
            text: t("resetPassword.swalEmailSentText", { fallback: 'Verifique seu e-mail para redefinir a senha.' }),
            icon: 'success',
            confirmButtonText: t("resetPassword.swalOk", { fallback: 'OK' }),
            confirmButtonColor: '#00324A',
            background: '#FFFFFF',
            customClass: {
              title: 'swal-title-custom',
              content: 'swal-content-custom',
              confirmButton: 'swal-button-custom'
            }
          }).then(() => {
            window.location.href = "/client/views/login.html";
          });
        } else {
          Swal.fire({
            title: t("resetPassword.swalErrorTitle", { fallback: 'Erro' }),
            text: result.message || t("resetPassword.swalErrorReset", { fallback: 'Erro ao enviar link de redefinição' }),
            icon: 'error',
            confirmButtonText: t("resetPassword.swalOk", { fallback: 'OK' }),
            confirmButtonColor: '#00324A',
            background: '#FFFFFF'
          });
        }
      } catch (err) {
        Swal.fire({
          title: t("resetPassword.swalErrorTitle", { fallback: 'Erro' }),
          text: t("resetPassword.swalErrorRequest", { fallback: 'Erro na requisição' }),
          icon: 'error',
          confirmButtonText: t("resetPassword.swalOk", { fallback: 'OK' }),
          confirmButtonColor: '#00324A',
          background: '#FFFFFF'
        });
        console.error(err);
      }
    });
  });
  