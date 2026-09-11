'use strict';

const sharpProvider = require('../providers/image/sharpProvider');
const removeBgProvider = require('../providers/image/removeBgProvider');
const storageService = require('./storageService');
const logger = require('../utils/logger');

/**
 * ImageProcessingService — Coordinates image operations (upload, enhancement, crop, compress, bg-removal, before-after).
 *
 * Implements the ImageService abstraction:
 *  - upload
 *  - backgroundRemoval
 *  - enhancement
 *  - crop
 *  - compression
 *  - comparison (before-after)
 */
class ImageProcessingService {
  /**
   * Upload an original unprocessed image to storage.
   */
  async upload(fileBuffer, originalName, mimeType, userId) {
    const meta = await sharpProvider.getMetadata(fileBuffer);
    const uploadResult = await storageService.upload(
      'product-images',
      fileBuffer,
      originalName,
      mimeType,
      userId
    );

    return {
      url: uploadResult.url,
      path: uploadResult.path,
      metadata: {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        sizeBytes: meta.sizeBytes,
        channels: meta.channels,
        hasAlpha: meta.hasAlpha,
      },
    };
  }

  /**
   * Remove background from image.
   * Uses removeBgProvider if configured, else returns provider_unavailable.
   */
  async removeBackground(fileBuffer, mimeType, userId, originalName = 'nobg.png') {
    const result = await removeBgProvider.removeBackground(fileBuffer, mimeType);

    if (result.status === 'provider_unavailable') {
      return {
        status: 'provider_unavailable',
        message: result.message,
        featureFlag: result.featureFlag,
      };
    }

    if (result.status !== 'success' || !result.buffer) {
      throw new Error(result.message || 'Background removal failed');
    }

    const uploadResult = await storageService.upload(
      'product-images',
      result.buffer,
      `nobg-${originalName.replace(/\.[^/.]+$/, '')}.png`,
      'image/png',
      userId
    );

    const meta = await sharpProvider.getMetadata(result.buffer);

    return {
      status: 'success',
      url: uploadResult.url,
      path: uploadResult.path,
      metadata: {
        width: meta.width,
        height: meta.height,
        format: 'png',
        sizeBytes: meta.sizeBytes,
      },
    };
  }

  /**
   * Enhance image using local sharp processing.
   */
  async enhance(fileBuffer, options, userId, originalName = 'enhanced.webp') {
    const originalMeta = await sharpProvider.getMetadata(fileBuffer);
    const enhanced = await sharpProvider.enhance(fileBuffer, options);

    const uploadResult = await storageService.upload(
      'product-images',
      enhanced.buffer,
      `enhanced-${originalName.replace(/\.[^/.]+$/, '')}.webp`,
      'image/webp',
      userId
    );

    return {
      status: 'success',
      url: uploadResult.url,
      path: uploadResult.path,
      originalMetadata: originalMeta,
      enhancedMetadata: {
        width: enhanced.width,
        height: enhanced.height,
        format: enhanced.format,
        sizeBytes: enhanced.sizeBytes,
      },
    };
  }

  /**
   * Crop image using local sharp processing.
   */
  async crop(fileBuffer, options, userId, originalName = 'cropped.webp') {
    const cropped = await sharpProvider.crop(fileBuffer, options);

    const uploadResult = await storageService.upload(
      'product-images',
      cropped.buffer,
      `cropped-${originalName.replace(/\.[^/.]+$/, '')}.webp`,
      'image/webp',
      userId
    );

    return {
      status: 'success',
      url: uploadResult.url,
      path: uploadResult.path,
      metadata: {
        width: cropped.width,
        height: cropped.height,
        format: cropped.format,
        sizeBytes: cropped.sizeBytes,
      },
    };
  }

  /**
   * Compress image using local sharp processing.
   */
  async compress(fileBuffer, options, userId, originalName = 'compressed.webp') {
    const compressed = await sharpProvider.compress(fileBuffer, options);

    const uploadResult = await storageService.upload(
      'product-images',
      compressed.buffer,
      `compressed-${originalName.replace(/\.[^/.]+$/, '')}.webp`,
      'image/webp',
      userId
    );

    return {
      status: 'success',
      url: uploadResult.url,
      path: uploadResult.path,
      metadata: {
        width: compressed.width,
        height: compressed.height,
        format: compressed.format,
        sizeBytes: compressed.sizeBytes,
        originalSizeBytes: compressed.originalSizeBytes,
        compressionRatio: compressed.compressionRatio,
      },
    };
  }

  /**
   * Generate Before / After comparison result.
   * Takes an original image, applies enhancement or processing, and returns both URLs + comparison metrics.
   */
  async beforeAfter(fileBuffer, options, userId, originalName = 'image.webp') {
    const originalUpload = await storageService.upload(
      'product-images',
      fileBuffer,
      `original-${originalName}`,
      'image/jpeg',
      userId
    );

    const originalMeta = await sharpProvider.getMetadata(fileBuffer);
    const enhanced = await sharpProvider.enhance(fileBuffer, options);

    const enhancedUpload = await storageService.upload(
      'product-images',
      enhanced.buffer,
      `enhanced-${originalName.replace(/\.[^/.]+$/, '')}.webp`,
      'image/webp',
      userId
    );

    return {
      status: 'success',
      before: {
        url: originalUpload.url,
        path: originalUpload.path,
        width: originalMeta.width,
        height: originalMeta.height,
        format: originalMeta.format,
        sizeBytes: originalMeta.sizeBytes,
      },
      after: {
        url: enhancedUpload.url,
        path: enhancedUpload.path,
        width: enhanced.width,
        height: enhanced.height,
        format: enhanced.format,
        sizeBytes: enhanced.sizeBytes,
      },
      improvements: [
        'Enhanced sharpness and clarity on fine craft textures',
        'Balanced contrast and brightness for true-to-life colors',
        'Converted to WebP format for high compression with near-zero quality loss',
      ],
    };
  }
}

module.exports = new ImageProcessingService();
