import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },
    trialDaysDefault: { type: Number, default: 14, min: 1, max: 365 },
    paidMonthlyPrice: { type: Number, default: 0, min: 0 },
    paidYearlyPrice: { type: Number, default: 0, min: 0 },
    yearlyDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    platformFeePercent: { type: Number, default: 0, min: 0, max: 100 },
    paymentGatewayFeePercent: { type: Number, default: 0, min: 0, max: 100 },
    currency: { type: String, default: 'BRL', trim: true, maxlength: 8 },
    notes: { type: String, default: '', maxlength: 4000 },
    /** Evita novo seed automático depois que o admin salvou em Planos e taxas */
    referencePricingSeeded: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

const REF_MONTHLY_BRL = 149.9;
const REF_YEARLY_BRL = 1499;

export async function getOrCreatePlatformSettings() {
  let doc = await PlatformSettings.findOne({ key: 'default' });
  if (!doc) {
    doc = await PlatformSettings.create({ key: 'default' });
  }
  const pm = doc.paidMonthlyPrice;
  const py = doc.paidYearlyPrice;
  const bothZero =
    (pm === 0 || pm === null || pm === undefined) &&
    (py === 0 || py === null || py === undefined);
  if (bothZero && !doc.referencePricingSeeded) {
    doc.paidMonthlyPrice = REF_MONTHLY_BRL;
    doc.paidYearlyPrice = REF_YEARLY_BRL;
    doc.referencePricingSeeded = true;
    await doc.save();
  }
  return doc;
}

export default PlatformSettings;
