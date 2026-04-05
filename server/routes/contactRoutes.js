import express from 'express';
import * as contactController from '../controllers/contactController.js';

const router = express.Router();

router.post('/', (req, res, next) => {
  Promise.resolve(contactController.submitContact(req, res)).catch(next);
});

export default router;
