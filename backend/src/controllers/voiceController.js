'use strict';

const voiceService = require('../services/voiceService');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * VoiceController — Audio upload, speech transcription, language detection, and craft intent extraction.
 */
class VoiceController {
  /**
   * POST /api/ai/voice/transcribe
   */
  async transcribe(req, res, next) {
    try {
      if (!req.file) {
        return next(ApiError.badRequest('Audio file is required (field name: audio)'));
      }

      const userId = req.user?.id || 'anonymous';
      const options = {
        languageCode: req.body.languageCode || 'hi-IN',
        productId: req.body.productId,
      };

      const result = await voiceService.processAudio(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        options
      );

      return sendSuccess(res, result.message, result, 201);
    } catch (err) {
      logger.error(`Voice transcription controller error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/voice/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const record = await voiceService.getTranscription(id, userId);
      return sendSuccess(res, 'Voice transcription retrieved', record);
    } catch (err) {
      logger.error(`Get voice transcription error: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/ai/voice
   */
  async list(req, res, next) {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit, 10) || 20;

      const records = await voiceService.listUserTranscriptions(userId, limit);
      return sendSuccess(res, 'User transcriptions retrieved', records);
    } catch (err) {
      logger.error(`List voice transcriptions error: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new VoiceController();
