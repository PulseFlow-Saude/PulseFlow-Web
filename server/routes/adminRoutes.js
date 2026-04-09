import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import * as adminController from '../controllers/adminController.js';
import * as adminPlatformController from '../controllers/adminPlatformController.js';
import * as platformSettingsController from '../controllers/platformSettingsController.js';
import * as adminSiteDataController from '../controllers/adminSiteDataController.js';
import * as financialController from '../controllers/financialController.js';

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

router.get('/newsletter-subscribers/export.csv', adminSiteDataController.exportNewsletterCsv);
router.get('/newsletter-subscribers', adminSiteDataController.listNewsletterSubscribers);
router.delete('/newsletter-subscribers', adminSiteDataController.removeNewsletterSubscriber);

router.get('/contact-messages', adminSiteDataController.listContactMessages);
router.delete('/contact-messages/:id', adminSiteDataController.removeContactMessage);

router.get('/audit-log', adminSiteDataController.getAuditLog);

router.get('/financeiro/resumo', financialController.getFinancialSummary);
router.get('/financeiro/transacoes', financialController.listTransactions);
router.get('/financeiro/transacoes/export.csv', financialController.exportTransactionsCsv);

export default router;
