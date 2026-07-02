import Paciente from '../models/Paciente.js';
import bcrypt from 'bcrypt';
import tokenService from '../services/tokenService.js';
import { sanitizeDigits } from '../utils/patientIdentifier.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      residenceCountry,
      socialSecurityNumber,
      address,
      height,
      weight,
      profession,
      acceptedTerms,
      profilePhoto,
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cpfDigits = sanitizeDigits(cpf);
    const ssnDigits = sanitizeDigits(socialSecurityNumber);
    const country = String(residenceCountry || 'BR').trim().toUpperCase() === 'US' ? 'US' : 'BR';
    const normalizedName = String(name || '').trim();
    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    const normalizedPassword = String(password || '');

    if (!normalizedName || normalizedName.length > 150) {
      return res.status(400).json({ message: 'Nome inválido' });
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    if (country === 'US') {
      if (ssnDigits.length !== 9) {
        return res.status(400).json({ message: 'SSN inválido' });
      }
    } else if (cpfDigits.length !== 11) {
      return res.status(400).json({ message: 'CPF inválido' });
    }

    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return res.status(400).json({ message: 'Telefone inválido' });
    }
    if (normalizedPassword.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres' });
    }

    const pacienteExistente = await Paciente.findOne({ email: normalizedEmail });
    if (pacienteExistente) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    if (country === 'US') {
      const ssnExistente = await Paciente.findOne({ socialSecurityNumber: ssnDigits });
      if (ssnExistente) {
        return res.status(400).json({ message: 'SSN já cadastrado' });
      }
    } else {
      const cpfExistente = await Paciente.findOne({ cpf: cpfDigits });
      if (cpfExistente) {
        return res.status(400).json({ message: 'CPF já cadastrado' });
      }
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const novoPaciente = new Paciente({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      cpf: country === 'US' ? undefined : cpfDigits,
      rg: country === 'US' ? undefined : rg,
      residenceCountry: country,
      socialSecurityNumber: country === 'US' ? ssnDigits : undefined,
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
      nome: normalizedName,
      senha: hashedPassword,
      telefone: normalizedPhone,
      dataNascimento: birthDate,
      genero: gender,
      fotoPerfil: profilePhoto,
      altura: height?.toString(),
      peso: weight?.toString(),
      profissao: profession,
    });

    await novoPaciente.save();

    const pacienteResponse = novoPaciente.toObject();
    delete pacienteResponse.password;
    delete pacienteResponse.senha;

    res.status(201).json({
      message: 'Paciente cadastrado com sucesso!',
      patient: pacienteResponse,
    });
  } catch (error) {
    console.error('Erro no registro de paciente:', error);
    res.status(500).json({
      message: 'Erro no registro',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor',
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

    const pacienteResponse = paciente.toObject();
    delete pacienteResponse.password;
    delete pacienteResponse.senha;

    res.json({
      token,
      refreshToken,
      paciente: pacienteResponse,
      patient: pacienteResponse,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no login' });
  }
};

const sanitizePaciente = (paciente) => {
  const obj = paciente.toObject ? paciente.toObject() : { ...paciente };
  delete obj.password;
  delete obj.senha;
  return obj;
};

export const mePaciente = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    res.json(sanitizePaciente(req.user));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar perfil' });
  }
};
