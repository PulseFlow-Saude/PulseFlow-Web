import mongoose from 'mongoose';

/** Contatos importados com base legal documentada (LGPD). */
const medicoContatoSchema = new mongoose.Schema(
  {
    nome: { type: String, index: true },
    cpf: { type: String, index: true },
    email: { type: String, index: true },
    telefone: { type: String, index: true },
    crm: { type: String, index: true },
    crmUf: { type: String },
    uf: { type: String },
    municipio: { type: String },
    baseLegal: { type: String, required: true },
    fonte: { type: String, default: 'importacao' }
  },
  { timestamps: true }
);

medicoContatoSchema.index({ crm: 1, crmUf: 1 });
medicoContatoSchema.index({ nome: 1, uf: 1, municipio: 1 });

const MedicoContato = mongoose.model('MedicoContato', medicoContatoSchema);
export default MedicoContato;
