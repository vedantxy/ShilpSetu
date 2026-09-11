'use strict';

const { z } = require('zod');

/**
 * Admin Validators — Zod schemas for all /api/admin/* request bodies and query params.
 */

// ─── User Management ──────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/status
 */
const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated'], {
    errorMap: () => ({ message: 'Status must be one of: active, suspended, deactivated' }),
  }),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/admin/users/:id/role
 * Highly protected — only admin can call this endpoint.
 */
const updateUserRoleSchema = z.object({
  role: z.enum(['buyer', 'seller', 'admin'], {
    errorMap: () => ({ message: 'Role must be one of: buyer, seller, admin' }),
  }),
  reason: z.string().max(500).optional(),
});

// ─── Artisan Management ───────────────────────────────────────────────────────

/**
 * POST /api/admin/artisans/:id/verify|reject|suspend
 * The body is optional — a reason can be provided for reject/suspend.
 */
const artisanActionSchema = z.object({
  reason: z.string().min(3).max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

// ─── Product Moderation ───────────────────────────────────────────────────────

/**
 * POST /api/admin/products/:id/reject
 * Reject MUST include a reason.
 */
const rejectProductSchema = z.object({
  reason: z.string({
    required_error: 'A rejection reason is required',
  }).min(5, 'Rejection reason must be at least 5 characters').max(1000),
  notes: z.string().max(2000).optional(),
});

// ─── Category Management ──────────────────────────────────────────────────────

/**
 * POST /api/admin/categories
 */
const createCategorySchema = z.object({
  name: z.string({
    required_error: 'Category name is required',
  }).min(2).max(100),
  icon: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional().default(true),
});

/**
 * PATCH /api/admin/categories/:id
 */
const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  icon: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

// ─── Order Management ─────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/orders/:id/status
 */
const updateOrderStatusSchema = z.object({
  status: z.enum(
    ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'disputed'],
    { errorMap: () => ({ message: 'Invalid order status' }) }
  ),
  notes: z.string().max(1000).optional(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/notifications
 */
const createNotificationSchema = z.object({
  type: z.enum(['announcement', 'product_alert', 'system_message'], {
    errorMap: () => ({ message: 'Type must be: announcement, product_alert, or system_message' }),
  }),
  title: z.string({
    required_error: 'Notification title is required',
  }).min(3).max(255),
  body: z.string({
    required_error: 'Notification body is required',
  }).min(5).max(5000),
  target_role: z.enum(['all', 'buyer', 'seller', 'admin']).optional().default('all'),
});

/**
 * PATCH /api/admin/notifications/:id
 */
const updateNotificationSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  body: z.string().min(5).max(5000).optional(),
  target_role: z.enum(['all', 'buyer', 'seller', 'admin']).optional(),
  is_active: z.boolean().optional(),
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/* ?range=7d|30d|90d|1y
 */
const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y'], {
    errorMap: () => ({ message: 'Range must be one of: 7d, 30d, 90d, 1y' }),
  }).optional().default('30d'),
});

module.exports = {
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
};
