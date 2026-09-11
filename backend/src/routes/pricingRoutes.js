'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireSeller } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const pricingController = require('../controllers/pricingController');
const { calculatePriceSchema } = require('../validators/pricingValidator');

router.use(authMiddleware, requireSeller);

router.post('/calculate', validateRequest(calculatePriceSchema), pricingController.calculate);
router.get('/signals', pricingController.getMarketSignals);
router.get('/:id', pricingController.getRecord);
router.get('/', pricingController.listRecords);

module.exports = router;
