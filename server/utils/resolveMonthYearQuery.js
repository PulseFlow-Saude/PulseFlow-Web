/**
 * Normaliza month/year da query string e devolve intervalo [startDate, endDate).
 * Se ausentes ou inválidos, usa o mês/ano correntes (evita Invalid Date → 500).
 */
export function resolveMonthYearQuery(query = {}) {
  const now = new Date();
  let month = Number.parseInt(String(query.month ?? ''), 10);
  let year = Number.parseInt(String(query.year ?? ''), 10);

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    year = now.getFullYear();
  }

  return {
    month,
    year,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 1)
  };
}
