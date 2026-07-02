import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const files = [
  'controllers/cicloController.js',
  'controllers/criseGastriteController.js',
  'controllers/eventoClinicoController.js',
];

const lookupBlock =
  /let paciente = await Paciente\.findOne\(\{ cpf: cpf\?\.replace\(\/\\\[\\^\\d\\\]\/g, ''\) \}\);[\s\S]*?if \(!paciente\) \{[\s\S]*?paciente = await Paciente\.findOne\(\{ cpf: cpf \}\);[\s\S]*?\}/g;

const replacement = `let paciente = req.paciente || (await findPacienteByIdentifier(cpf));`;

for (const f of files) {
  const p = path.join(root, f);
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('findPacienteByIdentifier')) {
    c = c.replace(
      "import Paciente from '../models/Paciente.js';",
      "import Paciente from '../models/Paciente.js';\nimport { findPacienteByIdentifier } from '../utils/patientIdentifier.js';"
    );
  }
  const before = c;
  c = c.replace(lookupBlock, replacement);
  c = c.replace(
    /const paciente = await Paciente\.findOne\(\{ cpf: cpfPaciente\.replace\(\/\\\[\\^\\d\\\]\/g, ''\) \}\);/g,
    'const paciente = req.paciente || (await findPacienteByIdentifier(cpfPaciente));'
  );
  if (c !== before) {
    fs.writeFileSync(p, c);
    console.log('updated', f);
  } else {
    console.log('skipped', f);
  }
}
