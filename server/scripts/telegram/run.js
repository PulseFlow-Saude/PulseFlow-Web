/**
 * Bot Telegram — consulta médicos no MongoDB (mesmo banco do servidor).
 * Com npm run dev o bot sobe junto se TELEGRAM_BOT_TOKEN estiver no .env.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../../config/db.js';
import { checkMedicosMongo, startTelegramMedicosBot } from './telegramMedicosBot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Defina TELEGRAM_BOT_TOKEN no server/.env');
  process.exit(1);
}

await connectDB();
const check = await checkMedicosMongo();
if (!check.ok) {
  console.error(check.error);
  process.exit(1);
}

console.log(
  `PulseFlow: ${check.pulse.toLocaleString('pt-BR')} | CNES: ${check.cnes.toLocaleString('pt-BR')}`
);
startTelegramMedicosBot();
