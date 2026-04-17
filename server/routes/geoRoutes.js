import express from 'express';
import * as geoController from '../controllers/geoController.js';

const router = express.Router();

router.post('/reverse-country', geoController.reverseCountry);
router.get('/ip-hint', geoController.ipHint);

export default router;
