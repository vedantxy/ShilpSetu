'use strict';

const fs = require('fs').promises;
const path = require('path');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Local Storage Provider
 * Stores files on local disk (useful for offline/standalone development).
 */
class LocalStorageProvider {
  constructor() {
    this.name = 'local';
    this.baseDir = env.STORAGE_LOCAL_DIR || path.resolve(__dirname, '../../../uploads');
  }

  async _ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Upload file to local disk.
   */
  async upload(bucket, key, buffer, mimeType, options = {}) {
    const targetDir = path.join(this.baseDir, bucket, path.dirname(key));
    await this._ensureDir(targetDir);

    const targetFilePath = path.join(this.baseDir, bucket, key);
    await fs.writeFile(targetFilePath, buffer);

    const publicUrl = `/uploads/${bucket}/${key}`;

    return {
      provider: 'local',
      bucket,
      key,
      url: publicUrl,
    };
  }

  /**
   * Read file from local disk.
   */
  async get(bucket, key) {
    const filePath = path.join(this.baseDir, bucket, key);
    return fs.readFile(filePath);
  }

  /**
   * Delete file from local disk.
   */
  async delete(bucket, key) {
    const filePath = path.join(this.baseDir, bucket, key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return true;
      throw err;
    }
  }

  /**
   * Check if file exists on disk.
   */
  async exists(bucket, key) {
    const filePath = path.join(this.baseDir, bucket, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get public URL.
   */
  getPublicUrl(bucket, key) {
    return `/uploads/${bucket}/${key}`;
  }

  /**
   * Get signed URL (for local provider, returns public path).
   */
  async getSignedUrl(bucket, key, expiresInSec = 3600) {
    return this.getPublicUrl(bucket, key);
  }
}

module.exports = new LocalStorageProvider();
