import {
  findPacienteByIdentifier,
  invalidIdentifierMessage,
  parsePatientIdentifier,
  resolveIdentifierFromRequest,
} from './patientIdentifier.js';

export function collectIdentifierFromRequest(req) {
  return resolveIdentifierFromRequest({
    ...req.query,
    ...req.body,
    cpf: req.query?.cpf ?? req.params?.cpf ?? req.body?.cpf,
    ssn: req.query?.ssn ?? req.params?.ssn ?? req.body?.ssn,
    identifier: req.query?.identifier ?? req.params?.identifier ?? req.body?.identifier,
  });
}

export async function lookupPacienteFromRequest(req) {
  if (req.paciente) return req.paciente;

  const pacienteId =
    req.query?.pacienteId ?? req.params?.pacienteId ?? req.body?.pacienteId;
  if (pacienteId) {
    const Paciente = (await import('../models/Paciente.js')).default;
    return Paciente.findById(pacienteId);
  }

  const raw = collectIdentifierFromRequest(req);
  if (!raw) return null;
  return findPacienteByIdentifier(raw);
}

export async function requirePacienteFromRequest(req, res) {
  const raw = collectIdentifierFromRequest(req);
  if (!raw) {
    res.status(400).json({
      message: 'Identificador do paciente é obrigatório (CPF ou SSN).',
    });
    return null;
  }

  const parsed = parsePatientIdentifier(raw);
  if (!parsed.valid) {
    res.status(400).json({ message: invalidIdentifierMessage() });
    return null;
  }

  const paciente = await lookupPacienteFromRequest(req);
  if (!paciente) {
    res.status(404).json({ message: 'Paciente não encontrado' });
    return null;
  }

  return paciente;
}
