'use strict';

const logger = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'otp',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'authorization',
  'cardnumber',
  'card_number',
  'cvv',
]);

/**
 * Recursively sanitize an object by masking sensitive field values.
 */
function redactSensitive(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, depth + 1));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      redacted[key] = redactSensitive(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Structured request logging middleware.
 */
function requestLogger(req, res, next) {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

    const logPayload = {
      requestId: req.id || req.headers['x-request-id'] || 'unknown',
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: parseFloat(durationMs),
      userId: req.user?.id || 'anonymous',
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    const logMsg = `[${logPayload.method}] ${logPayload.url} ${logPayload.status} - ${logPayload.durationMs}ms [ReqID: ${logPayload.requestId}] [User: ${logPayload.userId}]`;

    if (res.statusCode >= 500) {
      logger.error(logMsg, logPayload);
    } else if (res.statusCode >= 400) {
      logger.warn(logMsg, logPayload);
    } else {
      logger.http(logMsg, logPayload);
    }
  });

  next();
}

module.exports = requestLogger;
module.exports.redactSensitive = redactSensitive;
