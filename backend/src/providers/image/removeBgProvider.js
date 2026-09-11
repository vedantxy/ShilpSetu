'use strict';

const https = require('https');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Remove.bg Provider — Background removal via the remove.bg API.
 *
 * This provider is OPTIONAL. If REMOVEBG_API_KEY is not set, all methods
 * return { status: 'provider_unavailable' } without throwing errors.
 *
 * Set env vars to activate:
 *   IMAGE_BG_REMOVAL_PROVIDER=removebg
 *   REMOVEBG_API_KEY=your_key_here
 */
const removeBgProvider = {
  /**
   * Whether this provider is configured and ready.
   */
  isAvailable() {
    return (
      env.IMAGE_BG_REMOVAL_PROVIDER === 'removebg' &&
      Boolean(env.REMOVEBG_API_KEY)
    );
  },

  /**
   * Remove the background from an image.
   *
   * @param {Buffer} imageBuffer  - Raw image buffer
   * @param {string} mimeType     - e.g. 'image/jpeg'
   * @returns {Promise<{
   *   status: 'success'|'provider_unavailable'|'error',
   *   buffer?: Buffer,
   *   format?: string,
   *   message?: string
   * }>}
   */
  async removeBackground(imageBuffer, mimeType = 'image/jpeg') {
    if (!this.isAvailable()) {
      logger.info('removeBgProvider: provider not configured — returning unavailable');
      return {
        status: 'provider_unavailable',
        message:
          'Background removal is not configured. Set IMAGE_BG_REMOVAL_PROVIDER=removebg and REMOVEBG_API_KEY to enable this feature.',
        featureFlag: 'background_removal',
      };
    }

    try {
      const resultBuffer = await this._callRemoveBgApi(imageBuffer, mimeType);
      logger.info('removeBgProvider: background removed successfully');
      return {
        status: 'success',
        buffer: resultBuffer,
        format: 'png', // remove.bg always returns PNG (preserves transparency)
      };
    } catch (err) {
      // Log the real error internally — never expose API details to client
      logger.error(`removeBgProvider: API call failed — ${err.message}`);
      return {
        status: 'error',
        message: 'Background removal service encountered an error. Please try again later.',
      };
    }
  },

  /**
   * @private
   * Make the remove.bg API call.
   */
  _callRemoveBgApi(imageBuffer, mimeType) {
    return new Promise((resolve, reject) => {
      const boundary = `--ShilpSetuBoundary${Date.now()}`;
      const CRLF = '\r\n';

      // Build multipart/form-data body manually (no axios/form-data dep needed)
      const header =
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="image_file"; filename="image"${CRLF}` +
        `Content-Type: ${mimeType}${CRLF}${CRLF}`;

      const footer = `${CRLF}--${boundary}--${CRLF}`;

      const headerBuf = Buffer.from(header, 'utf8');
      const footerBuf = Buffer.from(footer, 'utf8');
      const body = Buffer.concat([headerBuf, imageBuffer, footerBuf]);

      const options = {
        hostname: 'api.remove.bg',
        path: '/v1.0/removebg',
        method: 'POST',
        headers: {
          'X-Api-Key': env.REMOVEBG_API_KEY,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const responseBuffer = Buffer.concat(chunks);
          if (res.statusCode === 200) {
            resolve(responseBuffer);
          } else {
            // Parse error response safely — never log the API key
            let errMsg = `remove.bg API error: HTTP ${res.statusCode}`;
            try {
              const errBody = JSON.parse(responseBuffer.toString());
              errMsg = errBody?.errors?.[0]?.title || errMsg;
            } catch (_) { /* ignore parse error */ }
            reject(new Error(errMsg));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(body);
      req.end();
    });
  },
};

module.exports = removeBgProvider;
