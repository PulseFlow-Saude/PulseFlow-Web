import { API_URL } from './config.js';

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

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

/** UFs brasileiras (CRM) */
const BR_UF_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

function populateCrmUfSelect() {
  const sel = document.getElementById('crmUf');
  if (!sel) return;
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (k, o) => o?.fallback ?? k;
  const ph = t('register.selectCrmUf', { fallback: 'Selecione a UF' });
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = ph;
  sel.appendChild(opt0);
  BR_UF_CODES.forEach((uf) => {
    const o = document.createElement('option');
    o.value = uf;
    o.textContent = uf;
    sel.appendChild(o);
  });
}

function populateEstadoConsultorioBrSelect() {
  const sel = document.getElementById('estadoConsultorioBr');
  if (!sel) return;
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (k, o) => o?.fallback ?? k;
  const ph = t('register.selectStateBR', { fallback: 'UF' });
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = ph;
  sel.appendChild(opt0);
  BR_UF_CODES.forEach((uf) => {
    const o = document.createElement('option');
    o.value = uf;
    o.textContent = uf;
    sel.appendChild(o);
  });
}

function getRegisterCountry() {
  const el = document.getElementById('registerCountry');
  return el && el.value === 'US' ? 'US' : 'BR';
}

/**
 * Alinha o país de registo ao idioma do header (`pulseflow_lang`: EN → US, pt-BR → BR).
 * Necessário porque o módulo i18n usa `await init()` e o `DOMContentLoaded` deste script
 * pode correr antes do inline script terminar — o select ficava em BR com interface EN.
 */
function syncRegisterCountryFromStoredLang() {
  const sel = document.getElementById('registerCountry');
  if (!sel) return;
  try {
    const lang = localStorage.getItem('pulseflow_lang');
    sel.value = lang === 'en' ? 'US' : 'BR';
  } catch (_) {
    sel.value = 'BR';
  }
}

function populateUSStateSelects() {
  const med = document.getElementById('medicalLicenseState');
  const off = document.getElementById('estadoConsultorio');
  if (!med || !off) return;
  med.innerHTML = '';
  off.innerHTML = '';
  const ph1 = document.createElement('option');
  ph1.value = '';
  ph1.textContent = '—';
  const ph2 = document.createElement('option');
  ph2.value = '';
  ph2.textContent = '—';
  med.appendChild(ph1);
  off.appendChild(ph2);
  US_STATE_CODES.forEach((code) => {
    const o1 = document.createElement('option');
    o1.value = code;
    o1.textContent = code;
    med.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = code;
    o2.textContent = code;
    off.appendChild(o2);
  });
}

function applyRegisterCountryMode() {
  const us = getRegisterCountry() === 'US';
  document.querySelectorAll('.register-br-only').forEach((el) => {
    el.style.display = us ? 'none' : '';
  });
  document.querySelectorAll('.register-us-only').forEach((el) => {
    el.style.display = us ? '' : 'none';
  });
  const setReq = (id, on) => {
    const n = document.getElementById(id);
    if (n) n.required = !!on;
  };
  setReq('cpf', !us);
  setReq('crm', !us);
  setReq('crmUf', !us);
  setReq('rqe1', false);
  setReq('cep', !us);
  setReq('enderecoConsultorio', !us);
  setReq('bairroConsultorio', !us);
  setReq('cidadeConsultorioBr', !us);
  setReq('estadoConsultorioBr', !us);
  setReq('numeroConsultorioBr', !us);
  setReq('telefoneConsultorioBr', !us);
  setReq('npi', us);
  setReq('medicalLicenseNumber', us);
  setReq('medicalLicenseState', us);
  setReq('cepUS', us);
  setReq('enderecoConsultorioUS', us);
  setReq('complementoConsultorioUS', false);
  setReq('cidadeConsultorio', us);
  setReq('estadoConsultorio', us);
  setReq('numeroConsultorio', us);
  setReq('telefoneConsultorio', us);

  const skipEl = document.getElementById('skipOfficeRegister');
  const wrap = document.getElementById('registerOfficeFields');
  const officeIds = [
    'cep', 'enderecoConsultorio', 'bairroConsultorio', 'cidadeConsultorioBr', 'estadoConsultorioBr',
    'numeroConsultorioBr', 'telefoneConsultorioBr',
    'cepUS', 'enderecoConsultorioUS', 'complementoConsultorioUS', 'cidadeConsultorio', 'estadoConsultorio',
    'numeroConsultorio', 'telefoneConsultorio'
  ];
  if (skipEl && skipEl.checked) {
    officeIds.forEach((id) => {
      const n = document.getElementById(id);
      if (n) n.required = false;
    });
    if (wrap) {
      wrap.style.opacity = '0.55';
      wrap.style.pointerEvents = 'none';
    }
  } else if (wrap) {
    wrap.style.opacity = '1';
    wrap.style.pointerEvents = '';
  }

  refreshRegisterTermsI18n();
}

