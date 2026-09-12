'use strict';

const ErrorCodes = require('./errorCodes');

/**
 * Custom API Error class used throughout the application.
 * Maps to consistent HTTP status codes, error codes, and response structure.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {string} [errorCode='INTERNAL_ERROR'] - Standardized internal error code
   * @param {Array} [errors=[]] - Optional array of granular error details
   */
  constructor(statusCode, message, errorCode = ErrorCodes.INTERNAL_ERROR, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad request', errors = [], errorCode = ErrorCodes.VALIDATION_ERROR) {
    return new ApiError(400, message, errorCode, errors);
  }

  static unauthorized(message = 'Authentication required', errorCode = ErrorCodes.AUTH_REQUIRED) {
    return new ApiError(401, message, errorCode);
  }

  static invalidAuth(message = 'Invalid or expired access token', errorCode = ErrorCodes.AUTH_INVALID) {
    return new ApiError(401, message, errorCode);
  }

  static forbidden(message = 'Access forbidden', errorCode = ErrorCodes.FORBIDDEN) {
    return new ApiError(403, message, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = ErrorCodes.NOT_FOUND) {
    return new ApiError(404, message, errorCode);
  }

  static conflict(message = 'Resource already exists', errorCode = ErrorCodes.CONFLICT) {
    return new ApiError(409, message, errorCode);
  }

  static rateLimited(message = 'Too many requests. Please try again later.', errorCode = ErrorCodes.RATE_LIMITED) {
    return new ApiError(429, message, errorCode);
  }

  static aiError(message = 'AI service encountered an error', errors = [], errorCode = ErrorCodes.AI_SERVICE_ERROR) {
    return new ApiError(502, message, errorCode, errors);
  }

  static mediaError(message = 'Media upload or validation failed', errors = [], errorCode = ErrorCodes.MEDIA_UPLOAD_ERROR) {
    return new ApiError(400, message, errorCode, errors);
  }

  static databaseError(message = 'Database operation failed', errorCode = ErrorCodes.DATABASE_ERROR) {
    return new ApiError(500, message, errorCode);
  }

  static internal(message = 'Internal server error', errorCode = ErrorCodes.INTERNAL_ERROR) {
    return new ApiError(500, message, errorCode);
  }
}

module.exports = ApiError;
