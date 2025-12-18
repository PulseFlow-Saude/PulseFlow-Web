import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env do diretório server e da raiz do projeto
// __dirname aqui é server/config, então precisamos subir um nível para server/.env
const envPathServer = path.join(__dirname, '..', '.env');
const envPathRoot = path.join(__dirname, '..', '..', '.env');

// Tentar carregar do diretório server primeiro
const resultServer = dotenv.config({ path: envPathServer });
// Depois tentar da raiz do projeto (sobrescreve se existir)
const resultRoot = dotenv.config({ path: envPathRoot });

// Carregar variáveis de ambiente silenciosamente
const hasEnvVars = process.env.MONGO_URI || process.env.JWT_SECRET;
if (resultRoot.error && resultServer.error && !hasEnvVars && process.env.NODE_ENV === 'development') {
  console.warn('⚠️ Arquivo .env não encontrado');
}

export const CONFIG = {
  BACKEND_PORT: process.env.PORT || process.env.PORT_BACKEND || 65432,
  FRONTEND_PORT: process.env.PORT_FRONTEND || 3000,
  MONGODB_PORT: process.env.PORT_MONGODB || 27017,
  API_BASE_URL: process.env.API_BASE_URL,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Verificar se MONGO_URI foi carregada (apenas em desenvolvimento)
if (!CONFIG.MONGO_URI && process.env.NODE_ENV === 'development') {
  console.error('❌ MONGO_URI não encontrada nas variáveis de ambiente');
}

export default CONFIG;
