// Service para gerenciar gravação em background
class BackgroundRecordingService {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = null;
    this.timer = null;
    this.init();
  }

  init() {
    // Verificar se há gravação em andamento ao carregar a página
    this.checkActiveRecording();
    
    // Listener para quando a página fica visível/invisível
    document.addEventListener('visibilitychange', () => {
      if (this.isRecording && !document.hidden) {
        this.updateRecordingIndicator();
      }
    });
  }

  checkActiveRecording() {
    const recordingData = localStorage.getItem('activeRecording');
    if (recordingData) {
      try {
        const data = JSON.parse(recordingData);
        if (data.isActive && data.startTime) {
          this.isRecording = true;
          this.startTime = data.startTime;
          this.showRecordingIndicator();
          this.startTimer();
        }
      } catch (e) {
        console.error('Erro ao verificar gravação ativa:', e);
        localStorage.removeItem('activeRecording');
      }
    }
  }

  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = '';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          // Salvar chunks no localStorage periodicamente
          this.saveChunksToStorage();
        }
      };

      this.mediaRecorder.onstop = () => {
        // Apenas atualizar estado, não chamar stopRecording novamente
        this.isRecording = false;
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
      };

      this.mediaRecorder.start(1000); // Coletar dados a cada 1 segundo
      this.isRecording = true;
      
      // Salvar estado no localStorage
      this.saveRecordingState();
      
      // Mostrar indicador em todas as páginas
      this.showRecordingIndicator();
      this.startTimer();
      
      // Disparar evento customizado para notificar outras partes do código
      window.dispatchEvent(new CustomEvent('recordingStarted', { 
        detail: { startTime: this.startTime } 
      }));
      
      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      throw error;
    }
  }

  stopRecording() {
    // Parar timer primeiro
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // Parar mediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Parar stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Atualizar estado
    this.isRecording = false;
    
    // Ocultar indicador global
    this.hideRecordingIndicator();
    
    // Limpar estado do localStorage
    this.clearRecordingState();
    
    // Retornar o blob de áudio
    let blob = null;
    if (this.audioChunks.length > 0 && this.mediaRecorder) {
      try {
        blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
      } catch (e) {
        console.error('Erro ao criar blob:', e);
      }
    }
    
    // Limpar chunks
    this.audioChunks = [];
    this.mediaRecorder = null;
    
    return blob;
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.saveRecordingState();
      window.dispatchEvent(new CustomEvent('recordingPaused'));
      return true;
    }
    return false;
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      // Ajustar startTime para compensar o tempo pausado
      if (this.startTime) {
        const pausedDuration = Date.now() - (this.lastPauseTime || Date.now());
        // Não ajustar startTime, apenas retomar timer
      }
      this.startTimer();
      this.saveRecordingState();
      window.dispatchEvent(new CustomEvent('recordingResumed', { 
        detail: { startTime: this.startTime } 
      }));
      return true;
    }
    return false;
  }

  saveChunksToStorage() {
    // Converter chunks para base64 e salvar (limitado a 5MB por limitação do localStorage)
    try {
      const chunksData = this.audioChunks.map(chunk => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(chunk);
        });
      });
      
      // Salvar apenas metadados, não os chunks completos (muito grande)
      const metadata = {
        isActive: this.isRecording,
        startTime: this.startTime,
        chunksCount: this.audioChunks.length,
        mimeType: this.mediaRecorder?.mimeType || 'audio/webm'
      };
      
      localStorage.setItem('activeRecording', JSON.stringify(metadata));
    } catch (e) {
      console.warn('Não foi possível salvar chunks no storage:', e);
    }
  }

  saveRecordingState() {
    const state = {
      isActive: this.isRecording,
      startTime: this.startTime,
      mimeType: this.mediaRecorder?.mimeType || 'audio/webm'
    };
    localStorage.setItem('activeRecording', JSON.stringify(state));
  }

  clearRecordingState() {
    localStorage.removeItem('activeRecording');
    localStorage.removeItem('recordingChunks');
  }

  startTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    if (!this.startTime) {
      this.startTime = Date.now();
    }
    
    this.timer = setInterval(() => {
      if (this.startTime && this.isRecording && this.mediaRecorder?.state === 'recording') {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.updateTimerDisplay(`${minutes}:${seconds}`);
      }
    }, 1000);
  }

  showRecordingIndicator() {
    // Criar ou atualizar indicador de gravação
    let indicator = document.getElementById('global-recording-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'global-recording-indicator';
      indicator.innerHTML = `
        <div class="recording-pulse"></div>
        <span id="recording-timer">00:00</span>
        <span>Gravando...</span>
        <button id="stop-recording-btn" class="stop-btn">Parar</button>
      `;
      document.body.appendChild(indicator);
      
      // Adicionar estilos
      if (!document.getElementById('recording-indicator-styles')) {
        const style = document.createElement('style');
        style.id = 'recording-indicator-styles';
        style.textContent = `
          #global-recording-indicator {
            position: fixed;
            top: 80px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            font-weight: 600;
          }
          .recording-pulse {
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
          }
          #recording-timer {
            font-variant-numeric: tabular-nums;
            min-width: 45px;
          }
          .stop-btn {
            background: white;
            color: #ef4444;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
          }
          .stop-btn:hover {
            background: #f3f4f6;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Adicionar listener para parar gravação
      const stopBtn = indicator.querySelector('#stop-recording-btn');
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          if (window.backgroundRecordingService) {
            window.backgroundRecordingService.stopRecording();
            // Redirecionar para página de gravação se não estiver nela
            if (!window.location.pathname.includes('gravarConsulta')) {
              window.location.href = '/client/views/gravarConsulta.html';
            }
          }
        });
      }
    }
    
    indicator.style.display = 'flex';
  }

  hideRecordingIndicator() {
    const indicator = document.getElementById('global-recording-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  updateTimerDisplay(time) {
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) {
      timerElement.textContent = time;
    }
  }

  updateRecordingIndicator() {
    if (this.isRecording) {
      this.showRecordingIndicator();
    }
  }
}

// Criar instância global
if (typeof window !== 'undefined') {
  window.backgroundRecordingService = new BackgroundRecordingService();
}

export default BackgroundRecordingService;

