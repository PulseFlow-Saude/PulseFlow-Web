import { validateActivePatient, redirectToPatientSelection } from './utils/patientValidation.js';

/**
 * Garante paciente ativo na sessão. Redireciona para selecao.html em falha.
 * @returns {object|null} Resultado de validateActivePatient ou null se redirecionou.
 */
export function ensureActivePatient() {
  const validation = validateActivePatient();
  if (!validation.valid) {
    redirectToPatientSelection(validation.error);
    return null;
  }
  return validation;
}