/** Valores enviados ao backend (CFM / canônico PT) */
const FALLBACK_SPECIALTY_VALUES_PT = [
  "Acupuntura", "Alergia e Imunologia", "Anestesiologia", "Angiologia",
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

/** Mesma ordem que FALLBACK_SPECIALTY_VALUES_PT — usado se en.json não carregar */
const FALLBACK_SPECIALTY_LABELS_EN = [
  "Acupuncture", "Allergy and Immunology", "Anesthesiology", "Angiology",
  "Cardiology", "Cardiovascular Surgery", "Hand Surgery", "Head and Neck Surgery",
  "Digestive System Surgery", "General Surgery", "Surgical Oncology", "Pediatric Surgery",
  "Plastic Surgery", "Thoracic Surgery", "Vascular Surgery", "Internal Medicine",
  "Coloproctology", "Dermatology", "Endocrinology and Metabolism", "Endoscopy",
  "Gastroenterology", "Medical Genetics", "Geriatrics", "Obstetrics and Gynecology",
  "Hematology and Hemotherapy", "Homeopathy", "Infectious Disease", "Mastology",
  "Emergency Medicine", "Family and Community Medicine", "Occupational Medicine",
  "Traffic Medicine", "Sports Medicine", "Physical Medicine and Rehabilitation",
  "Intensive Care Medicine", "Forensic Medicine", "Nuclear Medicine",
  "Preventive and Social Medicine", "Nephrology", "Neurosurgery", "Neurology",
  "Nutrology", "Ophthalmology", "Clinical Oncology", "Orthopedics and Traumatology",
  "Otorhinolaryngology", "Pathology", "Clinical Pathology / Laboratory Medicine",
  "Pediatrics", "Pulmonology", "Psychiatry", "Radiology and Diagnostic Imaging",
  "Radiation Oncology", "Rheumatology", "Urology", "Others"
];

function resolveRegisterLang() {
  try {
    const s = localStorage.getItem('pulseflow_lang');
    if (s === 'en') return 'en';
    if (s === 'pt-BR') return 'pt-BR';
  } catch (_) {}
  if (typeof window.pulseflowGetLanguage === 'function') {
    const g = window.pulseflowGetLanguage();
    if (g === 'en') return 'en';
    if (g === 'pt-BR') return 'pt-BR';
  }
  const htmlLang = (document.documentElement && document.documentElement.getAttribute('lang')) || '';
  if (htmlLang.toLowerCase().startsWith('en')) return 'en';
  return 'pt-BR';
}

/**
 * Roda ao carregar o script (depois do módulo i18n com await init), para os rótulos EN não caírem em PT.
 */
function fillRegisterSpecialtySelect() {
  const areaSelect = document.getElementById("areaAtuacao");
  if (!areaSelect) return;
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (key, opts) => opts?.fallback ?? key;
  const getTr = typeof window.pulseflowGetTranslationValue === 'function' ? window.pulseflowGetTranslationValue : () => undefined;
  const lang = resolveRegisterLang();
  const valuesPt = getTr('register.specialtyLabels', 'pt-BR');
  const labelsFromJson = getTr('register.specialtyLabels', lang === 'en' ? 'en' : 'pt-BR');
  const specialtyValues = Array.isArray(valuesPt) && valuesPt.length ? valuesPt : FALLBACK_SPECIALTY_VALUES_PT;
  let specialtyLabels;
  if (lang === 'en') {
    specialtyLabels =
      Array.isArray(labelsFromJson) && labelsFromJson.length === specialtyValues.length
        ? labelsFromJson
        : FALLBACK_SPECIALTY_LABELS_EN;
  } else {
    specialtyLabels =
      Array.isArray(labelsFromJson) && labelsFromJson.length === specialtyValues.length
        ? labelsFromJson
        : specialtyValues;
  }
  areaSelect.innerHTML = "";
  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  const lng = lang === 'en' ? 'en' : 'pt-BR';
  placeholderOpt.textContent = t('register.selectSpecialty', {
    lng,
    fallback: lng === 'en' ? 'Select your specialty' : 'Selecione sua especialidade'
  });
  areaSelect.appendChild(placeholderOpt);
  specialtyValues.forEach((value, i) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = specialtyLabels[i] !== undefined ? specialtyLabels[i] : value;
    areaSelect.appendChild(option);
  });

  const outraEspecialidadeRow = document.getElementById("outraEspecialidadeRow");
  const outraEspecialidadeInput = document.getElementById("outraEspecialidade");
  areaSelect.addEventListener("change", function() {
    if (this.value === "Outros") {
      if (outraEspecialidadeRow) outraEspecialidadeRow.style.display = "flex";
      if (outraEspecialidadeInput) outraEspecialidadeInput.required = true;
    } else {
      if (outraEspecialidadeRow) outraEspecialidadeRow.style.display = "none";
      if (outraEspecialidadeInput) {
        outraEspecialidadeInput.required = false;
        outraEspecialidadeInput.value = "";
      }
    }
  });
}

