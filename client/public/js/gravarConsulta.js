import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';
import BackgroundRecordingService from './recordingBackground.js';

const API_URL = window.API_URL || 'http://localhost:65432';

let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let recordingStartTime = null;
let recordingTimer = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationFrame = null;
let totalElapsedSeconds = 0; // Tempo total gravado (sem pausas)
let pauseStartTime = null; // Quando a pausa começou

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Página de gravação de consulta carregada');

  const validation = validateActivePatient();
  if (!validation.valid) {
    redirectToPatientSelection(validation.error);
    return;
  }

  await inicializarPagina();
});

async function inicializarPagina() {
  // Preencher data e hora automaticamente
  atualizarDataHora();
  
  // Atualizar hora a cada minuto
  setInterval(atualizarDataHora, 60000);
  
  const btnIniciar = document.getElementById('btnIniciar');
  const btnParar = document.getElementById('btnParar');
  const btnPausar = document.getElementById('btnPausar');
  const btnRegravar = document.getElementById('btnRegravar');
  const btnEnviar = document.getElementById('btnEnviar');
  const btnFecharResultado = document.getElementById('btnFecharResultado');
  const btnNovaGravacao = document.getElementById('btnNovaGravacao');
  const btnVerTranscricao = document.getElementById('btnVerTranscricao');

  btnIniciar?.addEventListener('click', iniciarGravacao);
  btnParar?.addEventListener('click', pararGravacao);
  btnPausar?.addEventListener('click', pausarGravacao);
  btnRegravar?.addEventListener('click', regravar);
  btnEnviar?.addEventListener('click', enviarAudio);
  btnFecharResultado?.addEventListener('click', fecharResultado);
  btnNovaGravacao?.addEventListener('click', novaGravacao);
  btnVerTranscricao?.addEventListener('click', toggleTranscricao);
  
  // Listener para eventos de gravação do serviço de background
  window.addEventListener('recordingStarted', () => {
    sincronizarEstadoGravacao();
  });
  
  window.addEventListener('recordingPaused', () => {
    // O tempo já foi salvo na função pausarGravacao(), apenas parar o timer aqui
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    // Atualizar UI para mostrar estado pausado
    atualizarIndicadorGravacao(true);
    
    // Atualizar botão de pausar
    const btnPausar = document.getElementById('btnPausar');
    if (btnPausar) {
      btnPausar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5,3 19,12 5,21"></polygon>
        </svg>
        <span>Retomar</span>
      `;
    }
  });
  
  window.addEventListener('recordingResumed', (e) => {
    // Resetar startTime para AGORA (novo ponto de início após retomar)
    recordingStartTime = Date.now();
    pauseStartTime = null;
    
    iniciarTimer();
    
    // Atualizar UI para mostrar estado gravando
    atualizarIndicadorGravacao(false);
    
    // Atualizar botão de pausar
    const btnPausar = document.getElementById('btnPausar');
    if (btnPausar) {
      btnPausar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="10" y1="8" x2="10" y2="16"></line>
          <line x1="14" y1="8" x2="14" y2="16"></line>
        </svg>
        <span>Pausar</span>
      `;
    }
  });
  
  // Sincronizar quando a página fica visível novamente
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(sincronizarEstadoGravacao, 100);
    }
  });

  // Verificar se o navegador suporta gravação de áudio
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    mostrarErro('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge.');
    if (btnIniciar) btnIniciar.disabled = true;
  }
  
  // Verificar se há gravação em andamento e sincronizar estado
  sincronizarEstadoGravacao();
}

