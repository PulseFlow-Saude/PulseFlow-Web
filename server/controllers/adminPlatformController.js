import mongoose from 'mongoose';
import User from '../models/User.js';
import Paciente from '../models/Paciente.js';
import DoctorValidationDocument from '../models/DoctorValidationDocument.js';
import ValidationHistory from '../models/ValidationHistory.js';
import Notification from '../models/Notification.js';
import Agendamento from '../models/Agendamento.js';
import HorarioDisponibilidade from '../models/HorarioDisponibilidade.js';
import ConexaoMedicoPaciente from '../models/ConexaoMedicoPaciente.js';
import ResumoConsulta from '../models/ResumoConsulta.js';
import CicloMenstrual from '../models/CicloMenstrual.js';
import AnotacaoMedica from '../models/AnotacaoMedica.js';
import Diabetes from '../models/Diabetes.js';
import Passos from '../models/Passos.js';
import BatimentosCardiacos from '../models/BatimentosCardiacos.js';
import PressaoArterial from '../models/PressaoArterial.js';
import Enxaqueca from '../models/Enxaqueca.js';
import Hormonal from '../models/Hormonal.js';
import Insonia from '../models/Insonia.js';
import EventoClinico from '../models/EventoClinico.js';
import Exame from '../models/AnexoExame.js';
import SolicitacaoAcesso from '../models/SolicitacaoAcesso.js';
import { Menstruacao } from '../models/menstruacaoModel.js';
import { CriseGastrite } from '../models/criseGastriteModel.js';
import {
  isAdminUserDoc,
  filterUsersWhoAreNotAdmins,
  filterUsersWhoAreAdmins
} from '../utils/userAdminFlags.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';
import PaymentTransaction from '../models/PaymentTransaction.js';

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function planSummary(u) {
  if (isAdminUserDoc(u)) {
    return { kind: 'admin', label: 'Administrador (acesso total)' };
  }
  if (!u.hasChosenPlan) {
    return { kind: 'none', label: 'Plano não escolhido' };
  }
  if (u.planChoice === 'paid') {
    return { kind: 'paid', label: 'Plano pago (registrado)' };
  }
  if (u.planChoice === 'trial' || u.trialEndsAt) {
    const end = u.trialEndsAt ? new Date(u.trialEndsAt).toLocaleString('pt-BR') : '—';
    return { kind: 'trial', label: `Teste gratuito · até ${end}` };
  }
  return { kind: 'active', label: 'Acesso liberado (plano escolhido)' };
}

function normalizeUserListItem(u, type) {
  const ps = planSummary(u);
  return {
    _id: u._id,
    type,
    nome: u.nome || u.name || '—',
    email: u.email || '—',
    crm: u.crm || null,
    validationStatus: u.validationStatus || null,
    hasChosenPlan: !!u.hasChosenPlan,
    trialEndsAt: u.trialEndsAt || null,
    planChoice: u.planChoice || null,
    planLabel: ps.label,
    createdAt: u.createdAt || null
  };
}

function normalizePacienteListItem(p) {
  return {
    _id: p._id,
    type: 'paciente',
    nome: p.name || p.nome || '—',
    email: p.email || '—',
    crm: null,
    validationStatus: null,
    hasChosenPlan: null,
    trialEndsAt: null,
    planChoice: null,
    planLabel: 'Paciente (app)',
    createdAt: p.createdAt || null
  };
}

function internalError(res, message) {
  return res.status(500).json({ message });
}

/** Estatísticas gerais da plataforma */
export const getPlatformStats = async (req, res) => {
  try {
    const [medicos, admins, pacientes] = await Promise.all([
      User.countDocuments(filterUsersWhoAreNotAdmins()),
      User.countDocuments(filterUsersWhoAreAdmins()),
      Paciente.countDocuments({})
    ]);
    res.json({
      totalUsers: medicos + admins + pacientes,
      medicos,
      admins,
      pacientes
    });
  } catch (error) {
    return internalError(res, 'Erro ao obter estatísticas');
  }
};

function getLastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function seriesFromMonthAgg(rows, monthKeys) {
  const map = {};
  for (const r of rows) {
    if (r._id) map[String(r._id)] = r.count;
  }
  return monthKeys.map((k) => map[k] ?? 0);
}

