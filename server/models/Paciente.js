import mongoose from 'mongoose';

const pacienteSchema = new mongoose.Schema({
  // Campos do app mobile
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  cpf: { type: String, sparse: true },
  rg: { type: String },
  /** País de residência: BR ou US */
  residenceCountry: { type: String, enum: ['BR', 'US', null], default: null },
  /** EUA: Social Security Number (somente dígitos) */
  socialSecurityNumber: { type: String, sparse: true },
  phone: { type: String, required: true },
  secondaryPhone: { type: String },
  birthDate: { type: String, required: true },
  gender: { type: String, required: true },
  maritalStatus: { type: String },
  nationality: { type: String, required: true },
  address: { type: String },
  height: { type: Number }, // Altura em cm
  weight: { type: Number }, // Peso em kg
  profession: { type: String }, // Profissão
  acceptedTerms: { type: Boolean, default: false },
  profilePhoto: { type: String, default: '/client/public/assets/User_logonegativo.png' },
  emergencyContact: { type: String },
  emergencyPhone: { type: String },
  fcmToken: { type: String }, // Token para notificações push
  isAdmin: { type: Boolean, default: false },
  twoFactorCode: { type: String },
  twoFactorExpires: { type: Date },
  passwordResetCode: { type: String },
  passwordResetExpires: { type: Date },
  passwordResetRequired: { type: Boolean, default: false },
  accessCode: { type: String },
  accessCodeExpires: { type: Date },
  /** Preferência guardada no último POST /api/access-code/gerar (app): enviar e-mail quando houver acesso via Chave Oryon */
  accessLogEmail: { type: Boolean, default: false },
  /** Evita e-mail duplicado para a mesma ligação médico–paciente (idempotência) */
  accessLogEmailLastConexaoId: { type: mongoose.Schema.Types.ObjectId, default: null },
  /** Último idioma do app (pt-BR | en) enviado em POST /api/access-code/gerar — usado nos e-mails da Chave Oryon */
  appLocale: { type: String, enum: ['pt-BR', 'en'], default: 'pt-BR' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Campos legacy para compatibilidade
  nome: { type: String },
  fotoPerfil: { type: String },
  altura: { type: String },
  dataNascimento: { type: String },
  genero: { type: String },
  nacionalidade: { type: String },
  peso: { type: String },
  profissao: { type: String },
  telefone: { type: String },
  senha: { type: String },
  observacoes: { type: String, default: 'Nenhuma observação registrada' }
});

pacienteSchema.index({ cpf: 1 }, { unique: true, sparse: true });
pacienteSchema.index({ socialSecurityNumber: 1 }, { unique: true, sparse: true });

const Paciente = mongoose.model('Paciente', pacienteSchema, 'patients');
export default Paciente;
