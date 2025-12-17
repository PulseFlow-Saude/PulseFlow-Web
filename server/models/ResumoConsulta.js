import mongoose from 'mongoose';

const resumoConsultaSchema = new mongoose.Schema({
  pacienteId: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Paciente',
    required: true
  },
  medicoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dataConsulta: {
    type: Date,
    required: true,
    default: Date.now
  },
  transcricao: {
    type: String,
    required: false // Pode ser opcional se houver erro na transcrição
  },
  resumo: {
    type: String,
    required: false // Será preenchido durante o processamento
  },
  pontosImportantes: {
    type: [String],
    default: []
  },
  duracaoAudio: {
    type: Number, // em segundos
    required: false
  },
  arquivoAudio: {
    type: String, // caminho do arquivo ou URL
    required: false
  },
  status: {
    type: String,
    enum: ['processando', 'concluido', 'erro'],
    default: 'processando'
  },
  erro: {
    type: String,
    required: false
  },
  tipoConsulta: {
    type: String,
    enum: ['presencial', 'online', 'domiciliar'],
    default: 'presencial'
  },
  motivoConsulta: {
    type: String,
    required: false
  },
  observacoes: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  collection: 'resumosconsultas'
});

export default mongoose.model('ResumoConsulta', resumoConsultaSchema);

