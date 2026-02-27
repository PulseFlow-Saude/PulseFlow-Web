import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/doctors', adminController.listDoctorsByStatus);
router.get('/doctors/:id', adminController.getDoctorDetail);
router.post('/doctors/:id/approve', adminController.approveDoctor);
router.post('/doctors/:id/deny', adminController.denyDoctor);

export default router;