function seriesFromMonthMoney(rows, monthKeys, field) {
  const map = {};
  for (const r of rows) {
    if (r._id != null) map[String(r._id)] = Number(r[field]) || 0;
  }
  return monthKeys.map((k) => map[k] ?? 0);
}

/** Dashboard consolidado (visão geral, métricas, séries para gráficos e faturamento estimado) */
export const getAdminDashboard = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const monthKeys = getLastNMonthKeys(6);
    const [y0, m0] = monthKeys[0].split('-').map(Number);
    const periodStart = new Date(Date.UTC(y0, m0 - 1, 1));

    const [
      medicos,
      admins,
      pacientes,
      agendamentosTotal,
      agendamentosFuturos,
      medicosEmTrial,
      medicosPagantes,
      doctorsAgg,
      trialsExpiringSoon,
      settings,
      medicoMonthsAgg,
      pacienteMonthsAgg,
      agendamentoMonthsAgg,
      paymentTxMonthAgg,
      paymentTxTotals
    ] = await Promise.all([
      User.countDocuments(filterUsersWhoAreNotAdmins()),
      User.countDocuments(filterUsersWhoAreAdmins()),
      Paciente.countDocuments({}),
      Agendamento.countDocuments({}),
      Agendamento.countDocuments({ data: { $gte: todayStart } }),
      User.countDocuments({
        $and: [filterUsersWhoAreNotAdmins(), { planChoice: 'trial' }]
      }),
      User.countDocuments({
        $and: [filterUsersWhoAreNotAdmins(), { planChoice: 'paid' }]
      }),
      User.aggregate([
        { $match: filterUsersWhoAreNotAdmins() },
        { $group: { _id: '$validationStatus', count: { $sum: 1 } } }
      ]),
      User.countDocuments({
        $and: [
          filterUsersWhoAreNotAdmins(),
          { trialEndsAt: { $gte: new Date(), $lte: in7d } }
        ]
      }),
      getOrCreatePlatformSettings(),
      User.aggregate([
        {
          $match: {
            $and: [filterUsersWhoAreNotAdmins(), { createdAt: { $gte: periodStart } }]
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        }
      ]),
      Paciente.aggregate([
        { $match: { createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        }
      ]),
      Agendamento.aggregate([
        { $match: { data: { $gte: periodStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$data' } },
            count: { $sum: 1 }
          }
        }
      ]),
      PaymentTransaction.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            gross: { $sum: '$amountGross' },
            net: { $sum: '$netAmount' }
          }
        }
      ]),
      PaymentTransaction.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalGross: { $sum: '$amountGross' },
            totalNet: { $sum: '$netAmount' },
            transactionCount: { $sum: 1 }
          }
        }
      ])
    ]);

    const byStatus = {
      pending_complement: 0,
      under_review: 0,
      denied: 0,
      approved: 0
    };
    for (const r of doctorsAgg) {
      const key = r._id == null ? 'pending_complement' : String(r._id);
      if (key in byStatus) byStatus[key] = r.count;
      else byStatus.pending_complement += r.count;
    }

    const medicosOutrosPlano = Math.max(0, medicos - medicosEmTrial - medicosPagantes);

    const pm = Number(settings.paidMonthlyPrice) || 0;
    const py = Number(settings.paidYearlyPrice) || 0;
    const ccy = settings.currency || 'BRL';
    const platformFeePct = Math.min(100, Math.max(0, Number(settings.platformFeePercent) || 0));
    const gatewayFeePct = Math.min(100, Math.max(0, Number(settings.paymentGatewayFeePercent) || 0));
    const estimatedMrrGross = pm * medicosPagantes;
    const estimatedArrGross = py * medicosPagantes;
    const factorNet = (1 - platformFeePct / 100) * (1 - gatewayFeePct / 100);
    const estimatedMrrNetAfterFees = estimatedMrrGross * factorNet;
    const estimatedArrNetAfterFees = estimatedArrGross * factorNet;

    res.json({
      users: {
        total: medicos + admins + pacientes,
        medicos,
        admins,
        pacientes
      },
      validation: {
        byStatus,
        totalMedicos: medicos
      },
      agendamentos: {
        total: agendamentosTotal,
        fromTodayOnward: agendamentosFuturos
      },
      plans: {
        medicosEmTrial,
        medicosPagantes,
        trialsExpiringWithin7Days: trialsExpiringSoon
      },
      settingsSnapshot: {
        trialDaysDefault: settings.trialDaysDefault,
        currency: ccy,
        paidMonthlyPrice: pm,
        paidYearlyPrice: py,
        platformFeePercent: Number(settings.platformFeePercent) || 0
      },
      financial: {
        currency: ccy,
        estimatedMrr: estimatedMrrGross,
        estimatedMrrGross,
        estimatedMrrNetAfterFees,
        estimatedArrFromYearly: estimatedArrGross,
        estimatedArrGross,
        estimatedArrNetAfterFees,
        platformFeePercent: platformFeePct,
        gatewayFeePercent: gatewayFeePct,
        paidMonthlyPrice: pm,
        paidYearlyPrice: py,
        medicosPagantes,
        note:
          'Valores baseados nos preços configurados em Planos e taxas × médicos com plano pago. Não substitui extrato financeiro real.'
      },
      financialReal: (() => {
        const tot = paymentTxTotals[0] || {};
        return {
          currency: ccy,
          totalGross: Number(tot.totalGross) || 0,
          totalNet: Number(tot.totalNet) || 0,
          transactionCount: Number(tot.transactionCount) || 0,
          grossByMonth: seriesFromMonthMoney(paymentTxMonthAgg, monthKeys, 'gross'),
          netByMonth: seriesFromMonthMoney(paymentTxMonthAgg, monthKeys, 'net'),
          note:
            'Receita registrada nas transações de checkout confirmadas (sem gateway de pagamento externo).'
        };
      })(),
      analytics: {
        months: monthKeys,
        medicosSignupsByMonth: seriesFromMonthAgg(medicoMonthsAgg, monthKeys),
        pacientesSignupsByMonth: seriesFromMonthAgg(pacienteMonthsAgg, monthKeys),
        agendamentosByMonth: seriesFromMonthAgg(agendamentoMonthsAgg, monthKeys),
        planDistribution: {
          trial: medicosEmTrial,
          paid: medicosPagantes,
          other: medicosOutrosPlano
        }
      }
    });
  } catch (error) {
    return internalError(res, 'Erro ao obter dashboard');
  }
};

