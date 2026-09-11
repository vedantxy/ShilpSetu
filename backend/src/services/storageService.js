'use strict';

const { env } = require('../config/env');
const supabaseStorageProvider = require('../providers/storage/supabaseStorageProvider');
const localStorageProvider = require('../providers/storage/localStorageProvider');
const logger = require('../utils/logger');
const path = require('path');

/**
 * Storage Service — Configurable storage abstraction.
 * Delegates file storage operations to active provider (Supabase Storage or Local Disk).
 */
class StorageService {
  constructor() {
    this._providers = {
      supabase: supabaseStorageProvider,
      local: localStorageProvider,
    };
  }

  /**
   * Get currently configured storage provider.
   */
  get provider() {
    const providerName = env.STORAGE_PROVIDER || 'supabase';
    return this._providers[providerName] || supabaseStorageProvider;
  }

  /**
   * Upload a file to storage.
   *
   * @param {string} bucket - Bucket name (e.g., 'product-images', 'media')
   * @param {Buffer} fileBuffer - File data buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - MIME type of the file
   * @param {string} userId - Authenticated user's ID (used in path)
   * @param {Object} [options]
   * @returns {Promise<{ url: string, path: string, key: string, provider: string }>}
   */
  async upload(bucket, fileBuffer, originalName, mimeType, userId, options = {}) {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = `${userId}/${uniqueName}`;

    const result = await this.provider.upload(bucket, filePath, fileBuffer, mimeType, options);

    return {
      url: result.url,
      path: filePath,
      key: filePath,
      provider: result.provider,
    };
  }

  /**
   * Upload multiple files to a bucket.
   */
  async uploadMultiple(bucket, files, userId) {
    const results = [];
    for (const file of files) {
      const result = await this.upload(
        bucket,
        file.buffer,
        file.originalname,
        file.mimetype,
        userId
      );
      results.push(result);
    }
    return results;
  }

  /**
   * Get file buffer from storage.
   */
  async get(bucket, filePath) {
    return this.provider.get(bucket, filePath);
  }

  /**
   * Delete a file from storage.
   */
  async delete(bucket, filePath) {
    return this.provider.delete(bucket, filePath);
  }

  /**
   * Check if a file exists in storage.
   */
  async exists(bucket, filePath) {
    return this.provider.exists(bucket, filePath);
  }

  /**
   * Get public URL.
   */
  getPublicUrl(bucket, filePath) {
    return this.provider.getPublicUrl(bucket, filePath);
  }

  /**
   * Get temporary signed URL.
   */
  async getSignedUrl(bucket, filePath, expiresInSec = 3600) {
    return this.provider.getSignedUrl(bucket, filePath, expiresInSec);
  }

  /**
   * Verify that a file path belongs to a specific user.
   */
  isOwnedByUser(filePath, userId) {
    return filePath.startsWith(`${userId}/`);
  }
}

module.exports = new StorageService();
