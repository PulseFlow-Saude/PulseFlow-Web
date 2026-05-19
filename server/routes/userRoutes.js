// routes/userRoutes.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import DoctorValidationDocument from '../models/DoctorValidationDocument.js';
import ValidationHistory from '../models/ValidationHistory.js';
import { cloudinaryUpload } from '../middlewares/cloudinaryUpload.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { isAdminUserDoc } from '../utils/userAdminFlags.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';
import { recordPaymentTransaction } from '../services/financialService.js';

const router = express.Router();

// Cloudinary configurado para uploads

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUf(value) {
  return normalizeText(value).toUpperCase();
}

function isValidUf(value) {
  return /^[A-Z]{2}$/.test(String(value || ''));
}

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || ''));
}

function isValidCrm(value) {
  return /^\d{4,6}$/.test(normalizeDigits(value));
}

function isValidNpi(value) {
  return /^\d{10}$/.test(normalizeDigits(value));
}

function isValidUsLicense(value) {
  return /^[A-Z0-9-]{5,15}$/.test(String(value || '').trim().toUpperCase());
}

function isValidZipByCountry(country, zipDigits) {
  if (country === 'US') {
    return zipDigits.length === 5 || zipDigits.length === 9;
  }
  return zipDigits.length === 8;
}

function internalError(res, message) {
  return res.status(500).json({ message });
}

router.get('/perfil', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Formatar a URL completa da foto se existir
    let fotoUrl = user.foto;
    if (fotoUrl && !fotoUrl.startsWith('http')) {
      fotoUrl = `${req.protocol}://${req.get('host')}${fotoUrl}`;
    }

    const isAdmin = isAdminUserDoc(user);
    const now = new Date();
    let planChoice = user.planChoice;
    let trialEndsAt = user.trialEndsAt ? user.trialEndsAt.toISOString() : null;
    let trialActive = false;
    let trialExpired = false;
    let trialMsRemaining = null;
    let trialDaysRemaining = null;

    if (isAdmin) {
      planChoice = planChoice || null;
      trialEndsAt = null;
    } else {
      const isPaid = planChoice === 'paid';
      if (isPaid) {
        trialEndsAt = null;
        trialActive = false;
        trialExpired = false;
      } else if (user.trialEndsAt) {
        const end = new Date(user.trialEndsAt);
        trialActive = end > now;
        trialExpired = end <= now;
        trialEndsAt = user.trialEndsAt.toISOString();
        if (trialActive) {
          trialMsRemaining = end.getTime() - now.getTime();
          trialDaysRemaining = Math.max(0, Math.ceil(trialMsRemaining / (24 * 60 * 60 * 1000)));
        }
        if (!planChoice && (trialActive || trialExpired)) {
          planChoice = 'trial';
        }
      }
    }

    res.json({
      country: user.country || 'BR',
      nome: user.nome,
      genero: user.genero,
      email: user.email,
      areaAtuacao: user.areaAtuacao,
      cpf: user.cpf,
      crm: user.crm,
      crmUf: user.crmUf || '',
      rqe: user.rqe,
      npi: user.npi,
      medicalLicenseNumber: user.medicalLicenseNumber,
      medicalLicenseState: user.medicalLicenseState,
      telefonePessoal: user.telefonePessoal,
      telefoneConsultorio: user.telefoneConsultorio,
      cep: user.cep,
      enderecoConsultorio: user.enderecoConsultorio,
      numeroConsultorio: user.numeroConsultorio,
      complemento: user.complemento,
      bairro: user.bairro,
      cidade: user.cidade,
      estado: user.estado,
      foto: fotoUrl,
      validationStatus: isAdmin ? 'approved' : (user.validationStatus || 'pending_complement'),
      validationDeniedReason: user.validationDeniedReason,
      validationSubmittedAt: user.validationSubmittedAt,
      hasChosenPlan: isAdmin ? true : user.hasChosenPlan,
      planChoice: isAdmin ? null : planChoice,
      paymentStatus: isAdmin ? 'paid' : (user.paymentStatus || 'none'),
      trialEndsAt,
      trialActive,
      trialExpired,
      trialMsRemaining,
      trialDaysRemaining,
      billingCycle: isAdmin ? null : user.billingCycle || null,
      subscriptionStartedAt: user.subscriptionStartedAt
        ? user.subscriptionStartedAt.toISOString()
        : null,
      lastPaymentAt: user.lastPaymentAt ? user.lastPaymentAt.toISOString() : null,
      nextRenewalAt: user.nextRenewalAt ? user.nextRenewalAt.toISOString() : null,
      role: isAdmin ? 'admin' : (user.role || 'medico'),
      isAdmin
    });
  } catch (error) {
    return internalError(res, 'Erro ao buscar perfil do usuário');
  }
});

