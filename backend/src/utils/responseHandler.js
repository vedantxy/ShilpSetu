'use strict';

const ErrorCodes = require('./errorCodes');

/**
 * Standardized API response helpers.
 * Every endpoint returns a consistent JSON envelope.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {object} data
 * @param {number} statusCode - defaults to 200
 */
function sendSuccess(res, message = 'Operation successful', data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send a created response (201).
 */
function sendCreated(res, message = 'Resource created successfully', data = {}) {
  return sendSuccess(res, message, data, 201);
}

/**
 * Send an error response with standardized error code.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 * @param {Array} errors
 * @param {string} errorCode
 */
function sendError(res, message = 'Something went wrong', statusCode = 500, errors = [], errorCode = ErrorCodes.INTERNAL_ERROR) {
  return res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    errors,
  });
}

module.exports = { sendSuccess, sendCreated, sendError };