/** Lista unificada com paginação (merge em memória quando type=all) */
export const listPlatformUsers = async (req, res) => {
  try {
    const type = String(req.query.type || 'all').toLowerCase();
    const q = req.query.q && String(req.query.q).trim() ? String(req.query.q).trim() : '';
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
    let page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const rx = q ? new RegExp(escapeRegex(q), 'i') : null;

    if (type === 'paciente') {
      const filter = rx
        ? {
            $or: [{ name: rx }, { email: rx }, { cpf: rx }, { phone: rx }]
          }
        : {};
      const total = await Paciente.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      if (page > totalPages) page = totalPages;
      const skip = (page - 1) * limit;
      const rows = await Paciente.find(filter)
        .select('name nome email cpf phone createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return res.json({
        items: rows.map(normalizePacienteListItem),
        total,
        page,
        limit,
        totalPages
      });
    }

    if (type === 'medico') {
      const filter = rx
        ? {
            $and: [filterUsersWhoAreNotAdmins(), { $or: [{ nome: rx }, { email: rx }, { crm: rx }, { cpf: rx }] }]
          }
        : filterUsersWhoAreNotAdmins();
      const total = await User.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      if (page > totalPages) page = totalPages;
      const skip = (page - 1) * limit;
      const rows = await User.find(filter)
        .select(
          'nome email crm validationStatus hasChosenPlan trialEndsAt planChoice createdAt role isAdmin'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return res.json({
        items: rows.map((u) => normalizeUserListItem(u, 'medico')),
        total,
        page,
        limit,
        totalPages
      });
    }

    if (type === 'admin') {
      const base = filterUsersWhoAreAdmins();
      const filter = rx
        ? {
            $and: [base, { $or: [{ nome: rx }, { email: rx }, { crm: rx }, { cpf: rx }] }]
          }
        : base;
      const total = await User.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      if (page > totalPages) page = totalPages;
      const skip = (page - 1) * limit;
      const rows = await User.find(filter)
        .select(
          'nome email crm validationStatus hasChosenPlan trialEndsAt planChoice createdAt role isAdmin'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return res.json({
        items: rows.map((u) => normalizeUserListItem(u, 'admin')),
        total,
        page,
        limit,
        totalPages
      });
    }

    // type === all — merge (limite por coleção para não estourar memória)
    const cap = 800;
    const uFilterMed = rx
      ? {
          $and: [filterUsersWhoAreNotAdmins(), { $or: [{ nome: rx }, { email: rx }, { crm: rx }, { cpf: rx }] }]
        }
      : filterUsersWhoAreNotAdmins();
    const uFilterAdm = rx
      ? {
          $and: [filterUsersWhoAreAdmins(), { $or: [{ nome: rx }, { email: rx }, { crm: rx }, { cpf: rx }] }]
        }
      : filterUsersWhoAreAdmins();
    const pFilter = rx
      ? { $or: [{ name: rx }, { email: rx }, { cpf: rx }, { phone: rx }] }
      : {};

    const [medRows, admRows, pacRows] = await Promise.all([
      User.find(uFilterMed)
        .select(
          'nome email crm validationStatus hasChosenPlan trialEndsAt planChoice createdAt role isAdmin'
        )
        .sort({ createdAt: -1 })
        .limit(cap)
        .lean(),
      User.find(uFilterAdm)
        .select(
          'nome email crm validationStatus hasChosenPlan trialEndsAt planChoice createdAt role isAdmin'
        )
        .sort({ createdAt: -1 })
        .limit(cap)
        .lean(),
      Paciente.find(
        rx
          ? {
              $or: [{ name: rx }, { email: rx }, { cpf: rx }, { phone: rx }]
            }
          : pFilter
      )
        .select('name nome email cpf phone createdAt')
        .sort({ createdAt: -1 })
        .limit(cap)
        .lean()
    ]);

    const merged = [
      ...medRows.map((u) => normalizeUserListItem(u, isAdminUserDoc(u) ? 'admin' : 'medico')),
      ...admRows.map((u) => normalizeUserListItem(u, 'admin')),
      ...pacRows.map(normalizePacienteListItem)
    ];
    merged.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    const total = merged.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) page = totalPages;
    const skip = (page - 1) * limit;
    const items = merged.slice(skip, skip + limit);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages,
      _note:
        total >= cap * 3
          ? 'Lista "Todos" limitada a amostras recentes por tipo; use o filtro por tipo para paginação completa.'
          : undefined
    });
  } catch (error) {
    return internalError(res, 'Erro ao listar usuários');
  }
};