// Listar documentos de validação do médico
router.get('/perfil/validation-documents', authMiddleware, async (req, res) => {
  try {
    const docs = await DoctorValidationDocument.find({ user: req.user._id })
      .sort({ uploadedAt: -1 })
      .lean();
    res.json(docs);
  } catch (error) {
    return internalError(res, 'Erro ao listar documentos');
  }
});

// Upload de documento para validação (CRM, documento com foto, outro)
router.post('/perfil/validation-documents',
  authMiddleware,
  cloudinaryUpload('validacao_documentos', 'auto', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Aceito apenas JPG, PNG ou PDF.'));
      }
    },
    fieldName: 'document'
  }),
  async (req, res) => {
    try {
      const type = req.body.type || req.body.documentType;
      if (!['crm', 'document_with_photo', 'other', 'state_license', 'npi_proof'].includes(type)) {
        return res.status(400).json({ message: 'Tipo de documento inválido.' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
      }

      const url = req.file.cloudinary?.secure_url || req.file.url;
      const publicId = req.file.cloudinary?.public_id;

      const doc = await DoctorValidationDocument.create({
        user: req.user._id,
        type,
        url,
        publicId,
        originalName: req.file.originalname
      });

      res.status(201).json(doc);
    } catch (error) {
      return internalError(res, 'Erro ao enviar documento');
    }
  }
);

// Enviar perfil para análise (status -> under_review)
router.post('/perfil/submit-validation', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    if (user.validationStatus === 'approved') {
      return res.status(400).json({ message: 'Sua conta já está aprovada.' });
    }

    const docs = await DoctorValidationDocument.find({ user: user._id }).lean();
    const isUS = user.country === 'US';

    if (isUS) {
      const hasLicense = docs.some(d => d.type === 'state_license');
      const hasPhotoDoc = docs.some(d => d.type === 'document_with_photo');
      if (!hasLicense || !hasPhotoDoc) {
        return res.status(400).json({
          message: 'É obrigatório anexar o comprovante de licença estadual (US) e um documento oficial com foto.'
        });
      }
      const requiredUs = ['nome', 'genero', 'email', 'areaAtuacao', 'telefonePessoal', 'cep', 'enderecoConsultorio', 'numeroConsultorio', 'npi', 'medicalLicenseNumber', 'medicalLicenseState', 'cidade', 'estado'];
      for (const field of requiredUs) {
        if (!user[field] || String(user[field]).trim() === '') {
          return res.status(400).json({ message: `Preencha todos os campos obrigatórios do perfil. Campo pendente: ${field}.` });
        }
      }
    } else {
      const hasCrm = docs.some(d => d.type === 'crm');
      const hasPhotoDoc = docs.some(d => d.type === 'document_with_photo');
      if (!hasCrm || !hasPhotoDoc) {
        return res.status(400).json({
          message: 'É obrigatório anexar pelo menos um documento de CRM e um documento com foto (ex.: RG ou CNH).'
        });
      }

      const required = ['nome', 'cpf', 'genero', 'email', 'crm', 'crmUf', 'areaAtuacao', 'telefonePessoal', 'cep', 'enderecoConsultorio', 'numeroConsultorio', 'bairro', 'cidade', 'estado'];
      for (const field of required) {
        if (!user[field] || String(user[field]).trim() === '') {
          return res.status(400).json({ message: `Preencha todos os campos obrigatórios do perfil. Campo pendente: ${field}.` });
        }
      }
    }

    user.validationStatus = 'under_review';
    user.validationSubmittedAt = new Date();
    user.validationDeniedReason = undefined;
    await user.save();

    await ValidationHistory.create({
      user: user._id,
      status: 'under_review',
      decidedAt: new Date()
    });

    res.json({
      message: 'Solicitação enviada para análise. Você será notificado quando houver retorno.',
      validationStatus: user.validationStatus
    });
  } catch (error) {
    return internalError(res, 'Erro ao enviar para análise');
  }
});

