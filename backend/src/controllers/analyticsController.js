'use strict';

const analyticsService = require('../services/analyticsService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * AnalyticsController — Telemetry ingestion and analytics dashboards for Sellers, Buyers, and Admins.
 */
class AnalyticsController {
  /**
   * POST /api/analytics/track
   */
  async track(req, res, next) {
    try {
      const { eventName, entityType, entityId, metadata } = req.body;
      const userId = req.user?.id || null;

      // Asynchronously track
      analyticsService.trackEvent(eventName, {
        userId,
        entityType,
        entityId,
        metadata,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      return sendSuccess(res, 'Event tracked successfully', { tracked: true }, 202);
    } catch (err) {
      logger.error(`Analytics track error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/analytics/seller
   */
  async getSellerAnalytics(req, res, next) {
    try {
      const sellerId = req.user.id;
      const data = await analyticsService.getSellerAnalytics(sellerId);
      return sendSuccess(res, 'Seller analytics retrieved successfully', data);
    } catch (err) {
      logger.error(`Get seller analytics error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/analytics/buyer
   */
  async getBuyerAnalytics(req, res, next) {
    try {
      const buyerId = req.user.id;
      const data = await analyticsService.getBuyerAnalytics(buyerId);
      return sendSuccess(res, 'Buyer analytics retrieved successfully', data);
    } catch (err) {
      logger.error(`Get buyer analytics error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/analytics/admin
   */
  async getAdminAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getAdminAnalytics();
      return sendSuccess(res, 'Admin analytics overview retrieved successfully', data);
    } catch (err) {
      logger.error(`Get admin analytics error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