export const getPlatformUserDetail = async (req, res) => {
  try {
    const { type } = req.params;
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ message: 'ID inválido.' });

    if (type === 'paciente') {
      const p = await Paciente.findById(oid).select('-password -twoFactorCode -passwordResetCode').lean();
      if (!p) return res.status(404).json({ message: 'Paciente não encontrado.' });
      return res.json({
        type: 'paciente',
        record: p,
        plan: null
      });
    }

    if (type === 'medico' || type === 'admin') {
      const u = await User.findById(oid).select('-senha -otp -otpExpires -fcmToken').lean();
      if (!u) return res.status(404).json({ message: 'Usuário não encontrado.' });
      const isAdm = isAdminUserDoc(u);
      if (type === 'medico' && isAdm) {
        return res.status(404).json({ message: 'Registro não encontrado para o tipo médico.' });
      }
      if (type === 'admin' && !isAdm) {
        return res.status(404).json({ message: 'Registro não encontrado para o tipo administrador.' });
      }
      return res.json({
        type: isAdm ? 'admin' : 'medico',
        record: u,
        plan: planSummary(u)
      });
    }

    return res.status(400).json({ message: 'Tipo inválido. Use medico, paciente ou admin.' });
  } catch (error) {
    return internalError(res, 'Erro ao buscar usuário');
  }
};

