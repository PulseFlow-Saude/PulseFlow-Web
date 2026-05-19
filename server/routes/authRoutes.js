import express from 'express';
import * as authController from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { geoLockMiddleware } from '../middlewares/geoLockMiddleware.js';
import tokenService from '../services/tokenService.js';

const router = express.Router();

router.post('/register', geoLockMiddleware, authController.register);
router.post('/login', geoLockMiddleware, authController.login);
router.post('/reset-password', authController.resetPassword);
router.post('/validate-reset-token', authController.validateResetToken);
router.post('/confirm-reset-password', authController.confirmResetPassword);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOTP);

router.get('/me', authMiddleware, authController.getMe);
router.put('/update-profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);
router.delete('/delete-account', authMiddleware, authController.deleteAccount);

// Rota para refresh do token
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.body?.token;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token não fornecido' });
    }

    const rotated = await tokenService.rotateRefreshSessionToken(refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });
    res.json({ token: rotated.accessToken, refreshToken: rotated.refreshToken });
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar token' });
  }
});

export default router;
