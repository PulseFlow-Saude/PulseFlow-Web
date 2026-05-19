import mongoose from 'mongoose';

const medicoCnesSchema = new mongoose.Schema(
  {
    nome: { type: String, index: true },
    cpf: { type: String, default: '' },
    cns: { type: String, index: true },
    cbo: { type: String, default: '' },
    uf: { type: String, index: true },
    municipio: { type: String, default: '' },
    conselho: { type: String, default: '' },
    registroConselho: { type: String, index: true },
    codigoEstabelecimentoCnes: { type: String, default: '' },
    fonte: { type: String, default: 'cnes-datasus' },
    competencia: { type: String, default: '' }
  },
  { timestamps: false }
);

medicoCnesSchema.index({ registroConselho: 1, uf: 1 });
medicoCnesSchema.index({ uf: 1, municipio: 1 });

const MedicoCnes = mongoose.model('MedicoCnes', medicoCnesSchema);

export default MedicoCnes;
