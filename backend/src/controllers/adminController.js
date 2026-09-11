'use strict';

const adminService = require('../services/adminService');
const auditLogService = require('../services/auditLogService');
const adminAnalyticsService = require('../services/adminAnalyticsService');
const adminNotificationService = require('../services/adminNotificationService');
const categoryService = require('../services/categoryService');
const eventBus = require('../events/eventBus');
const EventTypes = require('../events/eventTypes');
const { sendSuccess, sendCreated } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Extract client IP from the request (supports proxies).
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Admin Controller
 *
 * All handlers are secured at the router level by authMiddleware + requireAdmin.
 * Each sensitive mutation also records an audit log entry.
 */
const adminController = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/dashboard
   * Real-time platform statistics from the database.
   */
  async getDashboard(req, res, next) {
    try {
      const stats = await adminService.getDashboardStats();
      return sendSuccess(res, 'Dashboard data retrieved successfully', stats);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/users
   * Query params: page, limit, role, status, search
   */
  async getUsers(req, res, next) {
    try {
      const { page, limit, role, status, search } = req.query;
      const result = await adminService.getUsers({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        role,
        status,
        search,
      });

      return sendSuccess(res, 'Users retrieved successfully', {
        users: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const user = await adminService.getUserById(req.params.id);
      if (!user) throw ApiError.notFound('User not found');
      return sendSuccess(res, 'User retrieved successfully', user);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/users/:id/status
   * Body: { status: 'active'|'suspended'|'deactivated', reason? }
   */
  async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const user = await adminService.updateUserStatus(id, status);

      // Audit log
      await auditLogService.record({
        adminId: req.profile.id,
        action: 'change_user_status',
        targetType: 'user',
        targetId: id,
        metadata: { newStatus: status, reason: reason || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, `User status updated to '${status}'`, user);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/users/:id/role
   * Body: { role: 'buyer'|'seller'|'admin', reason? }
   *
   * Highly protected:
   *   - Admin cannot change their own role
   *   - Only explicit roles are allowed (enforced in validator + service)
   */
  async updateUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role, reason } = req.body;

      // Self-demotion check is also enforced in the service layer
      if (id === req.profile.id) {
        throw ApiError.forbidden('Admins cannot change their own role');
      }

      const user = await adminService.updateUserRole(id, role, req.profile.id);

      // Audit log — role changes are the most sensitive admin operation
      await auditLogService.record({
        adminId: req.profile.id,
        action: 'change_user_role',
        targetType: 'user',
        targetId: id,
        metadata: { newRole: role, reason: reason || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      logger.warn(`ROLE CHANGE: Admin ${req.profile.id} changed user ${id} to role=${role}`);

      return sendSuccess(res, `User role updated to '${role}'`, user);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTISAN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/artisans
   * Query params: page, limit, verificationStatus, search
   */
  async getArtisans(req, res, next) {
    try {
      const { page, limit, verificationStatus, search } = req.query;
      const result = await adminService.getArtisans({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        verificationStatus,
        search,
      });

      return sendSuccess(res, 'Artisans retrieved successfully', {
        artisans: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/artisans/:id
   */
  async getArtisanById(req, res, next) {
    try {
      const artisan = await adminService.getArtisanById(req.params.id);
      if (!artisan) throw ApiError.notFound('Artisan not found');
      return sendSuccess(res, 'Artisan retrieved successfully', artisan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/artisans/:id/verify
   * Body: { reason?, notes? }
   */
  async verifyArtisan(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const artisan = await adminService.verifyArtisan(id);

      // Publish domain event
      eventBus.publish(EventTypes.ARTISAN_VERIFIED, {
        artisanId: id,
        craftName: artisan.craft_name,
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'verify_artisan',
        targetType: 'user',
        targetId: id,
        metadata: { notes: notes || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Artisan verified successfully', artisan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/artisans/:id/reject
   * Body: { reason?, notes? }
   */
  async rejectArtisan(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, notes } = req.body;

      const artisan = await adminService.rejectArtisan(id, reason);

      // Publish domain event
      eventBus.publish(EventTypes.ARTISAN_REJECTED, {
        artisanId: id,
        reason,
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'reject_artisan',
        targetType: 'user',
        targetId: id,
        metadata: { reason: reason || null, notes: notes || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Artisan verification rejected', artisan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/artisans/:id/suspend
   * Body: { reason?, notes? }
   */
  async suspendArtisan(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, notes } = req.body;

      const artisan = await adminService.suspendArtisan(id, reason);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'suspend_artisan',
        targetType: 'user',
        targetId: id,
        metadata: { reason: reason || null, notes: notes || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Artisan suspended successfully', artisan);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT MODERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/products
   * Query params: page, limit, status, search, sellerId
   */
  async getProducts(req, res, next) {
    try {
      const { page, limit, status, search, sellerId } = req.query;
      const result = await adminService.getProducts({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        search,
        sellerId,
      });

      return sendSuccess(res, 'Products retrieved successfully', {
        products: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/products/pending
   */
  async getPendingProducts(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await adminService.getPendingProducts({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });

      return sendSuccess(res, 'Pending products retrieved successfully', {
        products: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/products/:id/approve
   */
  async approveProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await adminService.approveProduct(id);

      // Publish domain event
      eventBus.publish(EventTypes.PRODUCT_PUBLISHED, {
        sellerId: product.seller_id,
        productId: product.id,
        productTitle: product.title,
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'approve_product',
        targetType: 'product',
        targetId: id,
        metadata: { title: product.title },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Product approved and published', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/products/:id/reject
   * Body: { reason (required), notes? }
   */
  async rejectProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, notes } = req.body;

      const product = await adminService.rejectProduct(id, reason);

      // Publish domain event
      eventBus.publish(EventTypes.PRODUCT_REJECTED, {
        sellerId: product.seller_id,
        productId: product.id,
        productTitle: product.title,
        reason,
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'reject_product',
        targetType: 'product',
        targetId: id,
        metadata: { reason, notes: notes || null, title: product.title },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Product rejected', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/products/:id/archive
   */
  async archiveProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await adminService.archiveProduct(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'archive_product',
        targetType: 'product',
        targetId: id,
        metadata: { title: product.title },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Product archived', product);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/products/:id/feature
   */
  async featureProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await adminService.featureProduct(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'feature_product',
        targetType: 'product',
        targetId: id,
        metadata: { title: product.title },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Product featured successfully', product);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/categories
   * Returns all categories including inactive ones.
   */
  async getCategories(req, res, next) {
    try {
      const categories = await categoryService.getAll(true); // includeInactive=true
      return sendSuccess(res, 'Categories retrieved successfully', { categories });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/categories
   * Body: { name, icon?, description?, is_active? }
   */
  async createCategory(req, res, next) {
    try {
      const category = await categoryService.create(req.body);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'create_category',
        targetType: 'category',
        targetId: category.id,
        metadata: { name: category.name },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendCreated(res, 'Category created successfully', category);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/categories/:id
   * Body: { name?, icon?, description?, is_active? }
   */
  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.update(id, req.body);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'update_category',
        targetType: 'category',
        targetId: id,
        metadata: { updates: req.body },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Category updated successfully', category);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/admin/categories/:id
   */
  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      await categoryService.delete(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'delete_category',
        targetType: 'category',
        targetId: id,
        metadata: {},
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Category deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/categories/:id/activate
   */
  async activateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.activate(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'activate_category',
        targetType: 'category',
        targetId: id,
        metadata: { name: category.name },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Category activated successfully', category);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/categories/:id/deactivate
   */
  async deactivateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.deactivate(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'deactivate_category',
        targetType: 'category',
        targetId: id,
        metadata: { name: category.name },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Category deactivated successfully', category);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/orders
   * Query params: page, limit, status, paymentStatus
   */
  async getOrders(req, res, next) {
    try {
      const { page, limit, status, paymentStatus } = req.query;
      const result = await adminService.getOrders({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        paymentStatus,
      });

      return sendSuccess(res, 'Orders retrieved successfully', {
        orders: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/orders/:id
   */
  async getOrderById(req, res, next) {
    try {
      const order = await adminService.getOrderById(req.params.id);
      if (!order) throw ApiError.notFound('Order not found');
      return sendSuccess(res, 'Order retrieved successfully', order);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/orders/:id/status
   * Body: { status, notes? }
   */
  async updateOrderStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const order = await adminService.updateOrderStatus(id, status);

      // Publish domain event
      eventBus.publish(EventTypes.ORDER_STATUS_UPDATED, {
        orderId: order.id,
        orderNumber: order.order_number,
        buyerId: order.buyer_id,
        status,
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'update_order_status',
        targetType: 'order',
        targetId: id,
        metadata: { newStatus: status, notes: notes || null },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, `Order status updated to '${status}'`, order);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/analytics/users?range=7d|30d|90d|1y
   */
  async getUserAnalytics(req, res, next) {
    try {
      const { range } = req.query;
      const data = await adminAnalyticsService.getUserAnalytics(range);
      return sendSuccess(res, 'User analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/analytics/products?range=7d|30d|90d|1y
   */
  async getProductAnalytics(req, res, next) {
    try {
      const { range } = req.query;
      const data = await adminAnalyticsService.getProductAnalytics(range);
      return sendSuccess(res, 'Product analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/analytics/orders?range=7d|30d|90d|1y
   */
  async getOrderAnalytics(req, res, next) {
    try {
      const { range } = req.query;
      const data = await adminAnalyticsService.getOrderAnalytics(range);
      return sendSuccess(res, 'Order analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/analytics/revenue?range=7d|30d|90d|1y
   */
  async getRevenueAnalytics(req, res, next) {
    try {
      const { range } = req.query;
      const data = await adminAnalyticsService.getRevenueAnalytics(range);
      return sendSuccess(res, 'Revenue analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/analytics/sellers?range=7d|30d|90d|1y
   */
  async getSellerAnalytics(req, res, next) {
    try {
      const { range } = req.query;
      const data = await adminAnalyticsService.getSellerAnalytics(range);
      return sendSuccess(res, 'Seller analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/audit-logs
   * Query params: page, limit, action, targetType, adminId
   */
  async getAuditLogs(req, res, next) {
    try {
      const { page, limit, action, targetType, adminId } = req.query;
      const result = await auditLogService.getAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        action,
        targetType,
        adminId,
      });

      return sendSuccess(res, 'Audit logs retrieved successfully', {
        logs: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/notifications
   * Query params: page, limit, type, targetRole, isActive
   */
  async getNotifications(req, res, next) {
    try {
      const { page, limit, type, targetRole } = req.query;
      const isActive = req.query.isActive !== undefined
        ? req.query.isActive === 'true'
        : undefined;

      const result = await adminNotificationService.getAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        type,
        targetRole,
        isActive,
      });

      return sendSuccess(res, 'Notifications retrieved successfully', {
        notifications: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil((result.count || 0) / result.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/admin/notifications
   * Body: { type, title, body, target_role? }
   */
  async createNotification(req, res, next) {
    try {
      const { type, title, body, target_role } = req.body;

      const notification = await adminNotificationService.create({
        createdBy: req.profile.id,
        type,
        title,
        body,
        targetRole: target_role || 'all',
      });

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'create_notification',
        targetType: 'notification',
        targetId: notification.id,
        metadata: { type, title, targetRole: target_role || 'all' },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendCreated(res, 'Notification created successfully', notification);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/notifications/:id
   * Body: { title?, body?, target_role?, is_active? }
   */
  async updateNotification(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await adminNotificationService.update(id, req.body);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'update_notification',
        targetType: 'notification',
        targetId: id,
        metadata: { updates: req.body },
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Notification updated successfully', notification);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/admin/notifications/:id
   */
  async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      await adminNotificationService.delete(id);

      await auditLogService.record({
        adminId: req.profile.id,
        action: 'delete_notification',
        targetType: 'notification',
        targetId: id,
        metadata: {},
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Notification deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;
