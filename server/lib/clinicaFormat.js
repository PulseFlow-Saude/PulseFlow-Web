/** Saída mínima: nome, endereço, telefone, e-mail. */
export function formatClinicaSimples({ nome, endereco, telefone, email }) {
  return [
    `Nome: ${nome || '—'}`,
    `Endereço: ${endereco || '—'}`,
    `Telefone: ${telefone || '—'}`,
    `E-mail: ${email || '—'}`
  ].join('\n');
}
