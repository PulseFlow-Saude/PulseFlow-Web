import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import * as adminController from '../controllers/adminController.js';
import * as adminPlatformController from '../controllers/adminPlatformController.js';
import * as platformSettingsController from '../controllers/platformSettingsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/dashboard-stats', adminPlatformController.getAdminDashboard);
router.get('/platform-settings', platformSettingsController.getPlatformSettings);
router.patch('/platform-settings', platformSettingsController.patchPlatformSettings);

router.get('/platform-users/stats', adminPlatformController.getPlatformStats);
router.get('/platform-users', adminPlatformController.listPlatformUsers);
router.get('/platform-users/:type/:id', adminPlatformController.getPlatformUserDetail);
router.patch('/platform-users/:type/:id', adminPlatformController.patchPlatformUser);
router.delete('/platform-users/:type/:id', adminPlatformController.deletePlatformUser);

router.get('/doctors/stats', adminController.getDoctorsStats);
router.get('/doctors', adminController.listDoctorsByStatus);
router.get('/doctors/:id', adminController.getDoctorDetail);
router.post('/doctors/:id/approve', adminController.approveDoctor);
router.post('/doctors/:id/deny', adminController.denyDoctor);

export default router;
