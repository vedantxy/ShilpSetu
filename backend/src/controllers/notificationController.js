'use strict';

const notificationService = require('../services/notificationService');
const pushNotificationService = require('../services/pushNotificationService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * NotificationController — In-app notification feeds, unread badge counts, and push token management.
 */
class NotificationController {
  /**
   * GET /api/notifications
   */
  async list(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, offset, isRead, type } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        isRead: isRead !== undefined ? isRead === 'true' || isRead === true : undefined,
        type,
      });

      return sendSuccess(res, 'Notifications retrieved successfully', result);
    } catch (err) {
      logger.error(`List notifications controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);
      return sendSuccess(res, 'Unread count retrieved', { unreadCount: count });
    } catch (err) {
      logger.error(`Get unread count controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const updated = await notificationService.markAsRead(id, userId);
      return sendSuccess(res, 'Notification marked as read', updated);
    } catch (err) {
      logger.error(`Mark notification read controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   */
  async markAllRead(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await notificationService.markAllAsRead(userId);
      return sendSuccess(res, 'All notifications marked as read', result);
    } catch (err) {
      logger.error(`Mark all read controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/notifications/push-token
   */
  async registerPushToken(req, res, next) {
    try {
      const userId = req.user.id;
      const tokenRecord = await pushNotificationService.registerToken(userId, req.body);
      return sendSuccess(res, 'Push token registered successfully', tokenRecord, 201);
    } catch (err) {
      logger.error(`Register push token controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * DELETE /api/notifications/push-token/:token
   */
  async removePushToken(req, res, next) {
    try {
      const userId = req.user.id;
      const { token } = req.params;

      await pushNotificationService.removeToken(userId, decodeURIComponent(token));
      return sendSuccess(res, 'Push token removed successfully');
    } catch (err) {
      logger.error(`Remove push token controller error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new NotificationController();
