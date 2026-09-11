'use strict';

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Audit Log Service
 *
 * Records sensitive admin operations to the audit_logs table.
 * Every call is fire-and-forget safe — errors are logged but never thrown,
 * so an audit failure never blocks the actual admin operation.
 */
const auditLogService = {
  /**
   * Record an admin action in the audit log.
   *
   * @param {object} params
   * @param {string} params.adminId     - ID of the admin performing the action
   * @param {string} params.action      - Action name e.g. 'verify_artisan'
   * @param {string} params.targetType  - Entity type: 'user'|'product'|'order'|'category'|'notification'
   * @param {string} params.targetId    - ID of the affected entity
   * @param {object} [params.metadata]  - Additional context (reason, old/new values, etc.)
   * @param {string} [params.ip]        - IP address of the request
   * @param {string} [params.userAgent] - User-agent string of the request
   */
  async record({ adminId, action, targetType, targetId, metadata = {}, ip = null, userAgent = null }) {
    try {
      const { error } = await supabaseAdmin.from('audit_logs').insert({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: String(targetId),
        metadata,
        ip,
        user_agent: userAgent,
      });

      if (error) {
        logger.warn(`Audit log insert failed [${action}]: ${error.message}`);
      } else {
        logger.info(`Audit: [${action}] by admin ${adminId} on ${targetType}:${targetId}`);
      }
    } catch (err) {
      // Never propagate — audit logging must never break admin operations
      logger.error(`Audit log service error: ${err.message}`);
    }
  },

  /**
   * Retrieve audit logs with optional filtering and pagination.
   *
   * @param {object} opts
   * @param {number}  [opts.page=1]
   * @param {number}  [opts.limit=50]
   * @param {string}  [opts.action]      - Filter by specific action
   * @param {string}  [opts.targetType]  - Filter by target entity type
   * @param {string}  [opts.adminId]     - Filter by specific admin
   */
  async getAll({ page = 1, limit = 50, action, targetType, adminId } = {}) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(
        `
        id, action, target_type, target_id, metadata, ip, user_agent, created_at,
        profiles!audit_logs_admin_id_fkey(id, full_name, email)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);
    if (targetType) query = query.eq('target_type', targetType);
    if (adminId) query = query.eq('admin_id', adminId);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Audit log fetch failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },
};

module.exports = auditLogService;
