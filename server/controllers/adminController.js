import User from '../models/User.js';
import DoctorValidationDocument from '../models/DoctorValidationDocument.js';
import ValidationHistory from '../models/ValidationHistory.js';

export const listDoctorsByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { $nor: [{ role: 'admin' }, { isAdmin: true }] };
    if (status) {
          filter.validationStatus = status;
    }
    const doctors = await User.find(filter)
      .select('nome email cpf crm areaAtuacao validationStatus validationSubmittedAt validationDeniedReason createdAt')
      .sort({ validationSubmittedAt: -1, createdAt: -1 })
      .lean();
    const normalized = doctors.map(d => ({
      ...d,
      validationStatus: d.validationStatus || 'pending_complement'
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar médicos', error: error.message });
  }
};

export const getDoctorDetail = async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id)
      .select('-senha -otp -otpExpires -fcmToken')
      .lean();
    if (!doctor) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }
    if (doctor.isAdmin === true || doctor.role === 'admin') {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    const documents = await DoctorValidationDocument.find({ user: req.params.id }).sort({ uploadedAt: -1 }).lean();
    const history = await ValidationHistory.find({ user: req.params.id }).sort({ decidedAt: -1 }).lean();

    res.json({ doctor, documents, history });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar detalhes', error: error.message });
  }
};

export const approveDoctor = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isAdmin === true || user.role === 'admin') {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    user.validationStatus = 'approved';
    user.validationDeniedReason = undefined;
    await user.save();

    await ValidationHistory.create({
      user: user._id,
      status: 'approved',
      decidedBy: req.user._id,
      decidedAt: new Date()
    });

    res.json({ message: 'Solicitação aprovada com sucesso.', validationStatus: 'approved' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erro ao aprovar' });
  }
};

export const denyDoctor = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 10) {
      return res.status(400).json({ message: 'O motivo da recusa é obrigatório (mínimo 10 caracteres).' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.isAdmin === true || user.role === 'admin') {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    user.validationStatus = 'denied';
    user.validationDeniedReason = String(reason).trim();
    await user.save();

    await ValidationHistory.create({
      user: user._id,
      status: 'denied',
      reason: String(reason).trim(),
      decidedBy: req.user._id,
      decidedAt: new Date()
    });

    res.json({ message: 'Solicitação negada. O médico foi notificado do motivo.', validationStatus: 'denied' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erro ao negar' });
  }
};
