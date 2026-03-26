import mongoose from 'mongoose';
import User from '../models/User.js';
import { isAdminUserDoc, filterUsersWhoAreNotAdmins } from '../utils/userAdminFlags.js';
import DoctorValidationDocument from '../models/DoctorValidationDocument.js';
import ValidationHistory from '../models/ValidationHistory.js';
import Notification from '../models/Notification.js';

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/** Base pública da API (proxy / HTTPS). */
function getRequestBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${process.env.PORT || process.env.PORT_BACKEND || 65432}`;
  return `${proto}://${host}`;
}

/** Garante URL absoluta para o admin abrir/pré-visualizar (evita /uploads no host errado). */
function normalizeMediaUrl(url, req) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  const base = getRequestBaseUrl(req);
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAdminDoctorListFilter({ status, q }) {
  const and = [filterUsersWhoAreNotAdmins()];
  if (status) {
    and.push({ validationStatus: status });
  }
  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    and.push({
      $or: [
        { nome: rx },
        { email: rx },
        { crm: rx },
        { cpf: rx }
      ]
    });
  }
  return { $and: and };
}

/** Contadores por status (todos os médicos não-admin) — para o painel */
export const getDoctorsStats = async (req, res) => {
  try {
    const match = filterUsersWhoAreNotAdmins();
    const rows = await User.aggregate([
      { $match: match },
      { $group: { _id: '$validationStatus', count: { $sum: 1 } } }
    ]);
    const byStatus = {
      pending_complement: 0,
      under_review: 0,
      denied: 0,
      approved: 0
    };
    let total = 0;
    for (const r of rows) {
      const key = r._id == null ? 'pending_complement' : String(r._id);
      if (key in byStatus) {
        byStatus[key] = r.count;
      } else {
        byStatus.pending_complement += r.count;
      }
      total += r.count;
    }
    res.json({ total, byStatus });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: error.message });
  }
};

export const listDoctorsByStatus = async (req, res) => {
  try {
    const { status, q, sort: sortParam, order: orderParam } = req.query;
    const filter = buildAdminDoctorListFilter({ status, q });

    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 12));
    const total = await User.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    let page = Math.max(1, parseInt(req.query.page, 10) || 1);
    if (page > totalPages) page = totalPages;
    const skip = (page - 1) * limit;

    const order = orderParam === 'asc' ? 1 : -1;
    let sortObj = { validationSubmittedAt: -1, createdAt: -1 };
    if (sortParam === 'nome') sortObj = { nome: order };
    else if (sortParam === 'email') sortObj = { email: order };
    else if (sortParam === 'crm') sortObj = { crm: order };
    else if (sortParam === 'status') sortObj = { validationStatus: order };
    else if (sortParam === 'enviado') sortObj = { validationSubmittedAt: order, createdAt: order };

    const doctors = await User.find(filter)
      .select('nome email cpf crm areaAtuacao validationStatus validationSubmittedAt validationDeniedReason createdAt')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    const normalized = doctors.map(d => ({
      ...d,
      validationStatus: d.validationStatus || 'pending_complement'
    }));

    res.json({
      items: normalized,
      total,
      page,
      limit,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar médicos', error: error.message });
  }
};

export const getDoctorDetail = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const doctor = await User.findById(oid)
      .select('-senha -otp -otpExpires -fcmToken')
      .lean();
    if (!doctor) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }
    if (isAdminUserDoc(doctor)) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    // user no schema é ObjectId — consulta explícita por ObjectId evita falha de match
    const documents = await DoctorValidationDocument.find({ user: oid })
      .sort({ uploadedAt: -1 })
      .lean();

    const normalizedDocs = documents.map((d) => ({
      _id: d._id,
      type: d.type,
      url: normalizeMediaUrl(d.url || '', req),
      publicId: d.publicId,
      originalName: d.originalName,
      uploadedAt: d.uploadedAt,
      createdAt: d.createdAt
    }));

    const historyRaw = await ValidationHistory.find({ user: oid })
      .sort({ decidedAt: -1 })
      .populate('decidedBy', 'nome email')
      .lean();

    const history = historyRaw.map((h) => ({
      _id: h._id,
      status: h.status,
      reason: h.reason || null,
      decidedAt: h.decidedAt,
      decidedBy: h.decidedBy
        ? { nome: h.decidedBy.nome, email: h.decidedBy.email }
        : null
    }));

    res.json({ doctor, documents: normalizedDocs, history });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar detalhes', error: error.message });
  }
};

export const approveDoctor = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const user = await User.findById(oid);
    if (!user || isAdminUserDoc(user)) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    if (user.validationStatus !== 'under_review') {
      return res.status(400).json({
        message: 'Só é possível aprovar solicitações com status "Em análise".'
      });
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

    await Notification.create({
      user: user._id,
      userModel: 'User',
      title: 'Cadastro aprovado',
      description: 'Seu cadastro foi aprovado. Escolha seu plano para liberar o acesso completo.',
      type: 'updates',
      link: '/client/views/escolhaPlano.html',
      unread: true
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

    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const user = await User.findById(oid);
    if (!user || isAdminUserDoc(user)) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    if (user.validationStatus !== 'under_review') {
      return res.status(400).json({
        message: 'Só é possível negar solicitações com status "Em análise".'
      });
    }

    const trimmed = String(reason).trim();
    user.validationStatus = 'denied';
    user.validationDeniedReason = trimmed;
    await user.save();

    await ValidationHistory.create({
      user: user._id,
      status: 'denied',
      reason: trimmed,
      decidedBy: req.user._id,
      decidedAt: new Date()
    });

    await Notification.create({
      user: user._id,
      userModel: 'User',
      title: 'Cadastro não aprovado',
      description: `Motivo informado pela equipe: ${trimmed}`,
      type: 'updates',
      link: '/client/views/perfilMedico.html',
      unread: true
    });

    res.json({
      message: 'Solicitação negada. O médico foi notificado no sistema.',
      validationStatus: 'denied'
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erro ao negar' });
  }
};