// Escolha de plano pós-aprovação (teste 14 dias ou plano pago)
router.post('/perfil/choose-plan', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    if (user.validationStatus !== 'approved') {
      return res.status(400).json({ message: 'Conta ainda não aprovada.' });
    }

    const { option } = req.body;
    if (option === 'trial') {
      const settings = await getOrCreatePlatformSettings();
      const days = Math.min(365, Math.max(1, Number(settings.trialDaysDefault) || 14));
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + days);
      user.hasChosenPlan = true;
      user.trialEndsAt = trialEndsAt;
      user.planChoice = 'trial';
      user.paymentStatus = 'none';
      await user.save();
      return res.json({
        message: `Teste gratuito de ${days} dia(s) ativado.`,
        trialEndsAt: user.trialEndsAt,
        trialDays: days
      });
    }
    if (option === 'paid') {
      // Cria uma etapa pendente: o plano só será ativado após confirmar o pagamento no checkout.
      user.hasChosenPlan = false;
      user.planChoice = undefined;
      user.trialEndsAt = undefined;
      user.paymentStatus = 'pending';
      await user.save();
      return res.json({
        message: 'Pagamento pendente criado. Complete o checkout para ativar o plano.',
        paymentStatus: 'pending',
        requiresCheckout: true
      });
    }
    return res.status(400).json({ message: 'Opção inválida. Use "trial" ou "paid".' });
  } catch (error) {
    return internalError(res, 'Erro ao registrar escolha');
  }
});

// Confirmação de pagamento (checkout) — regista transação e renovação
router.post('/pagamento/confirmar', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    if (user.validationStatus !== 'approved') {
      return res.status(400).json({ message: 'Conta ainda não aprovada.' });
    }

    const status = user.paymentStatus || 'none';
    if (status !== 'pending') {
      return res.status(400).json({ message: 'Nenhum pagamento pendente para confirmar.' });
    }

    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const method = req.body?.method === 'pix' ? 'pix' : 'card';
    if (method === 'card' && (!req.body?.card || typeof req.body.card !== 'object')) {
      return res.status(400).json({ message: 'Dados do cartão ausentes.' });
    }
    if (method === 'pix' && (!req.body?.pix || typeof req.body.pix !== 'object')) {
      return res.status(400).json({ message: 'Dados do Pix ausentes.' });
    }

    const settings = await getOrCreatePlatformSettings();

    await recordPaymentTransaction({
      userDoc: user,
      settings,
      billingCycle,
      method,
      payload: req.body
    });

    const now = new Date();
    if (!user.subscriptionStartedAt) {
      user.subscriptionStartedAt = now;
    }
    user.lastPaymentAt = now;
    user.billingCycle = billingCycle;
    const next = new Date(now);
    if (billingCycle === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    user.nextRenewalAt = next;

    user.hasChosenPlan = true;
    user.planChoice = 'paid';
    user.trialEndsAt = undefined;
    user.paymentStatus = 'paid';
    await user.save();

    return res.json({
      message: 'Pagamento confirmado. Plano ativado com sucesso.',
      hasChosenPlan: true,
      planChoice: 'paid',
      paymentStatus: 'paid',
      billingCycle: user.billingCycle,
      nextRenewalAt: user.nextRenewalAt.toISOString()
    });
  } catch (error) {
    return internalError(res, 'Erro ao confirmar pagamento');
  }
});

