import Paciente from '../models/Paciente.js';

export const IDENTIFIER_TYPES = {
  CPF: 'cpf',
  SSN: 'ssn',
};

export const sanitizeDigits = (value = '') => String(value).replace(/\D/g, '');

export function parsePatientIdentifier(raw) {
  const digits = sanitizeDigits(raw);
  if (digits.length === 11) {
    return { type: IDENTIFIER_TYPES.CPF, digits, valid: true };
  }
  if (digits.length === 9) {
    return { type: IDENTIFIER_TYPES.SSN, digits, valid: true };
  }
  return { type: null, digits, valid: false };
}

export function resolveIdentifierFromRequest(source = {}) {
  if (source.identifier) return source.identifier;
  if (source.ssn) return source.ssn;
  if (source.cpf) return source.cpf;
  return null;
}

export function invalidIdentifierMessage() {
  return 'Informe um CPF válido (11 dígitos) ou SSN válido (9 dígitos).';
}

export async function findPacienteByIdentifier(rawIdentifier) {
  const parsed = parsePatientIdentifier(rawIdentifier);
  if (!parsed.valid) return null;

  if (parsed.type === IDENTIFIER_TYPES.CPF) {
    let paciente = await Paciente.findOne({ cpf: parsed.digits });
    if (!paciente) {
      const cpfFormatado = parsed.digits.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        '$1.$2.$3-$4'
      );
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
    }
    return paciente;
  }

  let paciente = await Paciente.findOne({ socialSecurityNumber: parsed.digits });
  if (paciente) return paciente;

  paciente = await Paciente.findOne({
    cpf: parsed.digits,
    residenceCountry: 'US',
  });
  if (paciente) return paciente;

  paciente = await Paciente.findOne({ cpf: parsed.digits });
  if (paciente && sanitizeDigits(paciente.cpf).length === 9) {
    return paciente;
  }

  return null;
}

export function getPatientLookupKey(paciente) {
  if (!paciente) return { type: null, value: '' };

  const residence = String(paciente.residenceCountry || '').toUpperCase();
  const ssn = sanitizeDigits(paciente.socialSecurityNumber || '');
  const cpf = sanitizeDigits(paciente.cpf || '');

  if (residence === 'US' && ssn.length === 9) {
    return { type: IDENTIFIER_TYPES.SSN, value: ssn };
  }
  if (cpf.length === 11) {
    return { type: IDENTIFIER_TYPES.CPF, value: cpf };
  }
  if (ssn.length === 9) {
    return { type: IDENTIFIER_TYPES.SSN, value: ssn };
  }
  if (cpf.length === 9) {
    return { type: IDENTIFIER_TYPES.SSN, value: cpf };
  }

  return { type: IDENTIFIER_TYPES.CPF, value: cpf };
}

export function formatSsnDisplay(digits = '') {
  const d = sanitizeDigits(digits).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function maskSsn(digits = '') {
  const d = sanitizeDigits(digits);
  if (d.length < 4) return '***-**-****';
  return `***-**-${d.slice(-4)}`;
}

export function buildPatientPublicProfile(paciente) {
  const lookup = getPatientLookupKey(paciente);
  return {
    id: paciente._id,
    nome: paciente.name || paciente.nome,
    cpf: paciente.cpf || '',
    socialSecurityNumber: paciente.socialSecurityNumber || '',
    residenceCountry: paciente.residenceCountry || null,
    identifierType: lookup.type,
    identifier: lookup.value,
    genero: paciente.gender || paciente.genero,
  };
}
