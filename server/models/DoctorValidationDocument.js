import mongoose from 'mongoose';

const doctorValidationDocumentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, enum: ['crm', 'document_with_photo', 'other', 'state_license', 'npi_proof'] },
  url: { type: String, required: true },
  publicId: { type: String },
  originalName: { type: String },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const DoctorValidationDocument = mongoose.model('DoctorValidationDocument', doctorValidationDocumentSchema);
export default DoctorValidationDocument;