function sincronizarEstadoGravacao() {
  if (!window.backgroundRecordingService) {
    return;
  }
  
  const recordingData = localStorage.getItem('activeRecording');
  if (!recordingData) {
    // Não há gravação ativa, garantir que UI está limpa
    limparUI();
    return;
  }
  
  try {
    const data = JSON.parse(recordingData);
    if (data.isActive && data.startTime) {
      // Há gravação ativa, sincronizar UI
      const btnIniciar = document.getElementById('btnIniciar');
      const btnParar = document.getElementById('btnParar');
      const btnPausar = document.getElementById('btnPausar');
      const recordingIndicator = document.getElementById('recordingIndicator');
      const audioVisualization = document.getElementById('audioVisualization');
      
      // Verificar estado do mediaRecorder se disponível
      const isPaused = window.backgroundRecordingService.mediaRecorder?.state === 'paused';
      
      if (btnIniciar) btnIniciar.style.display = 'none';
      if (btnParar) btnParar.style.display = 'flex';
      if (btnPausar) {
        btnPausar.style.display = 'flex';
        // Atualizar texto do botão de pausa
        if (isPaused) {
          btnPausar.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
            <span>Retomar</span>
          `;
        } else {
          btnPausar.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="10" y1="8" x2="10" y2="16"></line>
              <line x1="14" y1="8" x2="14" y2="16"></line>
            </svg>
            <span>Pausar</span>
          `;
        }
      }
      if (recordingIndicator) recordingIndicator.style.display = 'flex';
      if (audioVisualization) audioVisualization.style.display = 'block';
      
      // Verificar se está pausado e atualizar UI
      if (isPaused) {
        atualizarIndicadorGravacao(true);
      } else {
        atualizarIndicadorGravacao(false);
      }
      
      // Sincronizar timer apenas se não estiver pausado
      if (data.startTime && !isPaused) {
        recordingStartTime = data.startTime;
        iniciarTimer();
      } else if (isPaused) {
        // Se estiver pausado, parar o timer
        if (recordingTimer) {
          clearInterval(recordingTimer);
          recordingTimer = null;
        }
      }
      
      // Tentar reconectar visualização de áudio se o stream ainda estiver ativo
      if (window.backgroundRecordingService.stream) {
        try {
          const stream = window.backgroundRecordingService.stream;
          if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            iniciarVisualizacao();
          }
        } catch (e) {
          console.warn('Não foi possível reconectar visualização de áudio:', e);
        }
      }
    } else {
      // Gravação não está mais ativa, limpar UI
      limparUI();
    }
  } catch (e) {
    console.error('Erro ao sincronizar estado:', e);
    limparUI();
  }
}

function limparUI() {
  const btnIniciar = document.getElementById('btnIniciar');
  const btnParar = document.getElementById('btnParar');
  const btnPausar = document.getElementById('btnPausar');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const audioVisualization = document.getElementById('audioVisualization');
  const recordingTime = document.getElementById('recordingTime');
  
  if (btnIniciar) btnIniciar.style.display = 'flex';
  if (btnParar) btnParar.style.display = 'none';
  if (btnPausar) btnPausar.style.display = 'none';
  if (recordingIndicator) recordingIndicator.style.display = 'none';
  if (audioVisualization) audioVisualization.style.display = 'none';
  if (recordingTime) recordingTime.textContent = '00:00';
  
  // Limpar timer
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  // Limpar visualização
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  
  // Resetar variáveis de tempo
  totalElapsedSeconds = 0;
  pauseStartTime = null;
  recordingStartTime = null;
}

function atualizarDataHora() {
  const agora = new Date();
  
  // Formatar data: DD/MM/YYYY
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  const dataFormatada = `${dia}/${mes}/${ano}`;
  
  // Formatar hora: HH:MM
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const horaFormatada = `${horas}:${minutos}`;
  
  const dataInput = document.getElementById('dataConsulta');
  const horaInput = document.getElementById('horaConsulta');
  
  if (dataInput) dataInput.value = dataFormatada;
  if (horaInput) horaInput.value = horaFormatada;
}

