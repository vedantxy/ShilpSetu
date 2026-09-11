'use strict';

const catalogService = require('../services/catalogService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * CatalogController — AI-powered craft storytelling, structured catalog generation,
 * translation, and review workflow.
 */
class CatalogController {
  /**
   * POST /api/ai/catalog/generate
   */
  async generate(req, res, next) {
    try {
      const userId = req.user?.id || 'anonymous';
      const input = req.body;
      const imageFile = req.file || null;

      const result = await catalogService.generateCatalog(userId, input, imageFile);

      return sendSuccess(res, result.message, result, 201);
    } catch (err) {
      logger.error(`Catalog generation error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/catalog/translate
   */
  async translate(req, res, next) {
    try {
      const userId = req.user?.id || 'anonymous';
      const { targetLanguages, ...content } = req.body;

      const result = await catalogService.translateContent(
        userId,
        content,
        targetLanguages || ['hi', 'gu', 'en']
      );

      if (result.status === 'provider_unavailable') {
        return sendSuccess(res, 'Translation provider not configured', {
          status: 'provider_unavailable',
          error: result.error,
        });
      }

      return sendSuccess(res, 'Content translated successfully', result);
    } catch (err) {
      logger.error(`Catalog translation error: ${err.message}`);
      next(err);
    }
  }

  /**
   * PATCH /api/ai/catalog/:id/review
   */
  async review(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const edits = req.body;

      const updated = await catalogService.reviewContent(id, userId, edits);
      return sendSuccess(res, 'AI content review saved', updated);
    } catch (err) {
      logger.error(`Review catalog error: ${err.message}`);
      next(err);
    }
  }

  /**
   * PATCH /api/ai/catalog/:id/approve
   */
  async approve(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const approved = await catalogService.approveContent(id, userId);
      return sendSuccess(res, 'AI content approved for publishing', approved);
    } catch (err) {
      logger.error(`Approve catalog error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/catalog/:id/apply
   */
  async apply(req, res, next) {
    try {
      const { id } = req.params;
      const { productId } = req.body;
      const userId = req.user?.id;

      if (!productId) {
        return next(ApiError.badRequest('Target productId is required'));
      }

      const result = await catalogService.applyToProduct(id, productId, userId);
      return sendSuccess(res, result.message, result);
    } catch (err) {
      logger.error(`Apply catalog to product error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/catalog/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const record = await catalogService.getContentById(id, userId);
      return sendSuccess(res, 'AI content record retrieved', record);
    } catch (err) {
      logger.error(`Get catalog error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/catalog
   */
  async list(req, res, next) {
    try {
      const userId = req.user?.id;
      const { productId, status, limit, offset } = req.query;

      const result = await catalogService.listContent(userId, {
        productId,
        status,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return sendSuccess(res, 'AI content records retrieved', result);
    } catch (err) {
      logger.error(`List catalog error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new CatalogController();