const MEDICO_PATCH = new Set([
  'nome',
  'email',
  'cpf',
  'telefonePessoal',
  'telefoneConsultorio',
  'crm',
  'areaAtuacao',
  'rqe',
  'cep',
  'enderecoConsultorio',
  'numeroConsultorio',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'genero',
  'validationStatus',
  'hasChosenPlan',
  'trialEndsAt',
  'planChoice'
]);

const PACIENTE_PATCH = new Set([
  'name',
  'email',
  'phone',
  'cpf',
  'birthDate',
  'gender',
  'nationality',
  'maritalStatus',
  'address',
  'secondaryPhone',
  'profession',
  'height',
  'weight',
  'emergencyContact',
  'emergencyPhone'
]);

export const patchPlatformUser = async (req, res) => {
  try {
    const { type } = req.params;
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ message: 'ID inválido.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (type === 'paciente') {
      const p = await Paciente.findById(oid);
      if (!p) return res.status(404).json({ message: 'Paciente não encontrado.' });
      if (body.email !== undefined && String(body.email).trim()) {
        const em = String(body.email).trim();
        const ex = await Paciente.findOne({ email: em, _id: { $ne: oid } });
        if (ex) return res.status(400).json({ message: 'E-mail já em uso por outro paciente.' });
        p.email = em;
      }
      for (const key of Object.keys(body)) {
        if (!PACIENTE_PATCH.has(key) || key === 'email') continue;
        p[key] = body[key];
      }
      await p.save();
      const lean = p.toObject();
      delete lean.password;
      return res.json({ message: 'Paciente atualizado.', record: lean });
    }

    if (type === 'medico' || type === 'admin') {
      const u = await User.findById(oid);
      if (!u) return res.status(404).json({ message: 'Usuário não encontrado.' });
      const isAdm = isAdminUserDoc(u);
      if (type === 'medico' && isAdm) {
        return res.status(400).json({ message: 'Use o tipo admin para editar este registro.' });
      }
      if (type === 'admin' && !isAdm) {
        return res.status(400).json({ message: 'Use o tipo medico para editar este registro.' });
      }

      if (body.email !== undefined && String(body.email).trim()) {
        const em = String(body.email).trim();
        const ex = await User.findOne({ email: em, _id: { $ne: oid } });
        if (ex) return res.status(400).json({ message: 'E-mail já em uso.' });
        u.email = em;
      }

      for (const key of Object.keys(body)) {
        if (!MEDICO_PATCH.has(key) || key === 'email') continue;
        if (key === 'trialEndsAt' || key === 'planChoice') continue;
        if (key === 'hasChosenPlan') {
          u.hasChosenPlan = Boolean(body[key]);
          continue;
        }
        if (key === 'rqe' && Array.isArray(body[key])) {
          u.rqe = body[key];
          continue;
        }
        u[key] = body[key];
      }

      if (Object.prototype.hasOwnProperty.call(body, 'planChoice')) {
        const pc = body.planChoice;
        if (pc === null || pc === '' || pc === undefined) {
          u.planChoice = undefined;
        } else if (pc === 'trial' || pc === 'paid') {
          u.planChoice = pc;
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'trialEndsAt')) {
        const te = body.trialEndsAt;
        if (te === null || te === '' || te === undefined) {
          u.trialEndsAt = undefined;
        } else {
          const d = new Date(te);
          if (!Number.isNaN(d.getTime())) {
            u.trialEndsAt = d;
          }
        }
      }

      if (u.planChoice === 'paid' || body.planChoice === 'paid') {
        u.trialEndsAt = undefined;
      }

      await u.save();
      const out = u.toObject();
      delete out.senha;
      delete out.otp;
      delete out.otpExpires;
      delete out.fcmToken;
      return res.json({ message: 'Usuário atualizado.', record: out, plan: planSummary(u) });
    }

    return res.status(400).json({ message: 'Tipo inválido.' });
  } catch (error) {
    return internalError(res, 'Erro ao atualizar');
  }
};

