import User from '../models/User.js';

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('role isAdmin');
    const isAdmin = user && (user.isAdmin === true || user.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ message: 'Acesso restrito a administradores.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erro ao verificar permissão' });
  }
};
