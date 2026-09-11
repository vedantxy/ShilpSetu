'use strict';

const { supabaseAdmin } = require('../config/supabase');
const storageService = require('./storageService');
const MimeDetector = require('../utils/mimeDetector');
const sharp = require('sharp');
const path = require('path');
const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * MediaService — Validates, processes, stores, and manages media records with automatic cleanup on failure.
 */
class MediaService {
  /**
   * Upload and process an image file.
   *
   * @param {Buffer} buffer - File data buffer
   * @param {string} originalName - Original filename
   * @param {string} userId - Owner UUID
   * @param {Object} [options]
   * @param {string} [options.productId] - Associated product
   * @param {string} [options.bucket='product-images']
   */
  async uploadImage(buffer, originalName, userId, options = {}) {
    // 1. Binary MIME Validation (Never trust client header)
    const mimeValidation = MimeDetector.validateCategory(buffer, 'image');
    if (!mimeValidation.valid) {
      throw ApiError.badRequest(mimeValidation.error);
    }

    const detected = mimeValidation.detected;

    // 2. Extract dimensions & metadata using sharp
    let width = null;
    let height = null;
    let format = detected.extension;

    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width || null;
      height = meta.height || null;
      format = meta.format || detected.extension;
    } catch (err) {
      logger.error(`Failed to process image buffer with sharp: ${err.message}`);
      throw ApiError.badRequest('Corrupt or invalid image buffer');
    }

    // 3. Generate safe unique filename
    const safeBase = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `${Date.now()}-${safeBase}.${detected.extension}`;
    const bucket = options.bucket || 'product-images';

    // 4. Upload to storage provider
    let uploadResult;
    try {
      uploadResult = await storageService.upload(
        bucket,
        buffer,
        safeFilename,
        detected.mimeType,
        userId
      );
    } catch (storageErr) {
      logger.error(`Storage upload failed: ${storageErr.message}`);
      throw ApiError.internal(`Storage upload failed: ${storageErr.message}`);
    }

    // 5. Insert into media table (with automatic cleanup on error)
    try {
      const { data: mediaRecord, error: dbError } = await supabaseAdmin
        .from('media')
        .insert({
          owner_id: userId,
          product_id: options.productId || null,
          type: 'image',
          url: uploadResult.url,
          storage_key: uploadResult.path,
          bucket,
          mime_type: detected.mimeType,
          size: buffer.length,
          width,
          height,
          status: 'active',
          metadata: {
            format,
            originalName,
          },
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      return mediaRecord;
    } catch (dbErr) {
      // CLEANUP ON FAILURE: Delete uploaded file from storage
      logger.error(`DB insert failed for media, rolling back storage file ${uploadResult.path}: ${dbErr.message}`);
      await storageService.delete(bucket, uploadResult.path).catch((delErr) => {
        logger.error(`Rollback storage delete failed: ${delErr.message}`);
      });
      throw ApiError.internal(`Failed to record media: ${dbErr.message}`);
    }
  }

  /**
   * Upload and process an audio file.
   */
  async uploadAudio(buffer, originalName, userId, options = {}) {
    // 1. Binary MIME Validation
    const mimeValidation = MimeDetector.validateCategory(buffer, 'audio');
    if (!mimeValidation.valid) {
      throw ApiError.badRequest(mimeValidation.error);
    }

    const detected = mimeValidation.detected;

    // 2. Estimate audio duration based on size & format (approximate)
    let duration = options.duration || null;
    if (!duration && detected.extension === 'wav') {
      // 16-bit 44.1kHz mono WAV ~88.2 kB/sec
      duration = parseFloat((buffer.length / 88200).toFixed(2));
    } else if (!duration && detected.extension === 'mp3') {
      // 128 kbps MP3 ~16 kB/sec
      duration = parseFloat((buffer.length / 16000).toFixed(2));
    }

    // 3. Generate safe unique filename
    const safeBase = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `${Date.now()}-${safeBase}.${detected.extension}`;
    const bucket = options.bucket || 'product-images';

    // 4. Upload to storage provider
    let uploadResult;
    try {
      uploadResult = await storageService.upload(
        bucket,
        buffer,
        safeFilename,
        detected.mimeType,
        userId
      );
    } catch (storageErr) {
      logger.error(`Storage upload failed: ${storageErr.message}`);
      throw ApiError.internal(`Storage upload failed: ${storageErr.message}`);
    }

    // 5. Insert into media table with cleanup on failure
    try {
      const { data: mediaRecord, error: dbError } = await supabaseAdmin
        .from('media')
        .insert({
          owner_id: userId,
          product_id: options.productId || null,
          type: 'audio',
          url: uploadResult.url,
          storage_key: uploadResult.path,
          bucket,
          mime_type: detected.mimeType,
          size: buffer.length,
          duration,
          status: 'active',
          metadata: {
            originalName,
          },
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      return mediaRecord;
    } catch (dbErr) {
      // CLEANUP ON FAILURE
      logger.error(`DB insert failed for audio media, rolling back storage file ${uploadResult.path}: ${dbErr.message}`);
      await storageService.delete(bucket, uploadResult.path).catch((delErr) => {
        logger.error(`Rollback storage delete failed: ${delErr.message}`);
      });
      throw ApiError.internal(`Failed to record audio media: ${dbErr.message}`);
    }
  }

  /**
   * Retrieve media record with authorization check.
   *
   * @param {string} id - Media UUID
   * @param {Object} [requestingUser] - Authenticated user { id, role }
   */
  async getMediaById(id, requestingUser = null) {
    const { data: media, error } = await supabaseAdmin
      .from('media')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !media) {
      throw ApiError.notFound('Media asset not found');
    }

    // If media is linked to a product, check product status (published products have public media)
    if (media.product_id) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('status, seller_id')
        .eq('id', media.product_id)
        .single();

      if (product?.status === 'published') {
        return media; // Public marketplace access
      }
    }

    // Authorization check for private/draft media
    if (!requestingUser) {
      throw ApiError.unauthorized('Authentication required to access private media');
    }

    const isOwner = media.owner_id === requestingUser.id;
    const isAdmin = requestingUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to view this media asset');
    }

    return media;
  }

  /**
   * Delete media record and remove file from storage.
   */
  async deleteMedia(id, requestingUser) {
    const media = await this.getMediaById(id, requestingUser);

    const isOwner = media.owner_id === requestingUser.id;
    const isAdmin = requestingUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to delete this media asset');
    }

    // 1. Delete from DB
    const { error: dbError } = await supabaseAdmin
      .from('media')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw dbError;
    }

    // 2. Delete from Storage
    await storageService.delete(media.bucket, media.storage_key).catch((storageErr) => {
      logger.warn(`Storage delete warning for key ${media.storage_key}: ${storageErr.message}`);
    });

    return true;
  }
}

module.exports = new MediaService();
