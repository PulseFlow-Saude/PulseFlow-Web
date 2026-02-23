import { validateActivePatient, redirectToPatientSelection } from './utils/patientValidation.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';
import { API_URL } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({ titleKey: 'registroEventoClinico.title', activePage: 'historicoeventoclinico' });
  const validation = validateActivePatient();
  if (!validation.valid) {
    redirectToPatientSelection(validation.error);
    return;
  }
  
  const form = document.querySelector('#registroForm');
  const token = localStorage.getItem('token');

  await carregarDadosMedico();

  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const validation = validateActivePatient();
    if (!validation.valid) {
      redirectToPatientSelection(validation.error);
      return;
    }
    
    const paciente = validation.paciente;

    const formData = {
      cpfPaciente: validation.cpf,
      titulo: document.getElementById('titulo').value,
      dataHora: document.getElementById('dataHora').value,
      tipoEvento: document.getElementById('tipoEvento').value,
      especialidade: document.getElementById('especialidade').value,
      intensidadeDor: document.getElementById('gravidade').value,
      alivio: document.getElementById('alivio').value,
      descricao: document.getElementById('descricao').value,
      sintomas: document.getElementById('sintomas').value
    };

    try {
      const response = await fetch(`${API_URL}/api/eventos-clinicos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('registroEventoClinico.erroSalvar'));
      }

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: t('registroEventoClinico.sucessoTitulo'),
          text: t('registroEventoClinico.sucessoSalvar'),
          confirmButtonText: 'OK',
          confirmButtonColor: '#002a42'
        });
      } else {
        alert(t('registroEventoClinico.sucessoSalvar'));
      }
      form.reset();
    } catch (error) {
      console.error('Erro:', error);
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: t('registroEventoClinico.erroTitulo'),
          text: error.message || t('registroEventoClinico.erroSalvar'),
          confirmButtonText: 'OK',
          confirmButtonColor: '#002a42'
        });
      } else {
        alert(error.message || t('registroEventoClinico.erroSalvar'));
      }
    }
  });
});

async function carregarDadosMedico() {
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error(t('registroEventoClinico.tokenNaoEncontrado'));

    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || t('registroEventoClinico.erroCarregarMedico'));
    }

    const medico = await res.json();
    const prefixo = medico.genero?.toLowerCase() === 'feminino' ? 'Dra.' : 'Dr.';
    const nomeFormatado = `${prefixo} ${medico.nome}`;

    const tituloSidebar = document.querySelector('.sidebar .profile h3');
    if (tituloSidebar) {
      tituloSidebar.textContent = nomeFormatado;
    }

    return true;
  } catch (error) {
    console.error("Erro ao carregar dados do médico:", error);
    const fallback = document.querySelector('.sidebar .profile h3');
    if (fallback) fallback.textContent = 'Dr(a). Nome não encontrado';
    return false;
  }
}