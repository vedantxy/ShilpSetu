'use strict';

const orderService = require('../services/orderService');
const { sendSuccess, sendCreated } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * OrderController — Handles order placement, buyer order history, and cancellation.
 */
class OrderController {
  /**
   * POST /api/orders
   */
  async create(req, res, next) {
    try {
      const buyerId = req.user.id;
      const order = await orderService.createOrder(buyerId, req.body);
      return sendCreated(res, 'Order placed successfully', order);
    } catch (err) {
      logger.error(`Create order error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/orders
   */
  async getMyOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.profile?.role || 'buyer';

      let result;
      if (role === 'seller') {
        result = await orderService.getSellerOrders(userId, req.query);
      } else {
        result = await orderService.getBuyerOrders(userId, req.query);
      }

      return sendSuccess(res, 'Orders retrieved successfully', result);
    } catch (err) {
      logger.error(`Get orders error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/orders/:id
   */
  async getById(req, res, next) {
    try {
      const order = await orderService.getOrderById(req.params.id, {
        id: req.user.id,
        role: req.profile?.role || 'buyer',
      });
      return sendSuccess(res, 'Order retrieved successfully', order);
    } catch (err) {
      logger.error(`Get order by id error: ${err.message}`);
      next(err);
    }
  }

  /**
   * PATCH /api/orders/:id/cancel
   */
  async cancel(req, res, next) {
    try {
      const updated = await orderService.cancelOrder(
        req.params.id,
        req.user.id,
        req.profile?.role || 'buyer'
      );
      return sendSuccess(res, 'Order cancelled successfully', updated);
    } catch (err) {
      logger.error(`Cancel order error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new OrderController();
