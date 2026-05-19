import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';

const PATCHABLE = new Set([
  'trialDaysDefault',
  'paidMonthlyPrice',
  'paidYearlyPrice',
  'yearlyDiscountPercent',
  'platformFeePercent',
  'paymentGatewayFeePercent',
  'currency',
  'notes'
]);

function toPublicShape(doc) {
  const cur = String(doc.currency || 'BRL')
    .trim()
    .toUpperCase();
  return {
    trialDaysDefault: doc.trialDaysDefault,
    paidMonthlyPrice: doc.paidMonthlyPrice,
    paidYearlyPrice: doc.paidYearlyPrice,
    yearlyDiscountPercent: doc.yearlyDiscountPercent,
    currency: cur === 'USD' ? 'USD' : 'BRL'
  };
}

function internalError(res, message) {
  return res.status(500).json({ message });
}

/** Leitura pública (preços e duração do trial) — sem autenticação */
export const getPublicPlanSettings = async (req, res) => {
  try {
    const s = await getOrCreatePlatformSettings();
    res.json(toPublicShape(s));
  } catch (error) {
    return internalError(res, 'Erro ao carregar configurações de plano');
  }
};

export const getPlatformSettings = async (req, res) => {
  try {
    const s = await getOrCreatePlatformSettings();
    res.json(settingsPayload(s));
  } catch (error) {
    return internalError(res, 'Erro ao carregar configurações');
  }
};

export const patchPlatformSettings = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const s = await getOrCreatePlatformSettings();

    for (const key of Object.keys(body)) {
      if (!PATCHABLE.has(key)) continue;
      const v = body[key];
      if (key === 'notes') {
        if (v === null || v === undefined) s.notes = '';
        else s.notes = String(v).slice(0, 4000);
        continue;
      }
      if (key === 'currency') {
        const raw = String(v ?? '')
          .trim()
          .toUpperCase();
        s.currency = raw === 'USD' ? 'USD' : 'BRL';
        continue;
      }
      const n = Number(v);
      if (Number.isNaN(n)) continue;
      if (key === 'trialDaysDefault') {
        s.trialDaysDefault = Math.min(365, Math.max(1, Math.round(n)));
      } else if (key === 'paidMonthlyPrice' || key === 'paidYearlyPrice') {
        s[key] = Math.max(0, n);
      } else if (
        key === 'yearlyDiscountPercent' ||
        key === 'platformFeePercent' ||
        key === 'paymentGatewayFeePercent'
      ) {
        s[key] = Math.min(100, Math.max(0, n));
      }
    }

    if (Object.keys(body).some((k) => PATCHABLE.has(k))) {
      s.referencePricingSeeded = true;
    }

    await s.save();
    res.json({ message: 'Configurações atualizadas.', settings: settingsPayload(s) });
  } catch (error) {
    return internalError(res, 'Erro ao salvar configurações');
  }
};

function settingsPayload(s) {
  const cur = String(s.currency || 'BRL')
    .trim()
    .toUpperCase();
  return {
    trialDaysDefault: s.trialDaysDefault,
    paidMonthlyPrice: s.paidMonthlyPrice,
    paidYearlyPrice: s.paidYearlyPrice,
    yearlyDiscountPercent: s.yearlyDiscountPercent,
    platformFeePercent: s.platformFeePercent,
    paymentGatewayFeePercent: s.paymentGatewayFeePercent,
    currency: cur === 'USD' ? 'USD' : 'BRL',
    notes: s.notes,
    updatedAt: s.updatedAt
  };
}
