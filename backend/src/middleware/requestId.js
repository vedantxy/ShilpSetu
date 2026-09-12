'use strict';

const crypto = require('crypto');

/**
 * Request ID middleware.
 * Attaches a unique request ID to req.id and sets X-Request-Id response header for end-to-end tracing.
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
