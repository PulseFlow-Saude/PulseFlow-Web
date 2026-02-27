import User from '../models/User.js';

/**
 * Bloqueia acesso se o médico não estiver com conta aprovada.
 * Usado em rotas que não sejam perfil, upload de documentos ou envio para análise.
 */
export const requireValidatedDoctor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('validationStatus role isAdmin');
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    if (user.isAdmin === true || user.role === 'admin') {
      return next();
    }
    if (user.validationStatus !== 'approved') {
      return res.status(403).json({
        message: 'Conta em validação. Conclua o cadastro e aguarde a aprovação para acessar esta funcionalidade.',
        validationStatus: user.validationStatus
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erro ao verificar status da conta' });
  }
};
