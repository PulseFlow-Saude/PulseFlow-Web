import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Diretório absoluto: `server/public/uploads` (independe do cwd do processo). */
export const UPLOADS_ROOT = path.join(__dirname, '..', 'public', 'uploads');
