'use strict';

const imageProcessingService = require('../services/imageProcessingService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * ImageController — Handles image uploads, transformations, and comparisons.
 */
class ImageController {
  /**
   * POST /api/ai/image/upload
   */
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const result = await imageProcessingService.upload(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId
      );

      return sendSuccess(res, 'Image uploaded successfully', result, 201);
    } catch (err) {
      logger.error(`Image upload controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/image/background-remove
   */
  async removeBackground(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const result = await imageProcessingService.removeBackground(
        req.file.buffer,
        req.file.mimetype,
        userId,
        req.file.originalname
      );

      if (result.status === 'provider_unavailable') {
        return sendSuccess(
          res,
          result.message,
          { status: 'provider_unavailable', featureFlag: result.featureFlag },
          200
        );
      }

      return sendSuccess(res, 'Background removed successfully', result);
    } catch (err) {
      logger.error(`Image background removal controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/image/enhance
   */
  async enhance(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const options = {
        sharpen: parseFloat(req.body.sharpen) || 1,
        brightness: parseFloat(req.body.brightness) || 1.05,
        saturation: parseFloat(req.body.saturation) || 1.2,
        contrast: parseFloat(req.body.contrast) || 1.1,
      };

      const result = await imageProcessingService.enhance(
        req.file.buffer,
        options,
        userId,
        req.file.originalname
      );

      return sendSuccess(res, 'Image enhanced successfully', result);
    } catch (err) {
      logger.error(`Image enhancement controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/image/crop
   */
  async crop(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const options = {
        width: parseInt(req.body.width, 10),
        height: parseInt(req.body.height, 10),
        fit: req.body.fit || 'cover',
        position: req.body.position || 'centre',
      };

      if (!options.width || !options.height) {
        return next(ApiError.badRequest('Target width and height in pixels are required'));
      }

      const result = await imageProcessingService.crop(
        req.file.buffer,
        options,
        userId,
        req.file.originalname
      );

      return sendSuccess(res, 'Image cropped successfully', result);
    } catch (err) {
      logger.error(`Image crop controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/image/compress
   */
  async compress(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const options = {
        quality: parseInt(req.body.quality, 10) || 75,
        maxWidthPx: parseInt(req.body.maxWidthPx, 10) || 1920,
      };

      const result = await imageProcessingService.compress(
        req.file.buffer,
        options,
        userId,
        req.file.originalname
      );

      return sendSuccess(res, 'Image compressed successfully', result);
    } catch (err) {
      logger.error(`Image compression controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/ai/image/before-after
   */
  async beforeAfter(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user?.id || 'anonymous';
      const options = {
        sharpen: parseFloat(req.body.sharpen) || 1.2,
        brightness: parseFloat(req.body.brightness) || 1.08,
        saturation: parseFloat(req.body.saturation) || 1.25,
        contrast: parseFloat(req.body.contrast) || 1.15,
      };

      const result = await imageProcessingService.beforeAfter(
        req.file.buffer,
        options,
        userId,
        req.file.originalname
      );

      return sendSuccess(res, 'Before/After comparison generated', result);
    } catch (err) {
      logger.error(`Before/After controller error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new ImageController();
