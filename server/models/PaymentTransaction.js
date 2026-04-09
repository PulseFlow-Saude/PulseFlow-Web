import mongoose from 'mongoose';

/**
 * Registo de pagamento (plano médico). Valores alinhados às taxas em PlatformSettings.
 */
const paymentTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, default: '', trim: true },
    userNome: { type: String, default: '', trim: true },
    amountGross: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BRL', trim: true, uppercase: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
    method: { type: String, enum: ['card', 'pix'], required: true },
    cardLast4: { type: String, default: '' },
    cardModality: { type: String, enum: ['credit', 'debit', ''], default: '' },
    pixKeyType: { type: String, default: '' },
    platformFeePercent: { type: Number, default: 0 },
    gatewayFeePercent: { type: Number, default: 0 },
    platformFeeAmount: { type: Number, default: 0 },
    gatewayFeeAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['completed', 'refunded', 'void'], default: 'completed', index: true }
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ createdAt: -1 });

const PaymentTransaction =
  mongoose.models.PaymentTransaction || mongoose.model('PaymentTransaction', paymentTransactionSchema);

export default PaymentTransaction;
