'use strict';

const pricingService = require('../services/pricingService');
const marketPriceService = require('../services/marketPriceService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * PricingController — Pricing assistant, cost calculation, profit margins, and market intelligence.
 */
class PricingController {
  /**
   * POST /api/ai/pricing/calculate
   */
  async calculate(req, res, next) {
    try {
      const userId = req.user?.id || 'anonymous';
      const input = req.body;

      const result = await pricingService.calculatePrice(userId, input);
      return sendSuccess(res, 'Pricing calculated successfully', result, 201);
    } catch (err) {
      logger.error(`Pricing calculation error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/pricing/signals
   */
  async getMarketSignals(req, res, next) {
    try {
      const { category } = req.query;
      const signals = marketPriceService.getCategorySignals(category || 'handloom');
      return sendSuccess(res, 'Market pricing signals retrieved', signals);
    } catch (err) {
      logger.error(`Get market signals error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/pricing/:id
   */
  async getRecord(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const record = await pricingService.getRecordById(id, userId);
      return sendSuccess(res, 'Pricing record retrieved', record);
    } catch (err) {
      logger.error(`Get pricing record error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/pricing
   */
  async listRecords(req, res, next) {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit, 10) || 20;

      const records = await pricingService.listRecords(userId, limit);
      return sendSuccess(res, 'Pricing records retrieved', records);
    } catch (err) {
      logger.error(`List pricing records error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new PricingController();
