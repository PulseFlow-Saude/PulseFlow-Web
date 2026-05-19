import Paciente from '../models/Paciente.js';
import bcrypt from 'bcrypt';
import tokenService from '../services/tokenService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeCpf = (cpf = '') => String(cpf).replace(/\D/g, '');

export const registrarPaciente = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      cpf,
      rg,
      phone,
      secondaryPhone,
      birthDate,
      gender,
      maritalStatus,
      nationality,
      address,
      height,
      weight,
      profession,
      acceptedTerms,
      profilePhoto
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cpfDigits = sanitizeCpf(cpf);
    const normalizedName = String(name || '').trim();
    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    const normalizedPassword = String(password || '');

    if (!normalizedName || normalizedName.length > 150) {
      return res.status(400).json({ message: 'Nome inválido' });
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Email inválido' });
    }
    if (cpfDigits.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido' });
    }
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return res.status(400).json({ message: 'Telefone inválido' });
    }
    if (normalizedPassword.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres' });
    }

    // Verificar se o email já existe
    const pacienteExistente = await Paciente.findOne({ email: normalizedEmail });
    if (pacienteExistente) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Verificar se o CPF já existe
    const cpfExistente = await Paciente.findOne({ cpf: cpfDigits });
    if (cpfExistente) {
      return res.status(400).json({ message: 'CPF já cadastrado' });
    }

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    // Criar o paciente com todos os campos
    const novoPaciente = new Paciente({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      cpf: cpfDigits,
      rg,
      phone: normalizedPhone,
      secondaryPhone,
      birthDate,
      gender,
      maritalStatus,
      nationality,
      address,
      height,
      weight,
      profession,
      acceptedTerms: acceptedTerms === true,
      profilePhoto,
      // Campos legacy para compatibilidade
      nome: normalizedName,
      senha: hashedPassword,
      telefone: normalizedPhone,
      dataNascimento: birthDate,
      genero: gender,
      fotoPerfil: profilePhoto,
      altura: height?.toString(),
      peso: weight?.toString(),
      profissao: profession
    });

    await novoPaciente.save();
    
    // Retornar o paciente criado (sem a senha)
    const pacienteResponse = novoPaciente.toObject();
    delete pacienteResponse.password;
    delete pacienteResponse.senha;
    
    res.status(201).json({
      message: 'Paciente cadastrado com sucesso!',
      patient: pacienteResponse
    });
  } catch (error) {
    console.error('Erro no registro de paciente:', error);
    res.status(500).json({
      message: 'Erro no registro',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor'
    });
  }
};

export const loginPaciente = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  const genericInvalidMsg = 'Credenciais inválidas';

  try {
    const paciente = await Paciente.findOne({ email });
    if (!paciente) {
      return res.status(401).json({ message: genericInvalidMsg });
    }

    const senhaOk = await bcrypt.compare(senha, paciente.senha);
    if (!senhaOk) {
      return res.status(401).json({ message: genericInvalidMsg });
    }

    const token = tokenService.generateAccessToken(
      { id: paciente._id, cpf: paciente.cpf, email: paciente.email },
      '1d'
    );
    const refreshToken = await tokenService.issueRefreshSessionToken(
      { id: paciente._id, email: paciente.email, subjectModel: 'Paciente' },
      { ip: req.ip, userAgent: req.headers['user-agent'] || '' }
    );    

    res.json({ token, refreshToken });
  } catch (error) {
    res.status(500).json({ message: 'Erro no login' });
  }
};
