'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/authMiddleware');
const { requireSeller, requireAdmin } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const analyticsController = require('../controllers/analyticsController');
const { trackEventSchema } = require('../validators/analyticsValidator');

// Public/optional-auth telemetry tracking endpoint
router.post('/track', optionalAuth, validateRequest(trackEventSchema), analyticsController.track);

// Seller analytics dashboard
router.get('/seller', authMiddleware, requireSeller, analyticsController.getSellerAnalytics);

// Buyer activity & engagement analytics
router.get('/buyer', authMiddleware, analyticsController.getBuyerAnalytics);

// Admin platform analytics overview
router.get('/admin', authMiddleware, requireAdmin, analyticsController.getAdminAnalytics);

module.exports = router;