router.put('/perfil', authMiddleware, async (req, res) => {
  try {
    const {
      rqe,
      telefonePessoal,
      telefoneConsultorio,
      cep,
      enderecoConsultorio,
      numeroConsultorio,
      complemento,
      bairro,
      cidade,
      estado,
      nome,
      email,
      genero,
      crm,
      crmUf,
      areaAtuacao,
      npi,
      medicalLicenseNumber,
      medicalLicenseState
    } = req.body;
    
    const medico = await User.findById(req.user._id);
    if (!medico) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    const isUS = medico.country === 'US';

    if (nome !== undefined) {
      const nomeNorm = normalizeText(nome);
      if (!nomeNorm || nomeNorm.length > 150) {
        return res.status(400).json({ message: 'Nome inválido (1-150 caracteres).' });
      }
      medico.nome = nomeNorm;
    }
    if (email !== undefined) {
      const emailNorm = normalizeText(email).toLowerCase();
      if (!isValidEmail(emailNorm)) {
        return res.status(400).json({ message: 'E-mail inválido.' });
      }
      const existing = await User.findOne({ email: emailNorm, _id: { $ne: medico._id } })
        .select('_id')
        .lean();
      if (existing) {
        return res.status(400).json({ message: 'Este e-mail já está em uso.' });
      }
      medico.email = emailNorm;
    }
    if (genero !== undefined) medico.genero = normalizeText(genero);
    if (areaAtuacao !== undefined) medico.areaAtuacao = normalizeText(areaAtuacao);

    if (telefonePessoal !== undefined) {
      const phoneDigits = normalizeDigits(telefonePessoal);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return res.status(400).json({ message: 'Telefone pessoal inválido.' });
      }
      medico.telefonePessoal = phoneDigits;
    }
    if (telefoneConsultorio !== undefined) {
      const phoneDigits = normalizeDigits(telefoneConsultorio);
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
        return res.status(400).json({ message: 'Telefone do consultório inválido.' });
      }
      medico.telefoneConsultorio = phoneDigits;
    }
    if (cep !== undefined) {
      const zipDigits = normalizeDigits(cep);
      if (zipDigits && !isValidZipByCountry(medico.country, zipDigits)) {
        return res.status(400).json({
          message: isUS ? 'ZIP inválido. Use 5 ou 9 dígitos.' : 'CEP inválido. Use 8 dígitos.'
        });
      }
      medico.cep = zipDigits;
    }
    if (estado !== undefined) {
      const uf = normalizeUf(estado);
      if (uf && !isValidUf(uf)) {
        return res.status(400).json({ message: 'Estado inválido. Use 2 letras.' });
      }
      medico.estado = uf;
    }

    if (enderecoConsultorio !== undefined) medico.enderecoConsultorio = normalizeText(enderecoConsultorio);
    if (numeroConsultorio !== undefined) medico.numeroConsultorio = normalizeText(numeroConsultorio);
    if (complemento !== undefined) medico.complemento = normalizeText(complemento);
    if (bairro !== undefined) medico.bairro = normalizeText(bairro);
    if (cidade !== undefined) medico.cidade = normalizeText(cidade);

    if (isUS) {
      if (npi !== undefined) {
        const npiDigits = normalizeDigits(npi);
        if (npiDigits && !isValidNpi(npiDigits)) {
          return res.status(400).json({ message: 'NPI inválido. Informe exatamente 10 dígitos.' });
        }
        medico.npi = npiDigits;
      }
      if (medicalLicenseNumber !== undefined) {
        const license = normalizeText(medicalLicenseNumber).toUpperCase();
        if (license && !isValidUsLicense(license)) {
          return res.status(400).json({
            message: 'Número da licença inválido. Use 5 a 15 caracteres (letras, números e hífen).'
          });
        }
        medico.medicalLicenseNumber = license;
      }
      if (medicalLicenseState !== undefined) {
        const state = normalizeUf(medicalLicenseState);
        if (state && !isValidUf(state)) {
          return res.status(400).json({ message: 'Estado da licença (US) inválido. Use 2 letras.' });
        }
        medico.medicalLicenseState = state;
      }
    } else {
      if (crm !== undefined) {
        const crmDigits = normalizeDigits(crm);
        if (crmDigits && !isValidCrm(crmDigits)) {
          return res.status(400).json({ message: 'CRM inválido. Use de 4 a 6 dígitos.' });
        }
        medico.crm = crmDigits;
      }
      if (crmUf !== undefined) {
        const crmUfNorm = normalizeUf(crmUf);
        if (crmUfNorm && !isValidUf(crmUfNorm)) {
          return res.status(400).json({ message: 'UF do CRM inválida. Use 2 letras.' });
        }
        medico.crmUf = crmUfNorm;
      }
      if (rqe !== undefined) {
        medico.rqe = Array.isArray(rqe)
          ? rqe
            .map((item) => normalizeText(item))
            .filter((item) => item.length > 0 && item.length <= 30)
          : [];
      }
    }

    await medico.save();

    try {
      const notif = await Notification.create({
        user: req.user._id,
        title: 'Perfil atualizado',
        description: 'Seus dados do perfil foram atualizados com sucesso.',
        type: 'updates',
        link: '/client/views/perfilMedico.html',
        unread: true
      });
      try {
        const { sendNotificationToUser } = await import('../services/fcmService.js');
        
        await sendNotificationToUser(
          req.user._id,
          'User',
          'Perfil atualizado',
          'Seus dados do perfil foram atualizados com sucesso.',
          {
            link: '/client/views/perfilMedico.html',
            type: 'profile_update',
            notificationId: notif._id.toString()
          }
        );
      } catch (fcmError) {
        console.error('Erro ao enviar notificação push:', fcmError);
      }
    } catch (notifError) {
      console.error('Erro ao criar notificação:', notifError);
    }

    // Retorna os dados atualizados formatados
    const medicoAtualizado = medico.toObject();
    
    // Formata a data de nascimento se existir
    if (medicoAtualizado.dataNascimento) {
      medicoAtualizado.dataNascimento = new Date(medicoAtualizado.dataNascimento).toISOString().split('T')[0];
    }

    // Formata o endereço completo
    medicoAtualizado.enderecoCompleto = {
      cep: medicoAtualizado.cep,
      logradouro: medicoAtualizado.enderecoConsultorio,
      numero: medicoAtualizado.numeroConsultorio,
      complemento: medicoAtualizado.complemento,
      bairro: medicoAtualizado.bairro,
      cidade: medicoAtualizado.cidade,
      estado: medicoAtualizado.estado
    };

    // Formata os telefones
    medicoAtualizado.telefones = {
      pessoal: medicoAtualizado.telefonePessoal,
      consultorio: medicoAtualizado.telefoneConsultorio
    };

    // Adiciona a URL completa da foto se existir (apenas se não for Cloudinary)
    if (medicoAtualizado.foto && !medicoAtualizado.foto.startsWith('http')) {
      medicoAtualizado.foto = `${req.protocol}://${req.get('host')}${medicoAtualizado.foto}`;
    }

    res.json({ 
      message: 'Perfil atualizado com sucesso', 
      medico: medicoAtualizado 
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil do médico:', error);
    return internalError(res, 'Erro interno do servidor');
  }
});

