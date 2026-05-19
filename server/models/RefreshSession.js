import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    subjectModel: { type: String, enum: ['User', 'Paciente'], required: true, index: true },
    subjectEmail: { type: String, default: '' },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    createdByIp: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

refreshSessionSchema.index({ subjectId: 1, subjectModel: 1, revokedAt: 1, expiresAt: 1 });

const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);

export default RefreshSession;
