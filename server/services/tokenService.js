import jwt from 'jsonwebtoken';

const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    return generateToken({ id: decoded.id, email: decoded.email });
  } catch (error) {
    throw new Error('Token inválido para refresh');
  }
};

export default {
  generateToken,
  verifyToken,
  refreshToken
};
