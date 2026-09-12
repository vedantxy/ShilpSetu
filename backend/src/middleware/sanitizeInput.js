'use strict';

/**
 * Sanitize a single value against injection attacks and malicious scripts.
 */
function sanitizeValue(value, depth = 0) {
  if (depth > 10) return value; // Prevent deep recursion DOS

  if (typeof value === 'string') {
    // 1. Remove null bytes
    let cleaned = value.replace(/\0/g, '');
    // 2. Strip HTML script tags and javascript: URIs
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/javascript:/gi, '');
    return cleaned;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const key of Object.keys(value)) {
      // Reject / strip keys starting with $ or containing . (NoSQL operator injections)
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      sanitizedObj[key] = sanitizeValue(value[key], depth + 1);
    }
    return sanitizedObj;
  }

  return value;
}

/**
 * Input sanitization middleware.
 * Sanitizes req.body, req.query, and req.params before passing to routes.
 */
function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = sanitizeInput;
