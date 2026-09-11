'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');
const { validateRequest, validateQuery } = require('../middleware/validateRequest');
const {
  updateUserStatusSchema,
  updateUserRoleSchema,
  artisanActionSchema,
  rejectProductSchema,
  createCategorySchema,
  updateCategorySchema,
  updateOrderStatusSchema,
  createNotificationSchema,
  updateNotificationSchema,
  analyticsQuerySchema,
} = require('../validators/adminValidator');

/**
 * Admin Routes — /api/admin/*
 *
 * ALL routes in this file are protected by:
 *   1. authMiddleware  — validates the Supabase JWT and loads req.profile
 *   2. requireAdmin    — verifies req.profile.role === 'admin'
 *
 * Never rely only on frontend route protection.
 */
router.use(authMiddleware, requireAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ─── User Management ──────────────────────────────────────────────────────────
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', validateRequest(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/role', validateRequest(updateUserRoleSchema), adminController.updateUserRole);

// ─── Artisan Management ───────────────────────────────────────────────────────
router.get('/artisans', adminController.getArtisans);
router.get('/artisans/:id', adminController.getArtisanById);
router.post('/artisans/:id/verify', validateRequest(artisanActionSchema), adminController.verifyArtisan);
router.post('/artisans/:id/reject', validateRequest(artisanActionSchema), adminController.rejectArtisan);
router.post('/artisans/:id/suspend', validateRequest(artisanActionSchema), adminController.suspendArtisan);

// ─── Product Moderation ───────────────────────────────────────────────────────
router.get('/products', adminController.getProducts);
router.get('/products/pending', adminController.getPendingProducts);
router.post('/products/:id/approve', adminController.approveProduct);
router.post('/products/:id/reject', validateRequest(rejectProductSchema), adminController.rejectProduct);
router.post('/products/:id/archive', adminController.archiveProduct);
router.post('/products/:id/feature', adminController.featureProduct);

// ─── Category Management ──────────────────────────────────────────────────────
router.get('/categories', adminController.getCategories);
router.post('/categories', validateRequest(createCategorySchema), adminController.createCategory);
router.patch('/categories/:id', validateRequest(updateCategorySchema), adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
router.post('/categories/:id/activate', adminController.activateCategory);
router.post('/categories/:id/deactivate', adminController.deactivateCategory);

// ─── Order Management ─────────────────────────────────────────────────────────
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.patch('/orders/:id/status', validateRequest(updateOrderStatusSchema), adminController.updateOrderStatus);

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/users', validateQuery(analyticsQuerySchema), adminController.getUserAnalytics);
router.get('/analytics/products', validateQuery(analyticsQuerySchema), adminController.getProductAnalytics);
router.get('/analytics/orders', validateQuery(analyticsQuerySchema), adminController.getOrderAnalytics);
router.get('/analytics/revenue', validateQuery(analyticsQuerySchema), adminController.getRevenueAnalytics);
router.get('/analytics/sellers', validateQuery(analyticsQuerySchema), adminController.getSellerAnalytics);

// ─── Audit Logs ───────────────────────────────────────────────────────────────
router.get('/audit-logs', adminController.getAuditLogs);

// ─── Admin Notifications ──────────────────────────────────────────────────────
router.get('/notifications', adminController.getNotifications);
router.post('/notifications', validateRequest(createNotificationSchema), adminController.createNotification);
router.patch('/notifications/:id', validateRequest(updateNotificationSchema), adminController.updateNotification);
router.delete('/notifications/:id', adminController.deleteNotification);

module.exports = router;
