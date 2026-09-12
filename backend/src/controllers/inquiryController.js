'use strict';

const inquiryService = require('../services/inquiryService');
const { sendSuccess, sendCreated } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

class InquiryController {
  async create(req, res, next) {
    try {
      const { productId, message } = req.body;
      const buyerId = req.user.id;

      if (!productId || !message) {
        throw ApiError.badRequest('productId and message are required');
      }

      const inquiry = await inquiryService.create({ productId, buyerId, message });
      return sendCreated(res, 'Inquiry sent successfully', inquiry);
    } catch (err) {
      logger.error(`Create inquiry error: ${err.message}`);
      next(err);
    }
  }

  async getMyInquiries(req, res, next) {
    try {
      const userId = req.user.id;
      const role = req.profile?.role || 'buyer';

      let result;
      if (role === 'seller') {
        result = await inquiryService.getBySeller(userId, req.query);
      } else {
        result = await inquiryService.getByBuyer(userId, req.query);
      }

      return sendSuccess(res, 'Inquiries retrieved successfully', result);
    } catch (err) {
      logger.error(`Get inquiries error: ${err.message}`);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const inquiry = await inquiryService.getById(req.params.id);
      return sendSuccess(res, 'Inquiry retrieved successfully', inquiry);
    } catch (err) {
      logger.error(`Get inquiry by id error: ${err.message}`);
      next(err);
    }
  }

  async respond(req, res, next) {
    try {
      const { response } = req.body;
      if (!response) throw ApiError.badRequest('response text is required');

      const updated = await inquiryService.respond(req.params.id, response);
      return sendSuccess(res, 'Response sent successfully', updated);
    } catch (err) {
      logger.error(`Respond to inquiry error: ${err.message}`);
      next(err);
    }
  }

  async close(req, res, next) {
    try {
      const updated = await inquiryService.close(req.params.id);
      return sendSuccess(res, 'Inquiry closed successfully', updated);
    } catch (err) {
      logger.error(`Close inquiry error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new InquiryController();
