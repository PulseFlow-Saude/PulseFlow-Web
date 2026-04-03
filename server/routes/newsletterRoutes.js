import express from 'express';
import * as newsletterController from '../controllers/newsletterController.js';

const router = express.Router();

router.post('/subscribe', newsletterController.subscribeNewsletter);

export default router;
