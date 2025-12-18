// routes/userRoutes.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { cloudinaryUpload } from '../middlewares/cloudinaryUpload.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Cloudinary configurado para uploads

router.get('/perfil', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Formatar a URL completa da foto se existir
    let fotoUrl = user.foto;
    if (fotoUrl && !fotoUrl.startsWith('http')) {
      // Se a foto não começa com http, adiciona o protocolo e host
      fotoUrl = `${req.protocol}://${req.get('host')}${fotoUrl}`;
    }

    res.json({
      nome: user.nome,
      genero: user.genero,
      email: user.email,
      areaAtuacao: user.areaAtuacao,
      cpf: user.cpf,
      crm: user.crm,
      rqe: user.rqe,
      telefonePessoal: user.telefonePessoal,
      telefoneConsultorio: user.telefoneConsultorio,
      cep: user.cep,
      enderecoConsultorio: user.enderecoConsultorio,
      numeroConsultorio: user.numeroConsultorio,
      complemento: user.complemento,
      bairro: user.bairro,
      cidade: user.cidade,
      estado: user.estado,
      foto: fotoUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar perfil do usuário', error: error.message });
  }
});

router.put('/perfil', authMiddleware, async (req, res) => {
  console.log('Recebendo requisição PUT para atualizar perfil');
  console.log('Dados recebidos:', req.body);
  
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
      areaAtuacao
    } = req.body;
    
    console.log('ID do usuário:', req.user._id);
    const medico = await User.findById(req.user._id);
    if (!medico) {
      console.log('Médico não encontrado');
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    console.log('Médico encontrado:', medico);

    // Atualiza apenas os campos permitidos
    if (nome !== undefined) medico.nome = nome;
    if (email !== undefined) medico.email = email;
    if (genero !== undefined) medico.genero = genero;
    if (crm !== undefined) medico.crm = crm;
    if (areaAtuacao !== undefined) medico.areaAtuacao = areaAtuacao;
    
    if (rqe !== undefined) {
      console.log('Atualizando RQE:', rqe);
      medico.rqe = Array.isArray(rqe) ? rqe.filter(r => r && r.trim() !== '') : [];
    }
    if (telefonePessoal !== undefined) {
      console.log('Atualizando telefone pessoal:', telefonePessoal);
      medico.telefonePessoal = telefonePessoal;
    }
    if (telefoneConsultorio !== undefined) {
      console.log('Atualizando telefone consultório:', telefoneConsultorio);
      medico.telefoneConsultorio = telefoneConsultorio;
    }
    if (cep !== undefined) {
      console.log('Atualizando CEP:', cep);
      medico.cep = cep;
    }
    if (enderecoConsultorio !== undefined) {
      console.log('Atualizando endereço:', enderecoConsultorio);
      medico.enderecoConsultorio = enderecoConsultorio;
    }
    if (numeroConsultorio !== undefined) {
      console.log('Atualizando número:', numeroConsultorio);
      medico.numeroConsultorio = numeroConsultorio;
    }
    if (complemento !== undefined) {
      console.log('Atualizando complemento:', complemento);
      medico.complemento = complemento;
    }
    if (bairro !== undefined) {
      console.log('Atualizando bairro:', bairro);
      medico.bairro = bairro;
    }
    if (cidade !== undefined) {
      console.log('Atualizando cidade:', cidade);
      medico.cidade = cidade;
    }
    if (estado !== undefined) {
      console.log('Atualizando estado:', estado);
      medico.estado = estado;
    }

    console.log('Salvando alterações...');
    await medico.save();
    console.log('Alterações salvas com sucesso');

    try {
      const notif = await Notification.create({
        user: req.user._id,
        title: 'Perfil atualizado',
        description: 'Seus dados do perfil foram atualizados com sucesso.',
        type: 'updates',
        link: '/client/views/perfilMedico.html',
        unread: true
      });
      console.log('Notificação criada com sucesso');

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
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
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
      res.status(500).json({ 
        message: 'Erro ao processar upload da foto',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
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
    res.status(500).json({ message: 'Erro ao salvar token FCM', error: error.message });
  }
});

export default router;