// Atualizar foto do perfil (usando Cloudinary)
router.post('/perfil/foto', 
  authMiddleware,
  cloudinaryUpload('fotos', 'image', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não suportado. Use apenas JPG, JPEG ou PNG.'));
      }
    },
    fieldName: 'foto'
  }),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhuma foto foi enviada' });
      }

      const medico = await User.findById(req.user._id);
      if (!medico) {
        return res.status(404).json({ message: 'Médico não encontrado' });
      }

      // Remove a foto antiga do Cloudinary se existir
      if (medico.foto && medico.foto.includes('cloudinary.com')) {
        try {
          const urlParts = medico.foto.split('/');
          const publicId = urlParts.slice(-2).join('/').split('.')[0];
          await deleteFromCloudinary(publicId, 'image');
        } catch (error) {
          // Ignorar erro se não conseguir deletar
        }
      }

      // Usar URL do Cloudinary
      const fotoUrl = req.file.cloudinary?.secure_url || req.file.url;
      medico.foto = fotoUrl;
      await medico.save();

      try {
        await Notification.create({
          user: req.user._id,
          title: 'Foto de perfil atualizada',
          description: 'Sua foto de perfil foi atualizada com sucesso.',
          type: 'updates',
          link: '/client/views/perfilMedico.html',
          unread: true
        });
      } catch (notifError) {
        // Notificação é opcional
      }

      res.json({ 
        message: 'Foto atualizada com sucesso',
        fotoUrl: fotoUrl
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Erro ao processar upload da foto',
        error: process.env.NODE_ENV === 'development' ? 'internal_error' : 'Erro interno'
      });
    }
  }
);

router.post('/fcm-token', authMiddleware, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) {
      return res.status(400).json({ message: 'Token FCM não fornecido' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken: fcmToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ message: 'Token FCM salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar token FCM:', error);
    return internalError(res, 'Erro ao salvar token FCM');
  }
});

export default router;