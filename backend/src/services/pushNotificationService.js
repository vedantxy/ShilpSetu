'use strict';

const https = require('https');
const { supabaseAdmin } = require('../config/supabase');
const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * PushNotificationService — Integrates with Expo Push Notification API.
 */
class PushNotificationService {
  /**
   * Register or activate a user's device push token.
   */
  async registerToken(userId, tokenData) {
    const { pushToken, deviceId, platform = 'expo' } = tokenData;

    if (!pushToken || typeof pushToken !== 'string') {
      throw new Error('Valid pushToken string is required');
    }

    const { data, error } = await supabaseAdmin
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          push_token: pushToken.trim(),
          device_id: deviceId || null,
          platform: platform.toLowerCase(),
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,push_token' }
      )
      .select()
      .single();

    if (error) {
      logger.error(`Failed to register push token for user ${userId}: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Deactivate a push token.
   */
  async removeToken(userId, pushToken) {
    const { error } = await supabaseAdmin
      .from('user_push_tokens')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('push_token', pushToken);

    if (error) {
      logger.error(`Failed to deactivate push token for user ${userId}: ${error.message}`);
      throw error;
    }

    return true;
  }

  /**
   * Send push notification to all active devices of a target user.
   *
   * @param {string} userId - Recipient profile ID
   * @param {Object} message
   * @param {string} message.title
   * @param {string} message.body
   * @param {Object} [message.data]
   * @param {number} [message.badge]
   * @param {string} [message.sound='default']
   */
  async sendToUser(userId, message) {
    try {
      // 1. Fetch active tokens for user
      const { data: tokens, error } = await supabaseAdmin
        .from('user_push_tokens')
        .select('id, push_token')
        .eq('user_id', userId)
        .eq('active', true);

      if (error || !tokens || tokens.length === 0) {
        logger.debug(`No active push tokens found for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      const validTokens = [];
      for (const t of tokens) {
        if (this._isValidExpoToken(t.push_token)) {
          validTokens.push(t);
        } else {
          logger.warn(`Invalid push token format: ${t.push_token}`);
        }
      }

      if (validTokens.length === 0) {
        return { sent: 0, failed: 0 };
      }

      // 2. Prepare payload for Expo Push API
      const messages = validTokens.map((t) => ({
        to: t.push_token,
        title: message.title,
        body: message.body,
        data: message.data || {},
        sound: message.sound || 'default',
        badge: message.badge,
        priority: 'high',
        channelId: 'default',
      }));

      // 3. Dispatch to Expo Push API
      const receipts = await this._sendExpoPushBatch(messages);

      // 4. Handle stale/unregistered tokens
      if (receipts && Array.isArray(receipts.data)) {
        for (let i = 0; i < receipts.data.length; i++) {
          const receipt = receipts.data[i];
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            const staleTokenId = validTokens[i]?.id;
            if (staleTokenId) {
              logger.info(`Deactivating unregistered push token ID: ${staleTokenId}`);
              await supabaseAdmin
                .from('user_push_tokens')
                .update({ active: false })
                .eq('id', staleTokenId);
            }
          }
        }
      }

      return {
        sent: validTokens.length,
        failed: 0,
      };
    } catch (err) {
      logger.error(`Push notification delivery failed for user ${userId}: ${err.message}`);
      return { sent: 0, failed: 1, error: err.message };
    }
  }

  /**
   * Helper to check Expo push token format.
   */
  _isValidExpoToken(token) {
    if (typeof token !== 'string') return false;
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      /^[a-zA-Z0-9_-]{20,}$/.test(token)
    );
  }

  /**
   * Call Expo Push API endpoint.
   * @private
   */
  _sendExpoPushBatch(messages) {
    return new Promise((resolve) => {
      const requestBody = JSON.stringify(messages);
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(requestBody),
      };

      if (env.EXPO_ACCESS_TOKEN) {
        headers['Authorization'] = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
      }

      const req = https.request(
        {
          hostname: 'exp.host',
          path: '/--/api/v2/push/send',
          method: 'POST',
          headers,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);
              resolve(data);
            } catch (err) {
              logger.error(`Failed to parse Expo push response: ${err.message}`);
              resolve(null);
            }
          });
        }
      );

      req.on('error', (err) => {
        logger.error(`Expo Push API connection error: ${err.message}`);
        resolve(null);
      });

      req.write(requestBody);
      req.end();
    });
  }
}

module.exports = new PushNotificationService();
