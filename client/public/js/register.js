// Função global para mostrar mensagem de erro
function showError(field, message) {
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (k, o) => o?.fallback ?? k;
  const swalPromise = Swal.fire({
    icon: 'error',
    title: t('register.swalAttention', { fallback: 'Atenção' }),
    text: message,
    confirmButtonText: t('register.swalGotIt', { fallback: 'Entendi' }),
    timer: 8000,
    timerProgressBar: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      popup: 'custom-swal-popup',
      title: 'custom-swal-title',
      content: 'custom-swal-content'
    }
  });
  
  if (field && field.classList) {
    field.classList.add("input-error");
    const errorSpan = document.getElementById(`${field.id}Error`);
    if (errorSpan) {
      errorSpan.textContent = message;
      setTimeout(() => {
        errorSpan.textContent = "";
        field.classList.remove("input-error");
      }, 8000);
    }
  }
  
  return swalPromise;
}

// Função global para limpar erro
function clearError(field) {
  if (field && field.classList) {
    field.classList.remove("input-error");
    const errorSpan = document.getElementById(`${field.id}Error`);
    if (errorSpan) errorSpan.textContent = "";
  }
}

console.log('Script de registro carregado');

document.addEventListener("DOMContentLoaded", () => {
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (key, opts) => opts?.fallback ?? key;
  const form = document.getElementById("registerForm");
  console.log('Form encontrado:', form);

  if (!form) {
    console.error('Formulário não encontrado!');
    return;
  }

  const submitBtn = form.querySelector("button[type='submit']");

  // Preencher especialidades médicas
  const areaSelect = document.getElementById("areaAtuacao");
  const selectSpecialtyText = t('register.selectSpecialty', { fallback: 'Selecione sua especialidade' });
  const especialidades = [
    selectSpecialtyText, "Acupuntura", "Alergia e Imunologia", "Anestesiologia", "Angiologia",
    "Cardiologia", "Cirurgia Cardiovascular", "Cirurgia da Mão", "Cirurgia de Cabeça e Pescoço",
    "Cirurgia do Aparelho Digestivo", "Cirurgia Geral", "Cirurgia Oncológica", "Cirurgia Pediátrica",
    "Cirurgia Plástica", "Cirurgia Torácica", "Cirurgia Vascular", "Clínica Médica",
    "Coloproctologia", "Dermatologia", "Endocrinologia e Metabologia", "Endoscopia",
    "Gastroenterologia", "Genética Médica", "Geriatria", "Ginecologia e Obstetrícia",
    "Hematologia e Hemoterapia", "Homeopatia", "Infectologia", "Mastologia",
    "Medicina de Emergência", "Medicina de Família e Comunidade", "Medicina do Trabalho",
    "Medicina do Tráfego", "Medicina Esportiva", "Medicina Física e Reabilitação",
    "Medicina Intensiva", "Medicina Legal e Perícia Médica", "Medicina Nuclear",
    "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia", "Neurologia",
    "Nutrologia", "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia",
    "Otorrinolaringologia", "Patologia", "Patologia Clínica/Medicina Laboratorial",
    "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e Diagnóstico por Imagem",
    "Radioterapia", "Reumatologia", "Urologia", "Outros"
  ];
  especialidades.forEach((nome) => {
    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    areaSelect.appendChild(option);
  });

  // Mostrar/ocultar campo de outra especialidade
  const outraEspecialidadeRow = document.getElementById("outraEspecialidadeRow");
  const outraEspecialidadeInput = document.getElementById("outraEspecialidade");
  
  areaSelect.addEventListener("change", function() {
    if (this.value === "Outros") {
      outraEspecialidadeRow.style.display = "flex";
      outraEspecialidadeInput.required = true;
    } else {
      outraEspecialidadeRow.style.display = "none";
      outraEspecialidadeInput.required = false;
      outraEspecialidadeInput.value = "";
    }
  });

  const maskCPF = (input) => {
    input.addEventListener("input", (e) => {
      e.preventDefault();
      let value = input.value.replace(/\D/g, "").slice(0, 11);
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      input.value = value;
    });
  };

  const maskPhone = (input) => {
    input.addEventListener("input", (e) => {
      e.preventDefault();
      let value = input.value.replace(/\D/g, "").slice(0, 11);
      value = value.length <= 10
        ? value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3")
        : value.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
      input.value = value.trim().replace(/[-\s]+$/, "");
    });
  };

  const maskCRM = (input) => {
    input.addEventListener("input", (e) => {
      e.preventDefault();
      let value = input.value.replace(/\W/g, "").toUpperCase().slice(0, 15);
      input.value = value;
    });
  };

  // Aplicar máscaras
  maskCPF(form.cpf);
  maskPhone(form.telefonePessoal);
  maskPhone(form.telefoneConsultorio);
  maskCRM(form.crm);

  // Máscaras de input
  const cpfInput = document.getElementById("cpf");
  const telefonePessoalInput = document.getElementById("telefonePessoal");
  const telefoneConsultorioInput = document.getElementById("telefoneConsultorio");
  const crmInput = document.getElementById("crm");
  const cepInput = document.getElementById("cep");
  const passwordInput = document.getElementById("senha");
  const passwordToggle = document.querySelector(".password-toggle");
  const strengthBar = document.getElementById("passwordStrengthBar");

  // Aplicar máscaras
  IMask(cpfInput, { mask: "000.000.000-00" });
  IMask(telefonePessoalInput, { mask: "(00) 00000-0000" });
  IMask(telefoneConsultorioInput, { mask: "(00) 0000-0000" });
  IMask(crmInput, {
    mask: [
      {
        mask: '00000-AA',
        prepare: function(str) {
          return str.toUpperCase();
        },
        definitions: {
          'A': {
            mask: /[A-Z]/
          }
        }
      }
    ]
  });
  IMask(cepInput, { mask: "00000-000" });

  // Toggle de visibilidade da senha
  passwordToggle.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    passwordToggle.classList.toggle("fa-eye");
    passwordToggle.classList.toggle("fa-eye-slash");
  });

  // Validação de força da senha
  function updatePasswordStrength(password) {
    let strength = 0;
    const criteria = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password)
    };

    // Calcular força baseada nos critérios
    if (criteria.length) strength += 25;
    if (criteria.lowercase) strength += 25;
    if (criteria.uppercase) strength += 25;
    if (criteria.number) strength += 25;

    // Atualizar a barra de força
    if (strengthBar) {
      strengthBar.style.width = strength + "%";
      
      // Atualizar a cor da barra
      if (strength <= 25) {
        strengthBar.style.backgroundColor = "#dc3545"; // Vermelho
      } else if (strength <= 50) {
        strengthBar.style.backgroundColor = "#ffc107"; // Amarelo
      } else if (strength <= 75) {
        strengthBar.style.backgroundColor = "#28a745"; // Verde
      } else {
        strengthBar.style.backgroundColor = "#198754"; // Verde escuro
      }

      // Atualizar o texto de força
      const strengthText = document.getElementById("passwordStrengthText");
      const st = typeof window.pulseflowT === 'function' ? window.pulseflowT : (k, o) => o?.fallback ?? k;
      if (strengthText) {
        if (strength <= 25) {
          strengthText.textContent = st('register.strengthWeak', { fallback: "Fraca" });
          strengthText.style.color = "#dc3545";
        } else if (strength <= 50) {
          strengthText.textContent = st('register.strengthMedium', { fallback: "Média" });
          strengthText.style.color = "#ffc107";
        } else if (strength <= 75) {
          strengthText.textContent = st('register.strengthStrong', { fallback: "Forte" });
          strengthText.style.color = "#28a745";
        } else {
          strengthText.textContent = st('register.strengthVeryStrong', { fallback: "Muito Forte" });
          strengthText.style.color = "#198754";
        }
      }
    }
  }

  // Adicionar evento de input para a senha
  if (passwordInput) {
    passwordInput.addEventListener("input", function() {
      updatePasswordStrength(this.value);
    });
    
    // Inicializar a força da senha
    updatePasswordStrength(passwordInput.value);
  }

  // Aplicar máscara ao campo RQE
  const rqeInput = document.getElementById("rqe1");
  if (rqeInput) {
    IMask(rqeInput, {
      mask: '000000',
      maxLength: 6,
      prepare: function(str) {
        return str.replace(/[^\d]/g, '');
      }
    });
  }

  // Busca de CEP
  const enderecoInput = document.getElementById("enderecoConsultorio");
  const numeroInput = document.getElementById("numeroConsultorio");

  cepInput.addEventListener("blur", async () => {
    const cep = cepInput.value.replace(/\D/g, "");
    
    if (cep.length !== 8) {
      await Swal.fire({
        title: t("register.swalCepInvalid", { fallback: "CEP Inválido" }),
        text: t("register.swalCepInvalidText", { fallback: "Por favor, insira um CEP válido" }),
        icon: "warning",
        confirmButtonText: t("register.swalOk", { fallback: "OK" }),
        confirmButtonColor: "#003366"
      });
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error("CEP não encontrado");
      }

      enderecoInput.value = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      numeroInput.focus();
    } catch (error) {
      await Swal.fire({
        title: t("register.swalCepError", { fallback: "Erro ao Buscar CEP" }),
        text: t("register.swalCepNotFound", { fallback: "Não foi possível encontrar o endereço para este CEP" }),
        icon: "error",
        confirmButtonText: t("register.swalOk", { fallback: "OK" }),
        confirmButtonColor: "#003366"
      });
      enderecoInput.value = "";
    }
  });

  // Variáveis globais para controle dos passos
  let currentStep = 0;
  const steps = document.querySelectorAll('.form-step');
  const progressSteps = document.querySelectorAll('.progress-step');

  // Função para mostrar o passo atual
  function showStep(index) {
    console.log('Mostrando passo:', index);
    steps.forEach((step, i) => {
      if (i === index) {
        step.classList.add('active');
        progressSteps[i].classList.add('active');
      } else {
        step.classList.remove('active');
        progressSteps[i].classList.remove('active');
      }
    });
  }

  // Função para validar o passo atual
  function validateStep(stepIndex) {
    console.log('Validando passo:', stepIndex);
    const currentStepElement = document.querySelector(`.step-${stepIndex + 1}`);
    if (!currentStepElement) {
      console.error('Elemento do passo não encontrado:', stepIndex);
      return false;
    }

    // Etapa 1: Pessoais
    if (stepIndex === 0) {
      const nome = document.getElementById('nome');
      const cpf = document.getElementById('cpf');
      const telefone = document.getElementById('telefonePessoal');
      const email = document.getElementById('email');
      const senha = document.getElementById('senha');
      const genero = document.getElementById('genero');

      if (!nome || !cpf || !telefone || !email || !senha || !genero) {
        console.error('Campos não encontrados na etapa 1');
        return false;
      }

      if (!nome.value.trim()) {
        showError(nome, t('register.errName'));
        nome.focus();
        return false;
      }
      if (!cpf.value.trim() || !validarCPF(cpf.value)) {
        showError(cpf, t('register.errCPF'));
        cpf.focus();
        return false;
      }
      if (!telefone.value.trim()) {
        showError(telefone, t('register.errPhone'));
        telefone.focus();
        return false;
      }
      if (!email.value.trim() || !validarEmail(email.value)) {
        showError(email, t('register.errEmail'));
        email.focus();
        return false;
      }
      if (!senha.value.trim() || senha.value.length < 8) {
        showError(senha, t('register.errPassword'));
        senha.focus();
        return false;
      }
      if (!genero.value) {
        showError(genero, t('register.errGender'));
        genero.focus();
        return false;
      }
    }

    // Etapa 2: Profissionais
    if (stepIndex === 1) {
      const crm = document.getElementById('crm');
      const area = document.getElementById('areaAtuacao');
      const rqe = document.getElementById('rqe1');
      const outraEspecialidade = document.getElementById('outraEspecialidade');

      if (!crm || !area || !rqe) {
        console.error('Campos não encontrados na etapa 2');
        return false;
      }

      if (!crm.value.trim()) {
        showError(crm, t('register.errCRM'));
        crm.focus();
        return false;
      }
      if (!area.value || area.value === selectSpecialtyText || area.value === 'Selecione a sua Especialidade') {
        showError(area, t('register.errSpecialty'));
        area.focus();
        return false;
      }
      if (area.value === 'Outros') {
        if (!outraEspecialidade || !outraEspecialidade.value.trim()) {
          showError(outraEspecialidade, t('register.errOtherSpecialty'));
          outraEspecialidade?.focus();
          return false;
        }
      }
      if (!rqe.value.trim()) {
        showError(rqe, t('register.errRQE'));
        rqe.focus();
        return false;
      }
    }

    // Etapa 3: Consultório
    if (stepIndex === 2) {
      const cep = document.getElementById('cep');
      const endereco = document.getElementById('enderecoConsultorio');
      const numero = document.getElementById('numeroConsultorio');
      const telefone = document.getElementById('telefoneConsultorio');
      const termos = document.getElementById('termsAccept');

      if (!cep || !endereco || !numero || !telefone) {
        console.error('Campos não encontrados na etapa 3');
        return false;
      }

      if (!cep.value.trim() || cep.value.replace(/\D/g, '').length !== 8) {
        showError(cep, t('register.errCEP'));
        cep.focus();
        return false;
      }
      if (!endereco.value.trim()) {
        showError(endereco, t('register.errAddress'));
        endereco.focus();
        return false;
      }
      if (!numero.value.trim()) {
        showError(numero, t('register.errNumber'));
        numero.focus();
        return false;
      }
      if (!telefone.value.trim()) {
        showError(telefone, t('register.errOfficePhone'));
        telefone.focus();
        return false;
      }
      if (termos && !termos.checked) {
        showError(termos, t('register.errTerms'));
        termos.focus();
        return false;
      }
    }

    return true;
  }

  // Event listeners para os botões de navegação
  const nextButtons = document.querySelectorAll('.next-btn');
  const prevButtons = document.querySelectorAll('.prev-btn');

  console.log('Botões encontrados:', {
    next: nextButtons.length,
    prev: prevButtons.length
  });

  nextButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Botão próximo clicado, passo atual:', currentStep);
      
      if (validateStep(currentStep)) {
        console.log('Validação passou, avançando para o próximo passo');
        currentStep++;
        if (currentStep >= steps.length) {
          currentStep = steps.length - 1;
        }
        showStep(currentStep);
      } else {
        console.log('Validação falhou');
      }
    });
  });

  prevButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Botão voltar clicado, passo atual:', currentStep);
      
      currentStep--;
      if (currentStep < 0) {
        currentStep = 0;
      }
      showStep(currentStep);
    });
  });

  // Mostrar o primeiro passo ao carregar a página
  showStep(0);

  // Função para validar o formulário
  function validateForm() {
    const activeStep = document.querySelector('.form-step.active');
    if (!activeStep) {
        console.error('Nenhum passo ativo encontrado');
        return false;
    }

    const stepNumber = parseInt(activeStep.classList[1].replace('step-', ''));
    return validateStep(stepNumber - 1);
  }

  // Função para mostrar mensagem de sucesso
  function showSuccess(message) {
    Swal.fire({
      icon: 'success',
      title: t('register.swalSuccess'),
      html: `
        <div style="text-align: center;">
          <p style="margin-bottom: 15px; font-size: 1.1em;">${message}</p>
          <div style="margin: 20px 0;">
            <i class="fas fa-envelope" style="font-size: 2em; color: #0D6EFD; margin-bottom: 10px;"></i>
            <p style="color: #666; font-size: 0.9em;">${t('register.swalCheckEmail')}</p>
          </div>
          <p style="color: #666; font-size: 0.9em; margin-top: 20px;">${t('register.swalRedirecting')}</p>
        </div>
      `,
      confirmButtonText: t('register.swalGoLogin'),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: true,
      timer: 5000,
      timerProgressBar: true,
      didOpen: (popup) => {
        popup.style.opacity = '0';
        setTimeout(() => {
          popup.style.transition = 'opacity 0.5s ease-in-out';
          popup.style.opacity = '1';
        }, 100);
      },
      willClose: (popup) => {
        popup.style.transition = 'opacity 0.5s ease-in-out';
        popup.style.opacity = '0';
      },
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title',
        content: 'custom-swal-content',
        confirmButton: 'custom-swal-confirm-button',
        timerProgressBar: 'custom-swal-timer-progress'
      }
    }).then((result) => {
      // Redireciona para a página de login
      window.location.href = '/client/views/login.html';
    });
  }

  // Função para processar o formulário
  async function processForm(formData) {
    try {
      // Mostrar loading por mais tempo
      Swal.fire({
        title: t('register.swalProcessing'),
        html: `
          <div style="text-align: center;">
            <p style="margin-bottom: 15px;">${t('register.swalProcessingText')}</p>
            <p style="color: #666; font-size: 0.9em;">${t('register.swalProcessingSub')}</p>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
        customClass: {
          popup: 'custom-swal-popup',
          title: 'custom-swal-title',
          content: 'custom-swal-content'
        }
      });

      // Adiciona um pequeno delay para melhor experiência do usuário
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Garantir que todos os campos obrigatórios estejam presentes
      const requiredFields = {
        nome: formData.nome,
        cpf: formData.cpf,
        genero: formData.genero,
        email: formData.email,
        senha: formData.senha,
        crm: formData.crm,
        areaAtuacao: formData.areaAtuacao,
        telefonePessoal: formData.telefonePessoal,
        cep: formData.cep,
        enderecoConsultorio: formData.enderecoConsultorio,
        numeroConsultorio: formData.numeroConsultorio
      };

      // Verificar campos obrigatórios
      for (const [field, value] of Object.entries(requiredFields)) {
        if (!value) {
          throw new Error(`Campo obrigatório não preenchido: ${field}`);
        }
      }

      // Limpar formatação dos campos
      const cleanedData = {
        ...formData,
        cpf: formData.cpf.replace(/\D/g, ''),
        telefonePessoal: formData.telefonePessoal.replace(/\D/g, ''),
        telefoneConsultorio: formData.telefoneConsultorio.replace(/\D/g, ''),
        cep: formData.cep.replace(/\D/g, ''),
        crm: formData.crm.replace(/\W/g, '').toUpperCase(),
        rqe: formData.rqe ? [formData.rqe.replace(/\D/g, '')] : []
      };

      console.log('Dados a serem enviados:', cleanedData);

      const API_URL = window.API_URL || 'http://localhost:65432';
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedData)
      });

      let data = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.warn('Resposta não é JSON:', text);
        }
      } catch (parseError) {
        console.error('Erro ao parsear resposta:', parseError);
      }
      console.log('Resposta do servidor:', data);

      if (!response.ok) {
        let errorMessage = t('register.errGeneric');
        
        if (response.status === 400) {
          if (data.message && (data.message.includes('já existe') || data.message.includes('Usuário já existe'))) {
            errorMessage = t('register.errEmailExists');
          } else if (Array.isArray(data.errors)) {
            errorMessage = data.errors.join('\n');
          } else if (data.message) {
            errorMessage = data.message;
          }
        } else if (response.status === 409) {
          errorMessage = t('register.errUserExists');
        } else if (response.status === 500) {
          if (data.error && data.error.includes('duplicate key') && data.error.includes('cpf')) {
            errorMessage = t('register.errCPFExists');
          } else if (data.message && (data.message.includes('já existe') || data.message.includes('Usuário já existe'))) {
            errorMessage = t('register.errEmailExists');
          } else if (data.error && data.error.includes('duplicate key') && data.error.includes('email')) {
            errorMessage = t('register.errEmailExists');
          } else if (data.message) {
            errorMessage = data.message;
          }
        }
        
        Swal.close();
        await showError(null, errorMessage);
        return false;
      }

      // Mostrar mensagem de sucesso com o nome do usuário
      const successMessage = `Olá ${formData.nome.split(' ')[0]}! Seu cadastro foi realizado com sucesso. Um e-mail de confirmação foi enviado para ${formData.email}.`;
      showSuccess(successMessage);
      return true;

    } catch (error) {
      console.error('Erro detalhado:', error);
      Swal.close();
      showError(null, t('register.errConnection'));
      return false;
    }
  }

  // Event listener para o formulário
  document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('Formulário submetido - Iniciando validação'); // Log para debug

    // Validar o passo atual antes de enviar
    if (!validateForm()) {
      console.log('Validação falhou - Retornando'); // Log para debug
      return;
    }

    // Verificar se os termos foram aceitos
    const termosCheckbox = document.getElementById('termsAccept');
    if (termosCheckbox && !termosCheckbox.checked) {
      showError(termosCheckbox, t('register.errTermsSubmit'));
      return;
    }

    // Coletar dados do formulário
    const formData = {
      nome: document.getElementById('nome')?.value?.trim() || '',
      cpf: document.getElementById('cpf')?.value?.replace(/\D/g, '') || '',
      telefonePessoal: document.getElementById('telefonePessoal')?.value?.trim() || '',
      email: document.getElementById('email')?.value?.toLowerCase().trim() || '',
      senha: document.getElementById('senha')?.value || '',
      crm: document.getElementById('crm')?.value?.trim() || '',
      rqe: document.getElementById('rqe1')?.value?.trim() || '',
      areaAtuacao: (() => {
        const area = document.getElementById('areaAtuacao')?.value?.trim() || '';
        const outra = document.getElementById('outraEspecialidade')?.value?.trim() || '';
        return area === 'Outros' ? outra : area;
      })(),
      genero: document.getElementById('genero')?.value || '',
      cep: document.getElementById('cep')?.value?.replace(/\D/g, '') || '',
      enderecoConsultorio: document.getElementById('enderecoConsultorio')?.value?.trim() || '',
      numeroConsultorio: document.getElementById('numeroConsultorio')?.value?.trim() || '',
      telefoneConsultorio: document.getElementById('telefoneConsultorio')?.value?.trim() || '',
      termosAceitos: true
    };

    console.log('Dados coletados do formulário:', formData); // Log para debug

    // Mostrar loading
    Swal.fire({
      title: t('register.swalProcessing'),
      text: t('register.swalProcessingText'),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title',
        content: 'custom-swal-content'
      }
    });

    try {
      // Processar o formulário
      const success = await processForm(formData);
      console.log('Resultado do processamento:', success); // Log para debug

      if (!success) {
        Swal.close();
        return;
      }
      
      Swal.close();
    } catch (error) {
      console.error('Erro detalhado no processamento:', error); // Log mais detalhado
      Swal.close();
      showError(null, t('register.errProcess'));
    }
  });
});

// Funções auxiliares
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, "");
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let digitoVerificador1 = resto > 9 ? 0 : resto;
  if (digitoVerificador1 !== parseInt(cpf.charAt(9))) return false;

  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let digitoVerificador2 = resto > 9 ? 0 : resto;
  if (digitoVerificador2 !== parseInt(cpf.charAt(10))) return false;

  return true;
}

function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}