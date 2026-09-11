'use strict';

const sharp = require('sharp');
const logger = require('../../utils/logger');

/**
 * Sharp Provider — Local image processing using the `sharp` library.
 *
 * This provider runs entirely on the server with NO external API calls.
 * It is always available regardless of API key configuration.
 *
 * Operations:
 *  - enhance   : sharpen + brightness/contrast/saturation boost
 *  - crop      : smart crop / exact crop to dimensions
 *  - compress  : reduce file size while maintaining acceptable quality
 */
const sharpProvider = {
  /**
   * Enhance an image: sharpen, increase contrast and saturation.
   * Intended for product photography improvements.
   *
   * @param {Buffer} inputBuffer - Raw image buffer from multer
   * @param {object} [opts]
   * @param {number} [opts.sharpen=1]       - Sigma for unsharp mask (0.5–3)
   * @param {number} [opts.brightness=1.05] - Brightness multiplier
   * @param {number} [opts.saturation=1.2]  - Saturation multiplier
   * @param {number} [opts.contrast=1.1]    - Contrast multiplier
   * @returns {Promise<{ buffer: Buffer, format: string, width: number, height: number, sizeBytes: number }>}
   */
  async enhance(inputBuffer, opts = {}) {
    const {
      sharpen = 1,
      brightness = 1.05,
      saturation = 1.2,
      contrast = 1.1,
    } = opts;

    const pipeline = sharp(inputBuffer)
      .sharpen({ sigma: sharpen })
      .modulate({ brightness, saturation })
      .linear(contrast, -(128 * contrast) + 128); // contrast adjustment

    const { data, info } = await pipeline
      .toFormat('webp', { quality: 90 })
      .toBuffer({ resolveWithObject: true });

    logger.debug(`sharp enhance: ${info.width}x${info.height} ${info.size}bytes`);

    return {
      buffer: data,
      format: 'webp',
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
    };
  },

  /**
   * Crop an image to specified dimensions.
   *
   * @param {Buffer} inputBuffer
   * @param {object} opts
   * @param {number} opts.width      - Target width in pixels
   * @param {number} opts.height     - Target height in pixels
   * @param {'cover'|'contain'|'fill'} [opts.fit='cover'] - Crop fit strategy
   * @param {string} [opts.position='centre'] - Focus area
   * @returns {Promise<{ buffer: Buffer, format: string, width: number, height: number, sizeBytes: number }>}
   */
  async crop(inputBuffer, opts = {}) {
    const { width, height, fit = 'cover', position = 'centre' } = opts;

    if (!width || !height) {
      throw new Error('crop requires width and height');
    }

    const { data, info } = await sharp(inputBuffer)
      .resize({ width: parseInt(width), height: parseInt(height), fit, position })
      .toFormat('webp', { quality: 88 })
      .toBuffer({ resolveWithObject: true });

    logger.debug(`sharp crop: ${info.width}x${info.height} ${info.size}bytes`);

    return {
      buffer: data,
      format: 'webp',
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
    };
  },

  /**
   * Compress an image to reduce file size.
   *
   * @param {Buffer} inputBuffer
   * @param {object} [opts]
   * @param {number} [opts.quality=75]      - WebP quality (1–100)
   * @param {number} [opts.maxWidthPx=1920] - Downscale if wider than this
   * @returns {Promise<{ buffer: Buffer, format: string, width: number, height: number, sizeBytes: number, compressionRatio: string }>}
   */
  async compress(inputBuffer, opts = {}) {
    const { quality = 75, maxWidthPx = 1920 } = opts;
    const originalSize = inputBuffer.length;

    const { data, info } = await sharp(inputBuffer)
      .resize({ width: maxWidthPx, withoutEnlargement: true })
      .toFormat('webp', { quality: parseInt(quality) })
      .toBuffer({ resolveWithObject: true });

    const ratio = ((1 - info.size / originalSize) * 100).toFixed(1);
    logger.debug(`sharp compress: ${originalSize} → ${info.size} bytes (${ratio}% saved)`);

    return {
      buffer: data,
      format: 'webp',
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
      compressionRatio: `${ratio}%`,
      originalSizeBytes: originalSize,
    };
  },

  /**
   * Get image metadata (dimensions, format, size) without processing.
   *
   * @param {Buffer} inputBuffer
   * @returns {Promise<{ width: number, height: number, format: string, sizeBytes: number }>}
   */
  async getMetadata(inputBuffer) {
    const meta = await sharp(inputBuffer).metadata();
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      sizeBytes: inputBuffer.length,
      channels: meta.channels,
      hasAlpha: meta.hasAlpha,
    };
  },
};

module.exports = sharpProvider;
