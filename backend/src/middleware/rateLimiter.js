'use strict';

const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const ErrorCodes = require('../utils/errorCodes');
const { sendError } = require('../utils/responseHandler');

/**
 * General API rate limiter (100 reqs / 15 min window).
 */
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 900000,
  max: env.RATE_LIMIT_MAX_REQUESTS || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many requests. Please try again later.', 429, [], ErrorCodes.RATE_LIMITED);
  },
});

/**
 * Strict rate limiter for authentication endpoints (login, signup, OTP, password resets).
 */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 900000,
  max: env.AUTH_RATE_LIMIT_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many authentication attempts. Please try again after 15 minutes.', 429, [], ErrorCodes.RATE_LIMITED);
  },
});

/**
 * Rate limiter for AI generation and analysis APIs.
 */
const aiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 900000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'AI rate limit exceeded. Please wait a few minutes before generating again.', 429, [], ErrorCodes.RATE_LIMITED);
  },
});

/**
 * Rate limiter for media and file upload endpoints.
 */
const uploadLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 900000,
  max: env.UPLOAD_RATE_LIMIT_MAX || 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Upload rate limit exceeded. Please try again later.', 429, [], ErrorCodes.RATE_LIMITED);
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
};
