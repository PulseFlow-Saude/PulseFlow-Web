import mongoose from 'mongoose';

/** Telefone/e-mail públicos da UNIDADE de saúde (CNES/DATASUS). */
const cnesEstabelecimentoSchema = new mongoose.Schema(
  {
    codigoCnes: { type: String, required: true, unique: true, index: true },
    nome: { type: String, default: '', index: true },
    telefone: { type: String, default: '' },
    email: { type: String, default: '' },
    endereco: { type: String, default: '' },
    uf: { type: String, default: '', index: true },
    municipio: { type: String, default: '', index: true },
    fonte: { type: String, default: 'cnes-estabelecimento-datasus' }
  },
  { timestamps: false }
);

const CnesEstabelecimento = mongoose.model('CnesEstabelecimento', cnesEstabelecimentoSchema);
export default CnesEstabelecimento;
