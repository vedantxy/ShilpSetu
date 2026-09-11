'use strict';

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Admin Notification Service
 *
 * Manages system-wide notifications created by admins:
 * - announcement: general platform announcements
 * - product_alert: alerts related to product issues or updates
 * - system_message: technical/maintenance messages
 */
const adminNotificationService = {
  /**
   * Get all notifications with optional filters.
   */
  async getAll({ page = 1, limit = 20, type, targetRole, isActive } = {}) {
    const offset = (page - 1) * limit;
    let query = supabaseAdmin
      .from('admin_notifications')
      .select(
        `*, profiles!admin_notifications_created_by_fkey(id, full_name, email)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (targetRole) query = query.eq('target_role', targetRole);
    if (isActive !== undefined) query = query.eq('is_active', isActive);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Notification list failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },

  /**
   * Create a new system-wide notification.
   *
   * @param {object} params
   * @param {string} params.createdBy  - Admin's user ID
   * @param {string} params.type       - 'announcement'|'product_alert'|'system_message'
   * @param {string} params.title
   * @param {string} params.body
   * @param {string} [params.targetRole] - 'all'|'buyer'|'seller'|'admin'
   */
  async create({ createdBy, type, title, body, targetRole = 'all' }) {
    const VALID_TYPES = ['announcement', 'product_alert', 'system_message'];
    const VALID_ROLES = ['all', 'buyer', 'seller', 'admin'];

    if (!VALID_TYPES.includes(type)) {
      const err = new Error(`Invalid type. Allowed: ${VALID_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    if (!VALID_ROLES.includes(targetRole)) {
      const err = new Error(`Invalid targetRole. Allowed: ${VALID_ROLES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
        created_by: createdBy,
        type,
        title,
        body,
        target_role: targetRole,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error(`Notification create failed: ${error.message}`);
      throw error;
    }

    logger.info(`Admin notification created: [${type}] "${title}" → ${targetRole}`);
    return data;
  },

  /**
   * Update a notification (title, body, targetRole, is_active).
   */
  async update(notificationId, updates) {
    // Strip immutable fields
    const { id, created_by, created_at, ...safeUpdates } = updates;

    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      logger.error(`Notification update failed for ${notificationId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Soft-delete a notification by setting is_active=false,
   * or hard-delete it from the database.
   */
  async delete(notificationId) {
    const { error } = await supabaseAdmin
      .from('admin_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      logger.error(`Notification delete failed for ${notificationId}: ${error.message}`);
      throw error;
    }

    return true;
  },
};

module.exports = adminNotificationService;