fillRegisterSpecialtySelect();

function refreshRegisterHelpAriaLabels() {
  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (key, opts) => opts?.fallback ?? key;
  const aria = t('register.helpAriaLabel', { fallback: 'Informações sobre este campo' });
  document.querySelectorAll('.register-help-btn').forEach((btn) => {
    btn.setAttribute('aria-label', aria);
  });
}

function initRegisterFieldHelp() {
  function closeAll() {
    document.querySelectorAll('.register-help-panel').forEach((p) => {
      p.hidden = true;
    });
    document.querySelectorAll('.register-help-btn').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.register-help-btn').forEach((btn) => {
    const panelId = btn.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!panel) return;
      const wasHidden = panel.hidden;
      closeAll();
      if (wasHidden) {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeAll);
  document.querySelectorAll('.register-help-panel').forEach((p) => {
    p.addEventListener('click', (e) => e.stopPropagation());
  });

  refreshRegisterHelpAriaLabels();
}

function refreshRegisterTermsI18n() {
  if (typeof window.pulseflowApplyPageTranslations === 'function') {
    window.pulseflowApplyPageTranslations();
  }
  refreshRegisterHelpAriaLabels();
}

document.addEventListener("DOMContentLoaded", () => {
  syncRegisterCountryFromStoredLang();

  const t = typeof window.pulseflowT === 'function' ? window.pulseflowT : (key, opts) => opts?.fallback ?? key;
  const form = document.getElementById("registerForm");
  console.log('Form encontrado:', form);

  if (!form) {
    console.error('Formulário não encontrado!');
    return;
  }

  const submitBtn = form.querySelector("button[type='submit']");

  populateUSStateSelects();
  populateCrmUfSelect();
  populateEstadoConsultorioBrSelect();
  applyRegisterCountryMode();
  const regCountryEl = document.getElementById('registerCountry');
  if (regCountryEl) {
    regCountryEl.addEventListener('change', () => applyRegisterCountryMode());
  }
  const skipOfficeEl = document.getElementById('skipOfficeRegister');
  if (skipOfficeEl) {
    skipOfficeEl.addEventListener('change', () => applyRegisterCountryMode());
  }

  initRegisterFieldHelp();

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

  /** CRM BR: apenas 4–6 dígitos (UF vem do campo crmUf) */
  const maskCRM = (input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
    });
  };

  /** Licença US: A–Z, 0–9, hífen; 5–15 caracteres */
  const maskLicenseUS = (input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      let v = input.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      if (v.length > 15) v = v.slice(0, 15);
      input.value = v;
    });
  };

  // Aplicar máscaras
  maskCPF(form.cpf);
  maskPhone(form.telefonePessoal);
  if (form.telefoneConsultorio) maskPhone(form.telefoneConsultorio);
  const telBrEl = document.getElementById('telefoneConsultorioBr');
  if (telBrEl) maskPhone(telBrEl);
  maskCRM(form.crm);
  const licInputEl = document.getElementById("medicalLicenseNumber");
  maskLicenseUS(licInputEl);

  // Máscaras de input
  const cpfInput = document.getElementById("cpf");
  const telefonePessoalInput = document.getElementById("telefonePessoal");
  const telefoneConsultorioInput = document.getElementById("telefoneConsultorio");
  const telefoneConsultorioBrInput = document.getElementById("telefoneConsultorioBr");
  const crmInput = document.getElementById("crm");
  const cepInput = document.getElementById("cep");
  const passwordInput = document.getElementById("senha");
  const strengthBar = document.getElementById("passwordStrengthBar");

  // Aplicar máscaras
  if (cpfInput) IMask(cpfInput, { mask: "000.000.000-00" });
  IMask(telefonePessoalInput, { mask: "(00) 00000-0000" });
  if (telefoneConsultorioInput) IMask(telefoneConsultorioInput, { mask: "(000) 000-0000" });
  if (telefoneConsultorioBrInput) IMask(telefoneConsultorioBrInput, { mask: "(00) 0000-0000" });
  if (cepInput) IMask(cepInput, { mask: "00000-000" });
  const npiInput = document.getElementById('npi');
  if (npiInput) {
    npiInput.addEventListener('input', () => {
      npiInput.value = npiInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }
  const cepUSInput = document.getElementById('cepUS');
  if (cepUSInput) {
    IMask(cepUSInput, { mask: ['00000', '00000-0000'] });
  }

  document.querySelectorAll(".password-wrapper .password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const wrap = toggle.closest(".password-wrapper");
      const input = wrap && wrap.querySelector("input");
      if (!input) return;
      const type = input.getAttribute("type") === "password" ? "text" : "password";
      input.setAttribute("type", type);
      toggle.classList.toggle("fa-eye");
      toggle.classList.toggle("fa-eye-slash");
    });
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

  // Busca de CEP (BR): preenche rua, bairro, cidade e UF separados
  const enderecoInput = document.getElementById("enderecoConsultorio");
  const bairroInput = document.getElementById("bairroConsultorio");
  const cidadeBrInput = document.getElementById("cidadeConsultorioBr");
  const estadoBrSelect = document.getElementById("estadoConsultorioBr");
  const numeroBrInput = document.getElementById("numeroConsultorioBr");

  if (cepInput) {
    cepInput.addEventListener("blur", async () => {
      if (getRegisterCountry() === 'US') return;
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

        if (enderecoInput) enderecoInput.value = (data.logradouro || '').trim();
        if (bairroInput) bairroInput.value = (data.bairro || '').trim();
        if (cidadeBrInput) cidadeBrInput.value = (data.localidade || '').trim();
        if (estadoBrSelect && data.uf) estadoBrSelect.value = String(data.uf).toUpperCase();
        if (numeroBrInput) numeroBrInput.focus();
      } catch (error) {
        await Swal.fire({
          title: t("register.swalCepError", { fallback: "Erro ao Buscar CEP" }),
          text: t("register.swalCepNotFound", { fallback: "Não foi possível encontrar o endereço para este CEP" }),
          icon: "error",
          confirmButtonText: t("register.swalOk", { fallback: "OK" }),
          confirmButtonColor: "#003366"
        });
        if (enderecoInput) enderecoInput.value = "";
        if (bairroInput) bairroInput.value = "";
        if (cidadeBrInput) cidadeBrInput.value = "";
        if (estadoBrSelect) estadoBrSelect.value = "";
      }
    });
  }

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
      const confirmarSenha = document.getElementById('confirmarSenha');
      const genero = document.getElementById('genero');
      const us = getRegisterCountry() === 'US';

      if (!nome || !telefone || !email || !senha || !genero || !confirmarSenha) {
        console.error('Campos não encontrados na etapa 1');
        return false;
      }

      if (!nome.value.trim()) {
        showError(nome, t('register.errName'));
        nome.focus();
        return false;
      }
      if (!us) {
        if (!cpf || !cpf.value.trim() || !validarCPF(cpf.value)) {
          showError(cpf, t('register.errCPF'));
          cpf?.focus();
          return false;
        }
      }
      if (!telefone.value.trim()) {
        showError(telefone, t('register.errPhone'));
        telefone.focus();
        return false;
      }
      if (us) {
        const d = telefone.value.replace(/\D/g, '');
        if (d.length < 10) {
          showError(telefone, t('register.errPhoneUS', { fallback: 'Enter a valid 10-digit US phone number.' }));
          telefone.focus();
          return false;
        }
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
      if (senha.value !== confirmarSenha.value) {
        showError(confirmarSenha, t('register.errPasswordMismatch', { fallback: 'As senhas não coincidem.' }));
        confirmarSenha.focus();
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
      const area = document.getElementById('areaAtuacao');
      const outraEspecialidade = document.getElementById('outraEspecialidade');
      const us = getRegisterCountry() === 'US';

      if (!area) {
        console.error('Campos não encontrados na etapa 2');
        return false;
      }

      if (us) {
        const npi = document.getElementById('npi');
        const lic = document.getElementById('medicalLicenseNumber');
        const lst = document.getElementById('medicalLicenseState');
        const npiDigits = (npi?.value || '').replace(/\D/g, '');
        if (!npi || !/^\d{10}$/.test(npiDigits)) {
          showError(npi, t('register.errNPI', { fallback: 'Enter a valid 10-digit NPI.' }));
          npi?.focus();
          return false;
        }
        const licNorm = (lic?.value || '').trim().toUpperCase();
        if (!licNorm || !/^[A-Z0-9\-]{5,15}$/.test(licNorm)) {
          showError(lic, t('register.errLicenseFormat'));
          lic?.focus();
          return false;
        }
        if (!lst?.value) {
          showError(lst, t('register.errLicenseState', { fallback: 'Select the license state.' }));
          lst?.focus();
          return false;
        }
      } else {
        const crm = document.getElementById('crm');
        const crmUf = document.getElementById('crmUf');
        if (!crm) {
          console.error('Campos não encontrados na etapa 2');
          return false;
        }
        const crmDigits = (crm.value || '').replace(/\D/g, '');
        if (!/^\d{4,6}$/.test(crmDigits)) {
          showError(crm, t('register.errCRMFormat'));
          crm.focus();
          return false;
        }
        const uf = (crmUf?.value || '').trim().toUpperCase();
        if (!crmUf || !/^[A-Z]{2}$/.test(uf)) {
          showError(crmUf, t('register.errCrmUf', { fallback: 'Selecione a UF do CRM (2 letras).' }));
          crmUf?.focus();
          return false;
        }
      }
      if (!area.value) {
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
    }

    // Etapa 3: Consultório
    if (stepIndex === 2) {
      const us = getRegisterCountry() === 'US';
      const numero = us ? document.getElementById('numeroConsultorio') : document.getElementById('numeroConsultorioBr');
      const telefone = us ? document.getElementById('telefoneConsultorio') : document.getElementById('telefoneConsultorioBr');
      const termos = document.getElementById('termsAccept');
      const skipOff = document.getElementById('skipOfficeRegister')?.checked;

      if (!numero || !telefone) {
        console.error('Campos não encontrados na etapa 3');
        return false;
      }

      if (skipOff) {
        if (termos && !termos.checked) {
          showError(termos, t('register.errTerms'));
          termos.focus();
          return false;
        }
        return true;
      }

      if (us) {
        const zipEl = document.getElementById('cepUS');
        const street = document.getElementById('enderecoConsultorioUS');
        const city = document.getElementById('cidadeConsultorio');
        const st = document.getElementById('estadoConsultorio');
        const z = (zipEl?.value || '').replace(/\D/g, '');
        if (!zipEl || (z.length !== 5 && z.length !== 9)) {
          showError(zipEl, t('register.errZIP', { fallback: 'Enter a valid ZIP (5 or 9 digits).' }));
          zipEl?.focus();
          return false;
        }
        if (!street?.value.trim()) {
          showError(street, t('register.errAddress'));
          street?.focus();
          return false;
        }
        if (!city?.value.trim()) {
          showError(city, t('register.errCity', { fallback: 'Enter the city.' }));
          city?.focus();
          return false;
        }
        if (!st?.value) {
          showError(st, t('register.errStateOffice', { fallback: 'Select the state.' }));
          st?.focus();
          return false;
        }
        const td = telefone.value.replace(/\D/g, '');
        if (td.length < 10) {
          showError(telefone, t('register.errOfficePhoneUS', { fallback: 'Enter a valid 10-digit office phone.' }));
          telefone.focus();
          return false;
        }
      } else {
        const cep = document.getElementById('cep');
        const rua = document.getElementById('enderecoConsultorio');
        const bairro = document.getElementById('bairroConsultorio');
        const cidadeBr = document.getElementById('cidadeConsultorioBr');
        const ufBr = document.getElementById('estadoConsultorioBr');
        if (!cep || !rua || !bairro || !cidadeBr || !ufBr) {
          console.error('Campos não encontrados na etapa 3');
          return false;
        }
        if (!cep.value.trim() || cep.value.replace(/\D/g, '').length !== 8) {
          showError(cep, t('register.errCEP'));
          cep.focus();
          return false;
        }
        if (!rua.value.trim()) {
          showError(rua, t('register.errStreet', { fallback: 'Informe a rua / logradouro.' }));
          rua.focus();
          return false;
        }
        if (!bairro.value.trim()) {
          showError(bairro, t('register.errNeighborhood', { fallback: 'Informe o bairro.' }));
          bairro.focus();
          return false;
        }
        if (!cidadeBr.value.trim()) {
          showError(cidadeBr, t('register.errCity', { fallback: 'Informe a cidade.' }));
          cidadeBr.focus();
          return false;
        }
        if (!ufBr.value) {
          showError(ufBr, t('register.errStateBR', { fallback: 'Selecione o estado (UF).' }));
          ufBr.focus();
          return false;
        }
        if (!telefone.value.trim()) {
          showError(telefone, t('register.errOfficePhone'));
          telefone.focus();
          return false;
        }
      }
      if (!numero.value.trim()) {
        showError(numero, t('register.errNumber'));
        numero.focus();
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

  async function redirectToOtpAfterRegister(email, senha) {
    const lang = resolveRegisterLang() === 'en' ? 'en' : 'pt-BR';
    Swal.fire({
      title: t('register.swalSendingCode', { fallback: 'Enviando código de verificação...' }),
      html: `<p style="text-align:center;color:#64748b;font-size:0.95rem;">${t('register.swalCheckEmailOtp', { fallback: 'Use o código de 6 dígitos enviado ao seu e-mail.' })}</p>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, senha, lang })
      });
      const result = await res.json().catch(() => ({}));
      Swal.close();
      if (!res.ok) {
        await showError(null, result.message || t('register.errPostRegisterLogin', { fallback: 'Conta criada. Faça login na próxima tela com seu e-mail e senha.' }));
        window.location.href = '/client/views/login.html';
        return;
      }
      localStorage.setItem('userId', result.userId);
      localStorage.setItem('email', email);
      window.location.href = '/client/views/verify-2fa.html';
    } catch (e) {
      console.error(e);
      Swal.close();
      await showError(null, t('register.errConnection'));
      window.location.href = '/client/views/login.html';
    }
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

      const isUS = formData.country === 'US';
      const skip = formData.skipOffice === true;

      const requiredFields = isUS
        ? (skip
            ? {
                nome: formData.nome,
                genero: formData.genero,
                email: formData.email,
                senha: formData.senha,
                npi: formData.npi,
                medicalLicenseNumber: formData.medicalLicenseNumber,
                medicalLicenseState: formData.medicalLicenseState,
                areaAtuacao: formData.areaAtuacao,
                telefonePessoal: formData.telefonePessoal
              }
            : {
                nome: formData.nome,
                genero: formData.genero,
                email: formData.email,
                senha: formData.senha,
                npi: formData.npi,
                medicalLicenseNumber: formData.medicalLicenseNumber,
                medicalLicenseState: formData.medicalLicenseState,
                areaAtuacao: formData.areaAtuacao,
                telefonePessoal: formData.telefonePessoal,
                cep: formData.cep,
                enderecoConsultorio: formData.enderecoConsultorio,
                cidade: formData.cidade,
                estado: formData.estado,
                numeroConsultorio: formData.numeroConsultorio,
                telefoneConsultorio: formData.telefoneConsultorio
              })
        : (skip
            ? {
                nome: formData.nome,
                cpf: formData.cpf,
                genero: formData.genero,
                email: formData.email,
                senha: formData.senha,
                crm: formData.crm,
                crmUf: formData.crmUf,
                areaAtuacao: formData.areaAtuacao,
                telefonePessoal: formData.telefonePessoal
              }
            : {
                nome: formData.nome,
                cpf: formData.cpf,
                genero: formData.genero,
                email: formData.email,
                senha: formData.senha,
                crm: formData.crm,
                crmUf: formData.crmUf,
                areaAtuacao: formData.areaAtuacao,
                telefonePessoal: formData.telefonePessoal,
                cep: formData.cep,
                enderecoConsultorio: formData.enderecoConsultorio,
                numeroConsultorio: formData.numeroConsultorio,
                bairro: formData.bairro,
                cidade: formData.cidade,
                estado: formData.estado,
                telefoneConsultorio: formData.telefoneConsultorio
              });

      for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null || String(value).trim() === '') {
          throw new Error(`Campo obrigatório não preenchido: ${field}`);
        }
      }

      let cleanedData;
      if (isUS) {
        cleanedData = {
          country: 'US',
          nome: formData.nome,
          genero: formData.genero,
          email: formData.email,
          senha: formData.senha,
          npi: String(formData.npi).replace(/\D/g, ''),
          medicalLicenseNumber: formData.medicalLicenseNumber.trim().toUpperCase(),
          medicalLicenseState: formData.medicalLicenseState,
          areaAtuacao: formData.areaAtuacao,
          telefonePessoal: formData.telefonePessoal.replace(/\D/g, ''),
          telefoneConsultorio: skip ? '' : formData.telefoneConsultorio.replace(/\D/g, ''),
          cep: skip ? '' : String(formData.cep).replace(/\D/g, ''),
          enderecoConsultorio: skip ? '' : formData.enderecoConsultorio.trim(),
          numeroConsultorio: skip ? '' : formData.numeroConsultorio.trim(),
          complemento: skip ? '' : (formData.complemento || '').trim(),
          cidade: skip ? '' : formData.cidade.trim(),
          estado: skip ? '' : formData.estado,
          skipOffice: skip,
          termosAceitos: true
        };
      } else {
        const rqeRaw = formData.rqe ? String(formData.rqe).replace(/\D/g, '') : '';
        cleanedData = {
          country: 'BR',
          nome: formData.nome,
          cpf: formData.cpf.replace(/\D/g, ''),
          genero: formData.genero,
          email: formData.email,
          senha: formData.senha,
          crm: String(formData.crm).replace(/\D/g, ''),
          crmUf: String(formData.crmUf || '').trim().toUpperCase(),
          rqe: rqeRaw ? [rqeRaw] : [],
          areaAtuacao: formData.areaAtuacao,
          telefonePessoal: formData.telefonePessoal.replace(/\D/g, ''),
          telefoneConsultorio: skip ? '' : formData.telefoneConsultorio.replace(/\D/g, ''),
          cep: skip ? '' : formData.cep.replace(/\D/g, ''),
          enderecoConsultorio: skip ? '' : formData.enderecoConsultorio,
          numeroConsultorio: skip ? '' : formData.numeroConsultorio,
          bairro: skip ? '' : (formData.bairro || '').trim(),
          cidade: formData.cidade || '',
          estado: formData.estado || '',
          skipOffice: skip,
          termosAceitos: true
        };
      }

      console.log('Dados a serem enviados:', cleanedData);

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

      Swal.close();
      await redirectToOtpAfterRegister(formData.email, formData.senha);
      return true;

    } catch (error) {
      console.error('Erro detalhado:', error);
      Swal.close();
      const msg = error && error.message && String(error.message).includes('Campo obrigatório')
        ? t('register.errGeneric')
        : t('register.errConnection');
      showError(null, msg);
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

    const countryReg = getRegisterCountry();
    const skipOfficeReg = !!document.getElementById('skipOfficeRegister')?.checked;
    const formData = {
      country: countryReg,
      skipOffice: skipOfficeReg,
      nome: document.getElementById('nome')?.value?.trim() || '',
      cpf: document.getElementById('cpf')?.value?.replace(/\D/g, '') || '',
      telefonePessoal: document.getElementById('telefonePessoal')?.value?.trim() || '',
      email: document.getElementById('email')?.value?.toLowerCase().trim() || '',
      senha: document.getElementById('senha')?.value || '',
      crm: document.getElementById('crm')?.value?.trim() || '',
      crmUf: document.getElementById('crmUf')?.value || '',
      rqe: document.getElementById('rqe1')?.value?.trim() || '',
      npi: document.getElementById('npi')?.value || '',
      medicalLicenseNumber: document.getElementById('medicalLicenseNumber')?.value?.trim() || '',
      medicalLicenseState: document.getElementById('medicalLicenseState')?.value || '',
      areaAtuacao: (() => {
        const area = document.getElementById('areaAtuacao')?.value?.trim() || '';
        const outra = document.getElementById('outraEspecialidade')?.value?.trim() || '';
        return area === 'Outros' ? outra : area;
      })(),
      genero: document.getElementById('genero')?.value || '',
      cep:
        countryReg === 'US'
          ? document.getElementById('cepUS')?.value?.replace(/\D/g, '') || ''
          : document.getElementById('cep')?.value?.replace(/\D/g, '') || '',
      enderecoConsultorio:
        countryReg === 'US'
          ? document.getElementById('enderecoConsultorioUS')?.value?.trim() || ''
          : document.getElementById('enderecoConsultorio')?.value?.trim() || '',
      bairro: countryReg === 'BR' ? document.getElementById('bairroConsultorio')?.value?.trim() || '' : '',
      cidade:
        countryReg === 'US'
          ? document.getElementById('cidadeConsultorio')?.value?.trim() || ''
          : document.getElementById('cidadeConsultorioBr')?.value?.trim() || '',
      estado:
        countryReg === 'US'
          ? document.getElementById('estadoConsultorio')?.value || ''
          : document.getElementById('estadoConsultorioBr')?.value || '',
      numeroConsultorio:
        countryReg === 'US'
          ? document.getElementById('numeroConsultorio')?.value?.trim() || ''
          : document.getElementById('numeroConsultorioBr')?.value?.trim() || '',
      telefoneConsultorio:
        countryReg === 'US'
          ? document.getElementById('telefoneConsultorio')?.value?.trim() || ''
          : document.getElementById('telefoneConsultorioBr')?.value?.trim() || '',
      complemento: countryReg === 'US' ? document.getElementById('complementoConsultorioUS')?.value?.trim() || '' : '',
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