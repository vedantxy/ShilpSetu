'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../utils/logger');

/**
 * Supabase Storage Provider
 * Implements cloud object storage via Supabase Storage API.
 */
class SupabaseStorageProvider {
  constructor() {
    this.name = 'supabase';
  }

  /**
   * Upload file to Supabase Storage bucket.
   *
   * @param {string} bucket
   * @param {string} key - storage path (e.g. 'userId/filename.jpg')
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @param {Object} [options]
   */
  async upload(bucket, key, buffer, mimeType, options = {}) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(key, buffer, {
        contentType: mimeType,
        upsert: options.upsert || false,
      });

    if (error) {
      logger.error(`SupabaseStorageProvider upload failed for ${bucket}/${key}: ${error.message}`);
      throw error;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(key);

    return {
      provider: 'supabase',
      bucket,
      key,
      url: urlData.publicUrl,
    };
  }

  /**
   * Download / get file buffer.
   */
  async get(bucket, key) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(key);

    if (error) {
      logger.error(`SupabaseStorageProvider get failed for ${bucket}/${key}: ${error.message}`);
      throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Delete file from bucket.
   */
  async delete(bucket, key) {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([key]);

    if (error) {
      logger.error(`SupabaseStorageProvider delete failed for ${bucket}/${key}: ${error.message}`);
      throw error;
    }

    return true;
  }

  /**
   * Check if file exists in bucket.
   */
  async exists(bucket, key) {
    try {
      const dir = key.substring(0, key.lastIndexOf('/'));
      const filename = key.substring(key.lastIndexOf('/') + 1);

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(dir || undefined, {
          search: filename,
        });

      if (error || !data) return false;
      return data.some((item) => item.name === filename);
    } catch {
      return false;
    }
  }

  /**
   * Get public CDN URL for a file key.
   */
  getPublicUrl(bucket, key) {
    const { data } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(key);
    return data.publicUrl;
  }

  /**
   * Create a temporary signed URL for private assets.
   */
  async getSignedUrl(bucket, key, expiresInSec = 3600) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSec);

    if (error) {
      logger.error(`SupabaseStorageProvider signedUrl failed for ${bucket}/${key}: ${error.message}`);
      throw error;
    }

    return data.signedUrl;
  }
}

module.exports = new SupabaseStorageProvider();
