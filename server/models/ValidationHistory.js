import mongoose from 'mongoose';

const validationHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, required: true, enum: ['pending_complement', 'under_review', 'denied', 'approved'] },
  reason: { type: String },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ValidationHistory = mongoose.model('ValidationHistory', validationHistorySchema);
export default ValidationHistory;
