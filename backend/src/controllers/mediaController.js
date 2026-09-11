'use strict';

const mediaService = require('../services/mediaService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * MediaController — Handles image and audio uploads, metadata retrieval, and deletion.
 */
class MediaController {
  /**
   * POST /api/media/image
   */
  async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Image file is required (field name: image)'));
      }

      const userId = req.user.id;
      const media = await mediaService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        userId,
        {
          productId: req.body.productId,
          bucket: req.body.bucket || 'product-images',
        }
      );

      return sendSuccess(res, 'Image uploaded and media record created', media, 201);
    } catch (err) {
      logger.error(`Media image upload controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/media/audio
   */
  async uploadAudio(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Audio file is required (field name: audio)'));
      }

      const userId = req.user.id;
      const media = await mediaService.uploadAudio(
        req.file.buffer,
        req.file.originalname,
        userId,
        {
          productId: req.body.productId,
          duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
          bucket: req.body.bucket || 'product-images',
        }
      );

      return sendSuccess(res, 'Audio uploaded and media record created', media, 201);
    } catch (err) {
      logger.error(`Media audio upload controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/media/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const requestingUser = req.user || null;

      const media = await mediaService.getMediaById(id, requestingUser);
      return sendSuccess(res, 'Media retrieved successfully', media);
    } catch (err) {
      logger.error(`Get media error: ${err.message}`);
      next(err);
    }
  }

  /**
   * DELETE /api/media/:id
   */
  async deleteMedia(req, res, next) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      await mediaService.deleteMedia(id, requestingUser);
      return sendSuccess(res, 'Media asset deleted successfully');
    } catch (err) {
      logger.error(`Delete media error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new MediaController();
