'use strict';

const { supabaseAdmin } = require('../config/supabase');
const pushNotificationService = require('./pushNotificationService');
const logger = require('../utils/logger');

/**
 * NotificationService — Manages in-app notifications and triggers push alerts.
 */
class NotificationService {
  /**
   * Create an in-app notification and optionally trigger a push alert.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.type - e.g. 'product_published', 'order_created', etc.
   * @param {string} params.title
   * @param {string} params.message
   * @param {Object} [params.data={}]
   * @param {boolean} [params.sendPush=true]
   */
  async createNotification(params) {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      sendPush = true,
    } = params;

    if (!userId || !type || !title || !message) {
      throw new Error('userId, type, title, and message are required for notification');
    }

    // 1. Insert in-app notification record
    const { data: record, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      logger.error(`Failed to create notification record for user ${userId}: ${error.message}`);
      throw error;
    }

    // 2. Trigger push notification asynchronously (isolated)
    if (sendPush) {
      pushNotificationService
        .sendToUser(userId, {
          title,
          body: message,
          data: { ...data, notificationId: record.id, type },
        })
        .catch((pushErr) => {
          logger.warn(`Push dispatch failed for notification ${record.id}: ${pushErr.message}`);
        });
    }

    return record;
  }

  /**
   * List paginated notifications for a user.
   */
  async getUserNotifications(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      isRead,
      type,
    } = options;

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (typeof isRead === 'boolean') {
      query = query.eq('is_read', isRead);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Failed to fetch notifications for user ${userId}: ${error.message}`);
      throw error;
    }

    return {
      notifications: data || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + (data?.length || 0)) < (count || 0),
    };
  }

  /**
   * Get unread notifications count for a user badge.
   */
  async getUnreadCount(userId) {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error(`Failed to get unread count for user ${userId}: ${error.message}`);
      throw error;
    }

    return count || 0;
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id, userId) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('Notification not found or unauthorized');
    }

    return data;
  }

  /**
   * Mark all unread notifications for a user as read.
   */
  async markAllAsRead(userId) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      logger.error(`Failed to mark all as read for user ${userId}: ${error.message}`);
      throw error;
    }

    return {
      markedCount: data?.length || 0,
    };
  }
}

module.exports = new NotificationService();
