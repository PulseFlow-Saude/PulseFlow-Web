import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshSession from '../models/RefreshSession.js';

const generateAccessToken = (payload, expiresIn = '15m') => {
  return jwt.sign(
    { ...payload, tokenType: 'access' },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (payload, expiresIn = '7d') => {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');

const createOpaqueRefreshToken = () => crypto.randomBytes(48).toString('hex');

const getSessionTtlMs = () => {
  const days = Number(process.env.REFRESH_TOKEN_DAYS || 7);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
};

const issueRefreshSessionToken = async (
  { id, email = '', subjectModel = 'User' },
  { ip = '', userAgent = '' } = {}
) => {
  const rawToken = createOpaqueRefreshToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  await RefreshSession.create({
    subjectId: id,
    subjectModel,
    subjectEmail: String(email || '').trim().toLowerCase(),
    tokenHash,
    expiresAt,
    createdByIp: String(ip || ''),
    userAgent: String(userAgent || '')
  });

  return rawToken;
};

const rotateRefreshSessionToken = async (rawToken, { ip = '', userAgent = '' } = {}) => {
  const tokenHash = hashToken(rawToken);
  const current = await RefreshSession.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!current) {
    throw new Error('Refresh token inválido ou expirado');
  }

  const newRawToken = createOpaqueRefreshToken();
  const newTokenHash = hashToken(newRawToken);
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  current.revokedAt = new Date();
  current.replacedByTokenHash = newTokenHash;
  await current.save();

  await RefreshSession.create({
    subjectId: current.subjectId,
    subjectModel: current.subjectModel,
    subjectEmail: current.subjectEmail,
    tokenHash: newTokenHash,
    expiresAt,
    createdByIp: String(ip || ''),
    userAgent: String(userAgent || '')
  });

  const accessPayload = {
    id: current.subjectId,
    email: current.subjectEmail
  };

  const accessToken = generateAccessToken(accessPayload);
  return { accessToken, refreshToken: newRawToken, subjectModel: current.subjectModel };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw error;
  }
};

const refreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tokenType !== 'refresh') {
      throw new Error('Tipo de token inválido para refresh');
    }
    return generateAccessToken({ id: decoded.id, email: decoded.email });
  } catch (error) {
    throw new Error('Token inválido para refresh');
  }
};

export default {
  // Alias legado para manter compatibilidade com usos antigos.
  generateToken: generateAccessToken,
  generateAccessToken,
  generateRefreshToken,
  issueRefreshSessionToken,
  rotateRefreshSessionToken,
  verifyToken,
  refreshToken
};