async function iniciarGravacao() {
  try {
    // Limpar estado anterior se houver
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
    }
    
    // Resetar variáveis de tempo para nova gravação
    totalElapsedSeconds = 0;
    pauseStartTime = null;
    recordingStartTime = null;
    
    // Usar o serviço de gravação em background
    if (!window.backgroundRecordingService) {
      window.backgroundRecordingService = new BackgroundRecordingService();
    }
    
    // Verificar se já está gravando
    if (window.backgroundRecordingService.isRecording) {
      console.log('Gravação já está em andamento');
      sincronizarEstadoGravacao();
      return;
    }
    
    await window.backgroundRecordingService.startRecording();
    
    // Sincronizar variáveis locais
    mediaRecorder = window.backgroundRecordingService.mediaRecorder;
    audioChunks = window.backgroundRecordingService.audioChunks;
    recordingStartTime = window.backgroundRecordingService.startTime;
    
    // Configurar visualização de áudio
    const stream = window.backgroundRecordingService.stream;
    if (stream) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        console.warn('Erro ao configurar visualização de áudio:', e);
      }
    }
    
    // Atualizar UI
    const btnIniciar = document.getElementById('btnIniciar');
    const btnParar = document.getElementById('btnParar');
    const btnPausar = document.getElementById('btnPausar');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const audioVisualization = document.getElementById('audioVisualization');
    
    if (btnIniciar) btnIniciar.style.display = 'none';
    if (btnParar) btnParar.style.display = 'flex';
    if (btnPausar) {
      btnPausar.style.display = 'flex';
      btnPausar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="10" y1="8" x2="10" y2="16"></line>
          <line x1="14" y1="8" x2="14" y2="16"></line>
        </svg>
        <span>Pausar</span>
      `;
    }
    if (recordingIndicator) recordingIndicator.style.display = 'flex';
    if (audioVisualization) audioVisualization.style.display = 'block';
    
    // Garantir que o indicador mostre estado de gravação
    atualizarIndicadorGravacao(false);
    
    // Iniciar timer
    iniciarTimer();
    
    // Iniciar visualização
    if (analyser && dataArray) {
      iniciarVisualizacao();
    }

  } catch (error) {
    console.error('Erro ao iniciar gravação:', error);
    mostrarErro('Erro ao acessar o microfone. Verifique as permissões do navegador.');
    limparUI();
  }
}

function pararGravacao() {
  // Parar timer primeiro
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  // Parar visualização
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(console.error);
    audioContext = null;
  }
  
  // Parar gravação no serviço de background ANTES de atualizar UI
  let blob = null;
  if (window.backgroundRecordingService) {
    // Garantir que o indicador global seja ocultado
    window.backgroundRecordingService.hideRecordingIndicator();
    
    blob = window.backgroundRecordingService.stopRecording();
  }
  
  // Atualizar UI
  limparUI();
  
  // Se temos um blob, mostrar player
  if (blob) {
    audioBlob = blob;
    const audioUrl = URL.createObjectURL(blob);
    const recordedAudio = document.getElementById('recordedAudio');
    if (recordedAudio) {
      recordedAudio.src = audioUrl;
    }
    
    // Mostrar player
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
      audioPlayer.style.display = 'block';
    }
  }
  
  // Limpar variáveis
  mediaRecorder = null;
  analyser = null;
  dataArray = null;
  recordingStartTime = null;
  totalElapsedSeconds = 0;
  pauseStartTime = null;
}

function pausarGravacao() {
  if (!window.backgroundRecordingService) {
    console.warn('Serviço de gravação não disponível');
    return;
  }
  
  const btnPausar = document.getElementById('btnPausar');
  if (!btnPausar) return;
  
  const service = window.backgroundRecordingService;
  const isPaused = service.mediaRecorder?.state === 'paused';
  
  if (isPaused) {
    // Retomar gravação
    if (service.resumeRecording()) {
      btnPausar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="10" y1="8" x2="10" y2="16"></line>
          <line x1="14" y1="8" x2="14" y2="16"></line>
        </svg>
        <span>Pausar</span>
      `;
      
      // Resetar startTime para AGORA (novo ponto de início após retomar)
      recordingStartTime = Date.now();
      pauseStartTime = null;
      
      // Retomar timer local
      iniciarTimer();
      
      // Atualizar indicador para mostrar que está gravando
      atualizarIndicadorGravacao(false);
    }
  } else {
    // Pausar gravação
    if (service.pauseRecording()) {
      btnPausar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5,3 19,12 5,21"></polygon>
        </svg>
        <span>Retomar</span>
      `;
      
      // Pausar timer PRIMEIRO para evitar cálculos incorretos
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      
      // Salvar o tempo decorrido até o momento da pausa (depois de parar o timer)
      if (recordingStartTime) {
        const elapsedSinceStart = Math.floor((Date.now() - recordingStartTime) / 1000);
        totalElapsedSeconds += elapsedSinceStart;
        pauseStartTime = Date.now();
        // Resetar startTime para evitar cálculos errados
        recordingStartTime = null;
        
        // Atualizar o display do tempo para mostrar o tempo total (congelado)
        const recordingTimeElement = document.getElementById('recordingTime');
        if (recordingTimeElement) {
          const minutes = Math.floor(totalElapsedSeconds / 60).toString().padStart(2, '0');
          const seconds = (totalElapsedSeconds % 60).toString().padStart(2, '0');
          recordingTimeElement.textContent = `${minutes}:${seconds}`;
        }
      }
      
      // Atualizar indicador para mostrar que está pausado
      atualizarIndicadorGravacao(true);
    }
  }
}

function atualizarIndicadorGravacao(isPausado) {
  const recordingIndicator = document.getElementById('recordingIndicator');
  if (!recordingIndicator) return;
  
  const pulseDot = recordingIndicator.querySelector('.pulse-dot');
  const recordingText = recordingIndicator.querySelector('.recording-text');
  
  if (isPausado) {
    // Pausado: ocultar animação e mudar texto
    if (pulseDot) {
      pulseDot.style.animation = 'none';
      pulseDot.style.opacity = '0.5';
    }
    if (recordingText) {
      recordingText.textContent = 'Pausado...';
    }
    recordingIndicator.style.opacity = '0.7';
  } else {
    // Gravando: mostrar animação e texto normal
    if (pulseDot) {
      pulseDot.style.animation = 'pulse 1.5s ease-in-out infinite';
      pulseDot.style.opacity = '1';
    }
    if (recordingText) {
      recordingText.textContent = 'Gravando...';
    }
    recordingIndicator.style.opacity = '1';
  }
}

function regravar() {
  audioBlob = null;
  audioChunks = [];
  const audioPlayer = document.getElementById('audioPlayer');
  const recordedAudio = document.getElementById('recordedAudio');
  const btnIniciar = document.getElementById('btnIniciar');
  
  if (audioPlayer) audioPlayer.style.display = 'none';
  if (recordedAudio) recordedAudio.src = '';
  if (btnIniciar) btnIniciar.style.display = 'flex';
}

function iniciarTimer() {
  // Limpar timer anterior se existir
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  // Se não há startTime definido, definir agora (nova gravação)
  if (!recordingStartTime) {
    recordingStartTime = Date.now();
  }
  
  const recordingTimeElement = document.getElementById('recordingTime');
  if (!recordingTimeElement) return;
  
  // Atualizar imediatamente
  const atualizarTempo = () => {
    // Verificar se está realmente gravando e não pausado
    const service = window.backgroundRecordingService;
    if (service && service.mediaRecorder) {
      const isPaused = service.mediaRecorder.state === 'paused';
      if (isPaused) {
        // Se pausado, não atualizar o tempo
        return;
      }
    }
    
    if (!recordingStartTime) return;
    
    // Calcular tempo decorrido desde o último start/resume
    const elapsedSinceStart = Math.floor((Date.now() - recordingStartTime) / 1000);
    // Tempo total = tempo decorrido + tempo já gravado antes das pausas
    const totalTime = totalElapsedSeconds + elapsedSinceStart;
    
    const minutes = Math.floor(totalTime / 60).toString().padStart(2, '0');
    const seconds = (totalTime % 60).toString().padStart(2, '0');
    recordingTimeElement.textContent = `${minutes}:${seconds}`;
  };
  
  atualizarTempo();
  
  // Atualizar a cada segundo (só quando não está pausado)
  recordingTimer = setInterval(atualizarTempo, 1000);
}

function iniciarVisualizacao() {
  const canvas = document.getElementById('audioCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  function draw() {
    if (!analyser || !dataArray) return;
    
    animationFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;
      
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#2563eb');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }

  draw();
}

async function enviarAudio() {
  if (!audioBlob) {
    mostrarErro('Nenhum áudio gravado. Por favor, grave um áudio primeiro.');
    return;
  }

  try {
    // Obter dados do paciente
    let selectedPatient = localStorage.getItem('selectedPatient') ||
                          localStorage.getItem('pacienteSelecionado') ||
                          localStorage.getItem('selectedPatientData');

    if (!selectedPatient) {
      mostrarErro('Nenhum paciente selecionado. Por favor, selecione um paciente primeiro.');
      return;
    }

    let paciente;
    try {
      paciente = JSON.parse(selectedPatient);
    } catch (parseError) {
      console.error('Erro ao fazer parse do paciente:', parseError);
      mostrarErro('Erro ao processar dados do paciente selecionado.');
      return;
    }

    const cpf = paciente.cpf?.replace(/[^\d]/g, '');
    if (!cpf) {
      mostrarErro('CPF não encontrado no paciente selecionado.');
      return;
    }

    // Obter dados do formulário
    const motivoConsulta = document.getElementById('motivoConsulta')?.value;
    const observacoes = document.getElementById('observacoes')?.value;
    
    if (!motivoConsulta) {
      mostrarErro('Por favor, selecione o motivo da consulta.');
      return;
    }

    // Preparar FormData
    const formData = new FormData();
    formData.append('audio', audioBlob, 'consulta.webm');
    formData.append('cpf', cpf);
    formData.append('motivoConsulta', motivoConsulta);
    if (observacoes && observacoes.trim()) {
      formData.append('observacoes', observacoes.trim());
    }

    // Obter token
    const token = localStorage.getItem('token');
    if (!token) {
      mostrarErro('Sessão expirada. Faça login novamente!');
      return;
    }

    // Mostrar seção de processamento
    const processingSection = document.getElementById('processingSection');
    const recordingSection = document.querySelector('.recording-section');
    
    if (processingSection) processingSection.style.display = 'block';
    if (recordingSection) recordingSection.style.display = 'none';
    
    // Atualizar status
    atualizarStatusProcessamento(1);

    // Enviar áudio
    const response = await fetch(`${API_URL}/api/resumo-consulta/processar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const handled = await handleApiError(response);
    if (handled) {
      const processingSection = document.getElementById('processingSection');
      const recordingSection = document.querySelector('.recording-section');
      if (processingSection) processingSection.style.display = 'none';
      if (recordingSection) recordingSection.style.display = 'block';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Erro ao processar áudio');
    }

    const data = await response.json();
    console.log('Áudio enviado com sucesso:', data);

    // Atualizar status
    atualizarStatusProcessamento(2);

    // Polling para verificar status do processamento
    await verificarStatusProcessamento(data.resumoId);

  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    mostrarErro(error.message || 'Erro ao enviar áudio para processamento.');
    const processingSection = document.getElementById('processingSection');
    const recordingSection = document.querySelector('.recording-section');
    if (processingSection) processingSection.style.display = 'none';
    if (recordingSection) recordingSection.style.display = 'block';
  }
}

