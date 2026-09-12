'use strict';

const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const { sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { env } = require('../config/env');

/**
 * Global error handler middleware.
 * Catches all errors thrown by routes / middleware and returns a standardized response with error codes.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const requestId = req?.id || req?.headers?.['x-request-id'] || 'unknown';

  // 1. Known ApiError
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.statusCode, err.errors, err.errorCode || ErrorCodes.INTERNAL_ERROR);
  }

  // 2. Multer upload errors
  if (err.name === 'MulterError') {
    let msg = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      msg = `File too large. Maximum size is ${env.MAX_FILE_SIZE_MB}MB`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      msg = `Too many files. Maximum is ${env.MAX_FILES_PER_UPLOAD}`;
    }
    return sendError(res, msg, 400, [{ field: err.field, message: msg }], ErrorCodes.MEDIA_UPLOAD_ERROR);
  }

  // 3. Zod validation errors
  if (err.name === 'ZodError') {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 'Validation failed', 400, errors, ErrorCodes.VALIDATION_ERROR);
  }

  // 4. Supabase / Database errors
  if (err.code && (typeof err.code === 'string' && (err.code.startsWith('PGRST') || err.code.startsWith('2350')))) {
    logger.error(`Database error [ReqID: ${requestId}]: ${err.message}`, { code: err.code });
    return sendError(res, 'Database operation failed', 500, [], ErrorCodes.DATABASE_ERROR);
  }

  // 5. Unexpected errors
  logger.error(`Unhandled error [ReqID: ${requestId}]:`, err);

  const message = env.isProduction ? 'Internal server error' : err.message;
  const stack = env.isProduction ? undefined : err.stack;

  return res.status(500).json({
    success: false,
    message,
    errorCode: ErrorCodes.INTERNAL_ERROR,
    errors: [],
    ...(stack && { stack }),
  });
}

module.exports = errorHandler;
