import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireValidatedDoctor } from '../middlewares/requireValidatedDoctor.js';
import Notification from '../models/Notification.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireValidatedDoctor);

router.get('/', async (req, res) => {
  try {
    const { archived } = req.query;
    const query = { user: req.user._id };
    
    if (archived !== undefined && archived !== '') {
      query.archived = archived === 'true';
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar notificações' });
  }
});

router.get('/preview', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar notificações' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user._id,
      unread: true,
      archived: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao contar notificações' });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ 
      _id: id, 
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    notification.archived = true;
    await notification.save();

    res.json({ message: 'Notificação arquivada com sucesso', notification });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao arquivar notificação' });
  }
});

router.patch('/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ 
      _id: id, 
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    notification.archived = false;
    await notification.save();

    res.json({ message: 'Notificação desarquivada com sucesso', notification });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desarquivar notificação' });
  }
});

router.post('/archive-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, archived: false },
      { $set: { archived: true } }
    );

    res.json({ 
      message: `${result.modifiedCount} notificações arquivadas com sucesso`,
      count: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao arquivar notificações' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({ 
      _id: id, 
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    res.json({ message: 'Notificação excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir notificação' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const result = await Notification.deleteMany({ user: req.user._id });

    res.json({ 
      message: `${result.deletedCount} notificações excluídas com sucesso`,
      count: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir notificações' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { unread } = req.body;
    
    const notification = await Notification.findOne({ 
      _id: id, 
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    notification.unread = unread !== undefined ? unread : false;
    await notification.save();

    res.json({ message: 'Notificação atualizada', notification });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar notificação' });
  }
});

router.patch('/mark-all-read', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, unread: true },
      { $set: { unread: false } }
    );

    res.json({ 
      message: `${result.modifiedCount} notificações marcadas como lidas`,
      count: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar notificações' });
  }
});

export default router;
