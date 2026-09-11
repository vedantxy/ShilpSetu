'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireSeller } = require('../middleware/roleMiddleware');
const { authLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');

// Controllers
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const profileController = require('../controllers/profileController');
const dashboardController = require('../controllers/dashboardController');
const uploadController = require('../controllers/uploadController');
const aiController = require('../controllers/aiController');

// Validators
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { createProductSchema, updateProductSchema } = require('../validators/productValidator');
const {
  generateDescriptionSchema,
  priceSuggestionSchema,
  imageEnhanceSchema,
} = require('../validators/aiValidator');

// Admin sub-router (self-gated with authMiddleware + requireAdmin internally)
const adminRoutes = require('./adminRoutes');

// ─── Auth Routes ──────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, validateRequest(registerSchema), authController.register);
router.post('/auth/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/auth/logout', authMiddleware, authController.logout);
router.get('/auth/me', authMiddleware, authController.me);
router.get('/auth/google', authController.googleOAuth);
router.get('/auth/callback', authController.oauthCallback);
router.get('/auth/profile', authMiddleware, authController.getProfile);
router.put('/auth/profile', authMiddleware, authController.updateProfile);

// ─── Public Product Routes (marketplace) ─────────────────────────────────────
router.get('/products/marketplace', (req, res, next) => {
  const productService = require('../services/productService');
  const { sendSuccess } = require('../utils/responseHandler');
  const { page, limit, category, search, sort, order, minPrice, maxPrice } = req.query;
  productService
    .getPublished({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      category,
      search,
      sort: sort || 'created_at',
      order: order || 'desc',
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    })
    .then((result) =>
      sendSuccess(res, 'Products retrieved successfully', {
        products: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / (parseInt(limit) || 20)),
        },
      })
    )
    .catch(next);
});

// ─── Seller Product Routes (authenticated) ────────────────────────────────────
router.get('/products', authMiddleware, requireSeller, productController.getMyProducts);
router.post('/products', authMiddleware, requireSeller, validateRequest(createProductSchema), productController.create);
// NOTE: /products/marketplace and /products/pending (admin) must come before /:id
router.get('/products/:id', productController.getById);
router.put('/products/:id', authMiddleware, requireSeller, validateRequest(updateProductSchema), productController.update);
router.delete('/products/:id', authMiddleware, requireSeller, productController.delete);
router.patch('/products/:id/publish', authMiddleware, requireSeller, productController.publish);
router.patch('/products/:id/draft', authMiddleware, requireSeller, productController.draft);

// ─── Profile Routes ───────────────────────────────────────────────────────────
router.get('/profile', authMiddleware, profileController.getProfile);
router.put('/profile', authMiddleware, profileController.updateProfile);

// ─── Dashboard Routes ─────────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, requireSeller, dashboardController.getDashboard);
router.get('/dashboard/analytics', authMiddleware, requireSeller, dashboardController.getAnalytics);

// ─── Upload Routes ────────────────────────────────────────────────────────────
router.post('/upload/images', authMiddleware, uploadLimiter, uploadController.uploadMultiple);
router.delete('/upload/images', authMiddleware, uploadController.deleteImage);

// ─── AI Routes ────────────────────────────────────────────────────────────────
router.post('/ai/generate-description', authMiddleware, requireSeller, validateRequest(generateDescriptionSchema), aiController.generateDescription);
router.post('/ai/price-suggestion', authMiddleware, requireSeller, validateRequest(priceSuggestionSchema), aiController.priceSuggestion);
router.post('/ai/image-enhance', authMiddleware, requireSeller, validateRequest(imageEnhanceSchema), aiController.imageEnhance);
router.post('/ai/speech-to-text', authMiddleware, requireSeller, aiController.speechToText);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// Internally gated with authMiddleware + requireAdmin
router.use('/admin', adminRoutes);

module.exports = router;
