/**
 * Script para definir um usuário como administrador.
 * Uso: node server/scripts/set-admin.js <email>
 * Exemplo: node server/scripts/set-admin.js admin@pulseflow.com
 *
 * Requer variáveis de ambiente e conexão com o MongoDB (executar a partir da raiz do projeto
 * com dotenv carregado, ou definir MONGODB_URI).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function setAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node server/scripts/set-admin.js <email>');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Defina MONGODB_URI ou MONGO_URI no .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const { default: User } = await import('../models/User.js');
  const result = await User.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { isAdmin: true, role: 'admin', validationStatus: 'approved', hasChosenPlan: true } }
  );
  if (result.matchedCount === 0) {
    console.error('Nenhum usuário encontrado com o e-mail:', email);
    process.exit(1);
  }
  console.log('Usuário', email, 'definido como administrador.');
  await mongoose.disconnect();
  process.exit(0);
}

setAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
