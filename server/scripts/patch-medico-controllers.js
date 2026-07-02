import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const lookupBlock =
  /const \{ cpf \} = req\.query;[\s\S]*?if \(!paciente\) \{[\s\S]*?return res\.status\(404\)\.json\(\{ message: 'Paciente não encontrado' \}\);[\s\S]*?\}/;

const replacement = `const paciente = req.paciente;
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }`;

const files = [
  'controllers/enxaquecaController.js',
  'controllers/insoniaController.js',
  'controllers/pressaoArterialController.js',
  'controllers/batimentosCardiacosController.js',
  'controllers/passosController.js',
];

for (const f of files) {
  const p = path.join(root, f);
  let c = fs.readFileSync(p, 'utf8');
  const before = c;
  c = c.replace(lookupBlock, replacement);
  if (c !== before) {
    fs.writeFileSync(p, c);
    console.log('updated', f);
  } else {
    console.log('skipped', f);
  }
}

const hormonalPath = path.join(root, 'controllers/hormonalController.js');
let hormonal = fs.readFileSync(hormonalPath, 'utf8');
const hormonalBefore = hormonal;
hormonal = hormonal.replace(
  /export const buscarHormonalMedico[\s\S]*?if \(!paciente\) \{[\s\S]*?return res\.status\(404\)\.json\(\{ message: 'Paciente não encontrado' \}\);[\s\S]*?\}/m,
  `export const buscarHormonalMedico = async (req, res) => {
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    const paciente = req.paciente;
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }`
);
if (hormonal !== hormonalBefore) {
  fs.writeFileSync(hormonalPath, hormonal);
  console.log('updated hormonalController.js');
}
