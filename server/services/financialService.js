/**
 * Cálculos de taxas e criação de transações (sem gateway externo).
 */

import PaymentTransaction from '../models/PaymentTransaction.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Mesma lógica do dashboard admin: líquido = bruto × (1−p%) × (1−g%).
 */
export function computeFees(amountGross, platformFeePct, gatewayFeePct) {
  const p = Math.min(100, Math.max(0, Number(platformFeePct) || 0));
  const g = Math.min(100, Math.max(0, Number(gatewayFeePct) || 0));
  const afterPlatform = amountGross * (1 - p / 100);
  const gatewayFeeAmount = round2(afterPlatform * (g / 100));
  const platformFeeAmount = round2(amountGross - afterPlatform);
  const netAmount = round2(amountGross - platformFeeAmount - gatewayFeeAmount);
  return { platformFeeAmount, gatewayFeeAmount, netAmount, platformFeePercent: p, gatewayFeePercent: g };
}

export async function recordPaymentTransaction({
  userDoc,
  settings,
  billingCycle,
  method,
  payload
}) {
  const currency = String(settings.currency || 'BRL')
    .trim()
    .toUpperCase();
  const ccy = currency === 'USD' ? 'USD' : 'BRL';

  const pm = Math.max(0, Number(settings.paidMonthlyPrice) || 0);
  const py = Math.max(0, Number(settings.paidYearlyPrice) || 0);
  const amountGross = billingCycle === 'yearly' ? py : pm;
  if (amountGross <= 0) {
    throw new Error('Preço do plano não configurado para o período escolhido.');
  }

  const fees = computeFees(amountGross, settings.platformFeePercent, settings.paymentGatewayFeePercent);

  let cardLast4 = '';
  let cardModality = '';
  let pixKeyType = '';

  if (method === 'card' && payload?.card) {
    const num = String(payload.card.number || '').replace(/\D/g, '');
    cardLast4 = num.slice(-4);
    cardModality = payload.card.modality === 'debit' ? 'debit' : 'credit';
  } else if (method === 'pix' && payload?.pix) {
    pixKeyType = String(payload.pix.type || '').slice(0, 32);
  }

  const tx = await PaymentTransaction.create({
    user: userDoc._id,
    userEmail: userDoc.email || '',
    userNome: userDoc.nome || '',
    amountGross,
    currency: ccy,
    billingCycle,
    method,
    cardLast4,
    cardModality,
    pixKeyType,
    platformFeePercent: fees.platformFeePercent,
    gatewayFeePercent: fees.gatewayFeePercent,
    platformFeeAmount: fees.platformFeeAmount,
    gatewayFeeAmount: fees.gatewayFeeAmount,
    netAmount: fees.netAmount,
    status: 'completed'
  });

  return tx;
}
