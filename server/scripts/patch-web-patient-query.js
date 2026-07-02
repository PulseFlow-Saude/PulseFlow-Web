import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsDir = path.join(__dirname, '../../client/public/js');

function patchFile(file, transforms) {
  const p = path.join(jsDir, file);
  if (!fs.existsSync(p)) {
    console.log('missing', file);
    return;
  }
  let c = fs.readFileSync(p, 'utf8');
  const before = c;
  for (const [from, to] of transforms) {
    c = c.split(from).join(to);
  }
  if (c !== before) {
    fs.writeFileSync(p, c);
    console.log('patched', file);
  } else {
    console.log('unchanged', file);
  }
}

const vitalsImport =
  "import { validateActivePatient, redirectToPatientSelection, handleApiError, buildPatientQueryParam, buildPatientQueryParamFromObject } from './utils/patientValidation.js';";

const vitalsCpfBlock = `        const cpf = paciente.cpf?.replace(/[^\\d]/g, '');

        if (!cpf) {
            console.log('Dados do paciente:', paciente);
            mostrarErro(tx("CPF não encontrado no paciente selecionado.", "Patient CPF not found."));
            return null;
        }

        console.log(\`Buscando dados`;

const vitalsPatientQueryBlock = `        const patientQuery = buildPatientQueryParamFromObject(paciente) || buildPatientQueryParam();
        if (!patientQuery) {
            console.log('Dados do paciente:', paciente);
            mostrarErro(tx("Identificador do paciente não encontrado.", "Patient identifier not found."));
            return null;
        }

        console.log(\`Buscando dados`;

for (const file of ['pressaoArterial.js', 'batimentosCardiacos.js', 'contagemPassos.js']) {
  patchFile(file, [
    [
      "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
      vitalsImport,
    ],
    [vitalsCpfBlock, vitalsPatientQueryBlock],
    ['medico?cpf=${cpf}&month=', 'medico?${patientQuery}&month='],
  ]);
}

// insonia / enxaqueca: replace decoded cpf fetch URLs
for (const file of ['insonia.js', 'enxaqueca.js']) {
  patchFile(file, [
    [
      "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
      "import { validateActivePatient, redirectToPatientSelection, handleApiError, buildPatientQueryParam } from './utils/patientValidation.js';",
    ],
    ['medico?cpf=${cpf}&month=', 'medico?${buildPatientQueryParam()}&month='],
  ]);
}

patchFile('cicloMenstrual.js', [
  ['medico?cpf=${cpf}`', 'medico?${buildPatientQueryParam()}`'],
]);
patchFile('historicoCriseGastrite.js', [
  ['medico?cpf=${cpf}`', 'medico?${buildPatientQueryParam()}`'],
]);
patchFile('historicoEventoClinico.js', [
  ['medico?cpf=${cpf}`', 'medico?${buildPatientQueryParam()}`'],
  [
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, getPatientCPF } from './utils/patientValidation.js';",
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, getPatientCPF, buildPatientQueryParam } from './utils/patientValidation.js';",
  ],
]);
patchFile('historicoResumos.js', [
  [
    `    const cpf = paciente.cpf?.replace(/[^\\d]/g, '');
    if (!cpf) {
      mostrarErro(t('historicoResumos.cpfNotFound'));
      return;
    }

    console.log(\`Buscando resumos para CPF: \${cpf}\`);

    const response = await fetch(\`\${API_URL}/api/resumo-consulta/paciente?cpf=\${cpf}\`,`,
    `    const patientQuery = buildPatientQueryParamFromObject(paciente) || buildPatientQueryParam();
    if (!patientQuery) {
      mostrarErro(t('historicoResumos.cpfNotFound'));
      return;
    }

    const response = await fetch(\`\${API_URL}/api/resumo-consulta/paciente?\${patientQuery}\`,`,
  ],
]);

patchFile('anexoExame.js', [
  [
    "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, buildPatientQueryParam, buildPatientBodyFields } from './utils/patientValidation.js';",
  ],
  [
    `    const cpfPaciente = validation.cpf;
    const response = await fetch(\`\${API_URL}/api/anexoExame/medico?cpf=\${cpfPaciente}\`,`,
    `    const patientQuery = buildPatientQueryParam();
    const response = await fetch(\`\${API_URL}/api/anexoExame/medico?\${patientQuery}\`,`,
  ],
  ['formData.append(\'cpf\', validation.cpf);', 'Object.entries(buildPatientBodyFields(validation)).forEach(([k, v]) => formData.append(k, v));'],
]);

patchFile('criarAnotacao.js', [
  [
    "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, buildPatientBodyFields } from './utils/patientValidation.js';",
  ],
  ['cpf: validation.cpf,', '...buildPatientBodyFields(validation),'],
]);

patchFile('RegistroDoEventoClinico.js', [
  [
    "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, buildPatientBodyFields } from './utils/patientValidation.js';",
  ],
  ['cpfPaciente: validation.cpf,', '...buildPatientBodyFields(validation),'],
]);

patchFile('historicoAnotacao.js', [
  [
    "import { validateActivePatient, redirectToPatientSelection, handleApiError } from './utils/patientValidation.js';",
    "import { validateActivePatient, redirectToPatientSelection, handleApiError, getPatientPathSegment } from './utils/patientValidation.js';",
  ],
  ['await carregarRegistros(validation.cpf);', 'await carregarRegistros(getPatientPathSegment());'],
  [
    `  if (paciente?.cpf) {
    await carregarRegistros(paciente.cpf);`,
    `  const pathId = getPatientPathSegment();
  if (pathId) {
    await carregarRegistros(pathId);`,
  ],
]);

patchFile('menstruacao.js', [
  ['api/ciclo/medico?cpf=${cpf}`', 'api/ciclo/medico?${buildPatientQueryParam()}`'],
  [
    'api/ciclo/medico?cpf=${paciente.cpf}`',
    'api/ciclo/medico?${buildPatientQueryParamFromObject(paciente)}`',
  ],
]);

patchFile('hormonal.js', [
  [
    `      const cpf = pacienteSelecionado?.cpf || decodedPayload?.cpf?.replace(/[^\\d]/g, '');

      if (!pacienteId && !cpf) {`,
    `      const idFields = buildPatientBodyFields(pacienteSelecionado || decodedPayload);

      if (!pacienteId && !idFields.cpf && !idFields.ssn) {`,
  ],
  [
    `      } else if (cpf) {
        params.append('cpf', cpf);`,
    `      } else if (idFields.cpf) {
        params.append('cpf', idFields.cpf);
      } else if (idFields.ssn) {
        params.append('ssn', idFields.ssn);`,
  ],
]);

console.log('patch complete');
