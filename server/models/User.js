import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, required: true },
  genero: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  crm: { type: String, required: true },
  rqe: [{ type: String }], // Array de RQEs
  areaAtuacao: { type: String, required: true },
  telefonePessoal: { type: String, required: true },
  telefoneConsultorio: { type: String },
  cep: { type: String, required: true },
  enderecoConsultorio: { type: String, required: true },
  numeroConsultorio: { type: String, required: true },
  complemento: { type: String },
  bairro: { type: String },
  cidade: { type: String },
  estado: { type: String },
  foto: { type: String },
  fcmToken: { type: String },
  otp: String,
  otpExpires: Date,
  // Validação de cadastro médico
  validationStatus: { type: String, enum: ['pending_complement', 'under_review', 'denied', 'approved'], default: 'pending_complement' },
  validationDeniedReason: { type: String },
  validationSubmittedAt: { type: Date },
  // Pós-aprovação: escolha de plano
  hasChosenPlan: { type: Boolean, default: false },
  trialEndsAt: { type: Date },
  /** trial | paid — preenchido em /perfil/choose-plan (admin pode ajustar) */
  planChoice: { type: String, enum: ['trial', 'paid'] },
  // Fluxo de pagamento: quando o médico escolhe "pago", criamos uma etapa pendente.
  // O plano só é ativado quando ele confirma o pagamento no checkout.
  // Valores esperados: 'none' | 'pending' | 'paid'
  paymentStatus: { type: String, default: 'none' },
  // Admin (isAdmin === true ou role === 'admin')
  role: { type: String, enum: ['medico', 'admin'], default: 'medico' },
  isAdmin: { type: Boolean, default: false },
}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      if (ret.dataNascimento) {
        ret.dataNascimento = new Date(ret.dataNascimento).toISOString().split('T')[0];
      }
      return ret;
    }
  }
});

const User = mongoose.model('User', userSchema);

export default User;