function atualizarStatusProcessamento(step) {
  // Remover active de todos os steps
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  
  // Adicionar active ao step atual
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  
  if (step >= 1 && step1) step1.classList.add('active');
  if (step >= 2 && step2) step2.classList.add('active');
  if (step >= 3 && step3) step3.classList.add('active');
}

async function verificarStatusProcessamento(resumoId) {
  const token = localStorage.getItem('token');
  let tentativas = 0;
  const maxTentativas = 60; // 5 minutos (5 segundos * 60)

  const interval = setInterval(async () => {
    tentativas++;
    
    try {
      const response = await fetch(`${API_URL}/api/resumo-consulta/${resumoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao verificar status');
      }

      const data = await response.json();
      
      if (data.resumo.status === 'concluido') {
        clearInterval(interval);
        atualizarStatusProcessamento(3);
        
        // Aguardar um pouco antes de mostrar resultado
        setTimeout(() => {
          mostrarResultado(data.resumo);
        }, 1000);
      } else if (data.resumo.status === 'erro') {
        clearInterval(interval);
        mostrarErro(data.resumo.erro || 'Erro ao processar consulta');
        const processingSection = document.getElementById('processingSection');
        const recordingSection = document.querySelector('.recording-section');
        if (processingSection) processingSection.style.display = 'none';
        if (recordingSection) recordingSection.style.display = 'block';
      } else if (tentativas >= maxTentativas) {
        clearInterval(interval);
        mostrarErro('Tempo limite de processamento excedido. Tente novamente.');
        const processingSection = document.getElementById('processingSection');
        const recordingSection = document.querySelector('.recording-section');
        if (processingSection) processingSection.style.display = 'none';
        if (recordingSection) recordingSection.style.display = 'block';
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      if (tentativas >= maxTentativas) {
        clearInterval(interval);
        mostrarErro('Erro ao verificar status do processamento.');
        const processingSection = document.getElementById('processingSection');
        const recordingSection = document.querySelector('.recording-section');
        if (processingSection) processingSection.style.display = 'none';
        if (recordingSection) recordingSection.style.display = 'block';
      }
    }
  }, 5000); // Verificar a cada 5 segundos
}

function mostrarResultado(resumo) {
  // Ocultar seção de processamento
  const processingSection = document.getElementById('processingSection');
  const resultSection = document.getElementById('resultSection');
  
  if (processingSection) processingSection.style.display = 'none';
  if (resultSection) resultSection.style.display = 'block';
  
  // Preencher resumo
  const resumoTexto = document.getElementById('resumoTexto');
  if (resumoTexto) {
    resumoTexto.textContent = resumo.resumo || 'Resumo não disponível';
  }
  
  // Preencher pontos importantes
  const pontosList = document.getElementById('pontosImportantes');
  if (pontosList) {
    pontosList.innerHTML = '';
    if (resumo.pontosImportantes && resumo.pontosImportantes.length > 0) {
      resumo.pontosImportantes.forEach(ponto => {
        const li = document.createElement('li');
        li.textContent = ponto;
        pontosList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'Nenhum ponto importante extraído.';
      pontosList.appendChild(li);
    }
  }
  
  // Preencher transcrição (oculta por padrão)
  if (resumo.transcricao) {
    const transcricaoTexto = document.getElementById('transcricaoTexto');
    if (transcricaoTexto) {
      transcricaoTexto.textContent = resumo.transcricao;
    }
  }
}

function toggleTranscricao() {
  const transcricaoSection = document.getElementById('transcricaoSection');
  const btnVerTranscricao = document.getElementById('btnVerTranscricao');
  
  if (!transcricaoSection || !btnVerTranscricao) {
    console.warn('Elementos de transcrição não encontrados');
    return;
  }
  
  const isHidden = transcricaoSection.style.display === 'none' || 
                   window.getComputedStyle(transcricaoSection).display === 'none';
  
  if (isHidden) {
    transcricaoSection.style.display = 'block';
    btnVerTranscricao.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18,15 12,9 6,15"></polyline>
      </svg>
      Ocultar Transcrição
    `;
  } else {
    transcricaoSection.style.display = 'none';
    btnVerTranscricao.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14,2 14,8 20,8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      Ver Transcrição
    `;
  }
}

function fecharResultado() {
  const resultSection = document.getElementById('resultSection');
  if (resultSection) resultSection.style.display = 'none';
}

function novaGravacao() {
  const resultSection = document.getElementById('resultSection');
  const recordingSection = document.querySelector('.recording-section');
  
  if (resultSection) resultSection.style.display = 'none';
  if (recordingSection) recordingSection.style.display = 'block';
  regravar();
}

function mostrarErro(mensagem) {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  Toast.fire({
    title: mensagem,
    icon: 'error',
    iconColor: '#ef4444'
  });
}