async function deletePatientCascade(oid) {
  const pid = oid;
  const pidStr = oid.toString();

  await Promise.all([
    Notification.deleteMany({ user: pid, userModel: 'Paciente' }),
    Agendamento.deleteMany({ pacienteId: pid }),
    ConexaoMedicoPaciente.deleteMany({ pacienteId: pid }),
    ResumoConsulta.deleteMany({ $or: [{ pacienteId: pid }, { pacienteId: pidStr }] }),
    CicloMenstrual.deleteMany({ pacienteId: pid }),
    AnotacaoMedica.deleteMany({ pacienteId: pid }),
    Diabetes.deleteMany({
      $or: [{ pacienteId: pid }, { paciente: pid }, { paciente: pidStr }]
    }),
    Passos.deleteMany({
      $or: [{ pacienteId: pid }, { paciente: pid }, { paciente: pidStr }]
    }),
    BatimentosCardiacos.deleteMany({
      $or: [{ pacienteId: pid }, { paciente: pid }, { paciente: pidStr }]
    }),
    PressaoArterial.deleteMany({
      $or: [{ pacienteId: pid }, { paciente: pid }, { paciente: pidStr }]
    }),
    Enxaqueca.deleteMany({ pacienteId: pid }),
    Hormonal.deleteMany({ $or: [{ paciente: pid }, { paciente: pidStr }] }),
    Insonia.deleteMany({ pacienteId: pidStr }),
    EventoClinico.deleteMany({ paciente: pid }),
    Exame.deleteMany({ paciente: pid }),
    SolicitacaoAcesso.deleteMany({ pacienteId: pidStr }),
    Menstruacao.deleteMany({ pacienteId: pid }),
    CriseGastrite.deleteMany({ paciente: pid })
  ]);
}

async function deleteMedicoCascade(oid) {
  await Promise.all([
    DoctorValidationDocument.deleteMany({ user: oid }),
    ValidationHistory.deleteMany({ user: oid }),
    ValidationHistory.deleteMany({ decidedBy: oid }),
    Notification.deleteMany({ user: oid, userModel: 'User' }),
    HorarioDisponibilidade.deleteMany({ medicoId: oid }),
    Agendamento.deleteMany({ medicoId: oid }),
    ConexaoMedicoPaciente.deleteMany({ medicoId: oid }),
    ResumoConsulta.deleteMany({ medicoId: oid })
  ]);
}

export const deletePlatformUser = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { type } = req.params;
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ message: 'ID inválido.' });

    if (String(oid) === String(adminId)) {
      return res.status(400).json({ message: 'Não é possível excluir a própria conta nesta sessão.' });
    }

    if (type === 'paciente') {
      const p = await Paciente.findById(oid);
      if (!p) return res.status(404).json({ message: 'Paciente não encontrado.' });
      await deletePatientCascade(oid);
      await Paciente.findByIdAndDelete(oid);
      return res.json({ message: 'Paciente e dados vinculados removidos.' });
    }

    if (type === 'medico') {
      const u = await User.findById(oid);
      if (!u) return res.status(404).json({ message: 'Usuário não encontrado.' });
      if (isAdminUserDoc(u)) {
        return res.status(400).json({ message: 'Este registro é administrador; use o tipo admin para excluir.' });
      }
      await deleteMedicoCascade(oid);
      await User.findByIdAndDelete(oid);
      return res.json({ message: 'Médico e dados vinculados removidos.' });
    }

    if (type === 'admin') {
      const u = await User.findById(oid);
      if (!u) return res.status(404).json({ message: 'Usuário não encontrado.' });
      if (!isAdminUserDoc(u)) {
        return res.status(400).json({ message: 'O registro não é administrador.' });
      }
      const admins = await User.countDocuments(filterUsersWhoAreAdmins());
      if (admins <= 1) {
        return res.status(400).json({ message: 'Não é possível excluir o único administrador da plataforma.' });
      }
      await Notification.deleteMany({ user: oid, userModel: 'User' });
      await User.findByIdAndDelete(oid);
      return res.json({ message: 'Administrador removido.' });
    }

    return res.status(400).json({ message: 'Tipo inválido.' });
  } catch (error) {
    return internalError(res, 'Erro ao excluir');
  }
};
